import type { MemberType, Model, Type, Union } from "@typespec/compiler";
import {
  MutationEngine,
  MutationHalfEdge,
  type MutationInfo,
  type MutationOptions,
  SimpleUnionVariantMutation,
  UnionMutation,
  UnionMutationNode,
  UnionVariantMutationNode,
} from "@typespec/mutator-framework";
import { getNullableUnionType, toTypeName } from "../../lib/type-utils.js";

/**
 * GraphQL-specific Union mutation.
 * Creates synthetic wrapper models for scalar union variants since
 * GraphQL unions can only contain object types.
 */
export class GraphQLUnionMutation extends UnionMutation<MutationOptions, any, MutationEngine<any>> {
  #mutationNode: UnionMutationNode;
  #wrapperModels: Model[] = [];
  #flattenedUnion: Union | null = null;

  constructor(
    engine: MutationEngine<any>,
    sourceType: Union,
    referenceTypes: MemberType[],
    options: MutationOptions,
    info: MutationInfo,
  ) {
    super(engine, sourceType, referenceTypes, options, info);
    this.#mutationNode = this.engine.getMutationNode(this.sourceType, {
      mutationKey: info.mutationKey,
      isSynthetic: info.isSynthetic,
    }) as UnionMutationNode;
  }

  get mutationNode() {
    return this.#mutationNode;
  }

  get mutatedType() {
    // Return flattened union if we created one, otherwise use mutation node's type
    return this.#flattenedUnion || this.#mutationNode.mutatedType;
  }

  /**
   * Get the wrapper models that were created for scalar variants
   */
  get wrapperModels() {
    return this.#wrapperModels;
  }

  /**
   * Creates a MutationHalfEdge that wraps the node-level edge.
   * This ensures proper bidirectional updates when variants are mutated.
   */
  protected startVariantEdge(): MutationHalfEdge<
    GraphQLUnionMutation,
    SimpleUnionVariantMutation<MutationOptions>
  > {
    return new MutationHalfEdge("variant", this, (tail) => {
      this.#mutationNode.connectVariant(tail.mutationNode as UnionVariantMutationNode);
    });
  }

  mutate() {
    const tk = this.engine.$;

    // Check if this is a nullable union (e.g., string | null)
    // Don't create wrappers for nullable unions
    if (getNullableUnionType(this.sourceType) !== undefined) {
      // Skip wrapper creation for nullable unions
      this.#mutationNode.mutate();
      super.mutate();
      return;
    }

    // Flatten nested unions: collect all variants recursively
    const flattenedVariants = this.flattenUnionVariants(this.sourceType);

    // Check if we need to flatten (contains nested unions)
    const needsFlattening = flattenedVariants.length !== this.sourceType.variants.size;

    if (needsFlattening) {
      // Create a new flattened union using TypeKit
      const variantArray = flattenedVariants.map((variant) => {
        return tk.unionVariant.create({
          name: variant.name,
          type: variant.type,
        });
      });

      const flattenedUnion = tk.union.create({
        name: this.sourceType.name,
        variants: variantArray,
      });

      // Store the flattened union - it will be returned by the mutatedType getter
      this.#flattenedUnion = flattenedUnion;
    } else {
      // No flattening needed - use normal mutation
      this.#mutationNode.mutate();
    }

    // Process each variant to wrap scalars (for non-nullable unions)
    for (const variant of flattenedVariants) {
      const isScalar = variant.type.kind === "Scalar" || variant.type.kind === "Intrinsic";

      if (isScalar) {
        // Create a synthetic wrapper model for this scalar variant
        // Include union name to prevent collisions between different unions with same variant names
        const variantName = typeof variant.name === "string" ? variant.name : String(variant.name);
        const unionName = this.sourceType.name ?? "";
        const wrapperName = toTypeName(unionName) + toTypeName(variantName) + "UnionVariant";

        // Create a synthetic model property for the value field
        const valueProp = tk.modelProperty.create({
          name: "value",
          type: variant.type,
          optional: false,
        });

        // Create a synthetic wrapper model using TypeKit
        const wrapperModel = tk.model.create({
          name: wrapperName,
          properties: { value: valueProp },
        });

        // Store the wrapper model so it can be added to classified types
        this.#wrapperModels.push(wrapperModel);
      }
    }

    super.mutate();
  }

  /**
   * Recursively flatten nested unions into a single list of variants.
   * GraphQL doesn't support nested unions, so union Pet { cat: Cat, animal: Animal }
   * where Animal is itself a union becomes union Pet { Cat | Bear | Lion }
   */
  private flattenUnionVariants(
    union: Union,
    seen: Set<Union> = new Set(),
  ): Array<{ name: string | symbol; type: Type }> {
    if (seen.has(union)) {
      return [];
    }
    seen.add(union);

    const flattened: Array<{ name: string | symbol; type: Type }> = [];

    for (const variant of union.variants.values()) {
      if (variant.type.kind === "Union") {
        const nestedVariants = this.flattenUnionVariants(variant.type as Union, seen);
        flattened.push(...nestedVariants);
      } else {
        flattened.push({ name: variant.name, type: variant.type });
      }
    }

    return flattened;
  }
}
