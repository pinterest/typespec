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
    // Register rename callback before edge connections trigger mutation.
    this.mutationNode.whenMutated((property) => {
      if (property) {
        property.name = sanitizeNameForGraphQL(property.name);
      }
    });
  }

  mutate() {
    // Snapshot nullability from the original type BEFORE mutation replaces it.
    // We mark the property (not the inner type) to avoid poisoning shared singletons.
    const originalType = this.sourceType.type;

    const isInlineNullable =
      originalType.kind === "Union" && unwrapNullableUnion(originalType) !== undefined;

    const isArrayWithNullableElements =
      originalType.kind === "Model" &&
      isArray(originalType) &&
      originalType.indexer.value.kind === "Union" &&
      unwrapNullableUnion(originalType.indexer.value) !== undefined;

    this.mutationNode.mutate();
    super.mutate();

    if (isInlineNullable) {
      setNullable(this.engine.$.program, this.mutatedType);
    }
    if (isArrayWithNullableElements) {
      setNullableElements(this.engine.$.program, this.mutatedType);
    }
  }
}
