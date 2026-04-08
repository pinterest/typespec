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
import { setNullable } from "../../lib/nullable.js";
import { setOneOf } from "../../lib/one-of.js";
import {
  unwrapNullableUnion,
  getUnionName,
  sanitizeNameForGraphQL,
  stripNullVariants,
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
    // A nullable wrapper (e.g. `string | null`) is not a real union —
    // it's just TypeSpec's way of spelling "nullable T". Replace the union
    // with the inner type so downstream code sees the unwrapped type.
    // Nullability is tracked via the state map.
    const innerType = unwrapNullableUnion(this.sourceType);
    if (innerType) {
      this.#mutationNode.replace(innerType);
      // NOTE: We intentionally do NOT call setNullable() on the replacement type here.
      // For inline T | null unions (e.g., `bio: string | null`), the replacement type
      // is a shared scalar singleton — marking it would poison all uses of that scalar.
      // Instead, nullability for inline T | null is tracked at the container level:
      // - Model properties: by GraphQLModelPropertyMutation
      // - Operation return types: by GraphQLOperationMutation
      // For named multi-variant unions (Cat | Dog | null), setNullable is called in
      // mutateAsOutputUnion() below on the newly-created union object, which is safe
      // because that object is unique.
      //
      // Don't call super.mutate() — replace() swaps the union out of the
      // graph, so there are no variants to iterate.
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
    const program = tk.program;

    // Strip null variants before processing — null is not a valid GraphQL union member.
    // Nullability is tracked separately via the state map.
    const { variants: sourceVariants, isNullable: hasNull } = stripNullVariants(this.sourceType);

    const flattenedVariants = this.deduplicateVariants(
      this.flattenVariants(sourceVariants),
    );

    if (flattenedVariants.length === 0) {
      reportDiagnostic(program, { code: "empty-union", target: this.sourceType });
      return;
    }

    const needsFlattening = flattenedVariants.length !== sourceVariants.length;

    if (needsFlattening || hasNull) {
      // Create a new union using TypeKit
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

    if (hasNull) {
      setNullable(program, this.mutatedType);
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

    // Strip null variants before processing
    const { variants: sourceVariants, isNullable: hasNull } = stripNullVariants(this.sourceType);

    const flattenedVariants = this.deduplicateVariants(
      this.flattenVariants(sourceVariants),
    );

    if (flattenedVariants.length === 0) {
      reportDiagnostic(program, { code: "empty-union", target: this.sourceType });
      return;
    }

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

    if (hasNull) {
      setNullable(program, oneOfModel);
    }

    // Replace the union node with the model in the type graph.
    // This notifies all parent edges (ModelProperty, UnionVariant) via onTailReplaced,
    // so their mutatedType.type automatically points to the oneOf Model.
    this.#mutationNode.replace(oneOfModel);
  }

  /**
   * Recursively flatten nested unions into a single list of variants.
   * GraphQL doesn't support nested unions, so union Pet { cat: Cat, animal: Animal }
   * where Animal is itself a union becomes union Pet { Cat | Bear | Lion }.
   *
   * Null variants are stripped at each level — nested unions may also contain null.
   */
  private flattenVariants(
    variants: readonly { name: string | symbol; type: Type }[],
    seen: Set<Union> = new Set(),
  ): Array<{ name: string | symbol; type: Type }> {
    const flattened: Array<{ name: string | symbol; type: Type }> = [];

    for (const variant of variants) {
      if (variant.type.kind === "Union") {
        const nestedUnion = variant.type as Union;
        if (seen.has(nestedUnion)) continue;
        seen.add(nestedUnion);

        // Strip null from nested unions too
        const { variants: nestedVariants } = stripNullVariants(nestedUnion);
        flattened.push(...this.flattenVariants(nestedVariants, seen));
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
