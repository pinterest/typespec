import type { MemberType, ModelProperty } from "@typespec/compiler";
import {
  SimpleModelPropertyMutation,
  type MutationInfo,
  type SimpleMutationEngine,
  type SimpleMutationOptions,
  type SimpleMutations,
} from "@typespec/mutator-framework";
import { setNullable, setNullableElements } from "../../lib/nullable.js";
import { isArray, unwrapNullableUnion, sanitizeNameForGraphQL } from "../../lib/type-utils.js";

/** GraphQL-specific ModelProperty mutation. */
export class GraphQLModelPropertyMutation extends SimpleModelPropertyMutation<SimpleMutationOptions> {
  constructor(
    engine: SimpleMutationEngine<SimpleMutations<SimpleMutationOptions>>,
    sourceType: ModelProperty,
    referenceTypes: MemberType[],
    options: SimpleMutationOptions,
    info: MutationInfo,
  ) {
    super(engine, sourceType, referenceTypes, options, info);
    // Register rename callback BEFORE any edge connections trigger mutation.
    // whenMutated fires when the node is mutated (even via edge propagation),
    // ensuring the name is sanitized before edge callbacks read it.
    this.mutationNode.whenMutated((property) => {
      if (property) {
        property.name = sanitizeNameForGraphQL(property.name);
      }
    });
  }

  mutate() {
    // Inspect the original property type BEFORE super.mutate() replaces it.
    //
    // After mutation, inline T | null unions are replaced with the inner type
    // (a shared singleton like `string`). We can't mark the singleton as
    // nullable — that would poison every use. Instead, we mark the property
    // itself, which is unique per use-site. See nullable.ts for the full
    // architectural explanation.
    const originalType = this.sourceType.type;

    // Case 1: Property type is directly T | null (e.g., `bio: string | null`)
    const isInlineNullable =
      originalType.kind === "Union" && unwrapNullableUnion(originalType) !== undefined;

    // Case 2: Property type is Array<T | null> (e.g., `tags: (string | null)[]`)
    // The array's element type (indexer value) is a T | null union.
    const isArrayWithNullableElements =
      originalType.kind === "Model" &&
      isArray(originalType) &&
      originalType.indexer.value.kind === "Union" &&
      unwrapNullableUnion(originalType.indexer.value) !== undefined;

    // Trigger mutation (whenMutated callback sanitizes the name)
    this.mutationNode.mutate();
    super.mutate();

    // Mark the mutated *property* (not the type) as nullable.
    // The component layer checks isNullable(program, property) to determine
    // whether a field should omit the ! (non-null) wrapper.
    if (isInlineNullable) {
      setNullable(this.engine.$.program, this.mutatedType);
    }

    // Mark the property as having nullable array elements.
    // The component layer checks hasNullableElements(program, property) to
    // emit [String] instead of [String!].
    if (isArrayWithNullableElements) {
      setNullableElements(this.engine.$.program, this.mutatedType);
    }
  }
}
