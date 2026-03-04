import { type MemberType, type Model, type Type, type Union, getTypeName } from "@typespec/compiler";
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
import { reportDiagnostic } from "../../lib.js";
import { setOneOf } from "../../lib/one-of.js";
import {
  getNullableUnionType,
  getUnionName,
  sanitizeNameForGraphQL,
  toTypeName,
} from "../../lib/type-utils.js";
import { GraphQLMutationOptions, GraphQLTypeContext } from "../options.js";

/**
 * Get the string name from a union variant name, which may be a string or symbol.
 * Symbols arise from anonymous/expression unions; we use their description as the name.
 */
function variantNameToString(name: string | symbol): string {
  return typeof name === "string" ? name : (name.description ?? "");
}

/**
 * GraphQL-specific Union mutation.
 *
 * In output context: flattens nested unions, deduplicates variants,
 * and creates synthetic wrapper models for scalar variants since GraphQL unions
 * can only contain object types.
 *
 * In input context: creates a synthetic @oneOf input object, because GraphQL unions
 * are output-only. Each variant becomes a nullable field on the input object, and
 * exactly one field must be provided (oneOf semantics).
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

  /**
   * The input/output context this union was mutated with.
   * Undefined when the options are not GraphQLMutationOptions (e.g. via
   * SimpleMutationOptions edge propagation).
   */
  get typeContext(): GraphQLTypeContext | undefined {
    return this.options instanceof GraphQLMutationOptions
      ? this.options.typeContext
      : undefined;
  }

  get mutationNode() {
    return this.#mutationNode;
  }

  get mutatedType(): Union | Model {
    // In input context, the union node is replaced with a @oneOf Model
    if (this.#mutationNode.isReplaced && this.#mutationNode.replacementNode) {
      return this.#mutationNode.replacementNode.mutatedType as Model;
    }
    // Return flattened union if we created one, otherwise use mutation node's type
    return this.#flattenedUnion || this.#mutationNode.mutatedType;
  }

  /**
   * Synthetic wrapper models created for scalar union variants.
   * These are collected by the emitter and emitted as separate GraphQL object types.
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
    // Check if this is a nullable union (e.g., string | null)
    // Nullable unions are handled by the nullability system, not as unions
    if (getNullableUnionType(this.sourceType) !== undefined) {
      this.#mutationNode.mutate();
      super.mutate();
      return;
    }

    if (this.typeContext === GraphQLTypeContext.Input) {
      this.mutateAsOneOfInput();
      // Don't call super.mutate() — the union node has been replaced with a
      // Model, so iterating union variants is not needed
      return;
    }

    this.mutateAsOutputUnion();
    super.mutate();
  }

  /**
   * Mutate as an output union: flatten nested unions, deduplicate, and
   * wrap scalar variants in synthetic models.
   */
  private mutateAsOutputUnion() {
    const tk = this.engine.$;

    const flattenedVariants = this.deduplicateVariants(
      this.flattenUnionVariants(this.sourceType),
    );

    const needsFlattening = flattenedVariants.length !== this.sourceType.variants.size;

    if (needsFlattening) {
      // Create a new flattened union using TypeKit
      // Convert symbol names to strings — GraphQL identifiers must be strings
      const variantArray = flattenedVariants.map((variant) => {
        return tk.unionVariant.create({
          name: variantNameToString(variant.name),
          type: variant.type,
        });
      });

      const flattenedUnion = tk.union.create({
        name: this.sourceType.name,
        variants: variantArray,
      });

      this.#flattenedUnion = flattenedUnion;
    } else {
      this.#mutationNode.mutate();
    }

    // Wrap scalar variants in synthetic models (GraphQL unions can only contain object types)
    for (const variant of flattenedVariants) {
      const isScalar = variant.type.kind === "Scalar" || variant.type.kind === "Intrinsic";

      if (isScalar) {
        const variantName = variantNameToString(variant.name);
        const unionName = this.sourceType.name ?? "";
        const wrapperName = toTypeName(unionName) + toTypeName(variantName) + "UnionVariant";

        const valueProp = tk.modelProperty.create({
          name: "value",
          type: variant.type,
          optional: false,
        });

        const wrapperModel = tk.model.create({
          name: wrapperName,
          properties: { value: valueProp },
        });

        this.#wrapperModels.push(wrapperModel);
      }
    }
  }

  /**
   * Mutate as a @oneOf input object. GraphQL unions are output-only, so when
   * a union appears in input context it becomes a oneOf Input Object where
   * each variant is a nullable field and exactly one must be provided.
   *
   * @see https://spec.graphql.org/September2025/#sec-OneOf-Input-Objects
   */
  private mutateAsOneOfInput() {
    const tk = this.engine.$;
    const program = tk.program;

    const flattenedVariants = this.deduplicateVariants(
      this.flattenUnionVariants(this.sourceType),
    );

    // Create one nullable field per variant
    const properties: Record<string, ReturnType<typeof tk.modelProperty.create>> = {};
    for (const variant of flattenedVariants) {
      const fieldName = sanitizeNameForGraphQL(variantNameToString(variant.name));
      properties[fieldName] = tk.modelProperty.create({
        name: fieldName,
        type: variant.type,
        // All fields are optional — oneOf semantics mean exactly one must be provided,
        // but from the schema perspective each individual field is nullable
        optional: true,
      });
    }

    const unionName = getUnionName(this.sourceType, program);
    const modelName = sanitizeNameForGraphQL(unionName) + "Input";

    const oneOfModel = tk.model.create({
      name: modelName,
      properties,
    });

    // Mark as @oneOf so the emitter can emit the directive
    setOneOf(program, oneOfModel);

    // Replace the union node with the model in the type graph.
    // This notifies all parent edges (ModelProperty, UnionVariant) via onTailReplaced,
    // so their mutatedType.type automatically points to the oneOf Model.
    this.#mutationNode.replace(oneOfModel);
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

  /**
   * Remove duplicate variants by type identity. If two variants reference the
   * same type, the first occurrence wins and a diagnostic is emitted.
   */
  private deduplicateVariants(
    variants: Array<{ name: string | symbol; type: Type }>,
  ): Array<{ name: string | symbol; type: Type }> {
    const seen = new Map<Type, { name: string | symbol; type: Type }>();
    const result: Array<{ name: string | symbol; type: Type }> = [];

    for (const variant of variants) {
      if (seen.has(variant.type)) {
        reportDiagnostic(this.engine.$.program, {
          code: "duplicate-union-variant",
          format: { type: getTypeName(variant.type) },
          target: this.sourceType,
        });
      } else {
        seen.set(variant.type, variant);
        result.push(variant);
      }
    }

    return result;
  }
}
