import type { MemberType, Model, ModelProperty, Union } from "@typespec/compiler";
import {
  SimpleModelPropertyMutation,
  type MutationInfo,
  type SimpleMutationEngine,
  type SimpleMutationOptions,
  type SimpleMutations,
} from "@typespec/mutator-framework";
import { setNullable, setNullableElements } from "../../lib/nullable.js";
import { unwrapNullableUnion, sanitizeNameForGraphQL } from "../../lib/type-utils.js";

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
    // The mutation engine's union replace() swaps inline T | null unions with the
    // inner type, but we can't mark that shared type as nullable (would poison all
    // uses). Instead, we mark the property itself — properties are unique per use-site.
    const originalType = this.sourceType.type;

    // Case 1: Property type is directly T | null (e.g., `bio: string | null`)
    const isInlineNullable =
      originalType.kind === "Union" &&
      unwrapNullableUnion(originalType as Union) !== undefined;

    // Case 2: Property type is Array<T | null> (e.g., `tags: (string | null)[]`)
    // The array model's indexer value is the element type — check if it's T | null.
    const isArrayWithNullableElements =
      originalType.kind === "Model" &&
      (originalType as Model).indexer?.key.name === "integer" &&
      (originalType as Model).indexer?.value.kind === "Union" &&
      unwrapNullableUnion((originalType as Model).indexer!.value as Union) !== undefined;

    // Trigger mutation if not already mutated (whenMutated callback will run)
    this.mutationNode.mutate();
    super.mutate();

    // Mark the mutated property as nullable after mutation completes.
    // The component layer checks isNullable(program, property) to determine
    // whether a field should omit the ! (non-null) wrapper.
    if (isInlineNullable) {
      setNullable(this.engine.$.program, this.mutatedType);
    }

    // Mark the property as having nullable array elements. The component layer
    // checks hasNullableElements(program, property) to determine whether array
    // items should omit the ! wrapper (e.g., [String] instead of [String!]).
    if (isArrayWithNullableElements) {
      setNullableElements(this.engine.$.program, this.mutatedType);
    }
  }
}
