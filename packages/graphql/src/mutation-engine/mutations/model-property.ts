import type { MemberType, ModelProperty } from "@typespec/compiler";
import {
  SimpleModelPropertyMutation,
  type MutationInfo,
  type SimpleMutationEngine,
  type SimpleMutationOptions,
  type SimpleMutations,
} from "@typespec/mutator-framework";
import { sanitizeNameForGraphQL } from "../../lib/type-utils.js";

/** GraphQL-specific ModelProperty mutation. */
export class GraphQLModelPropertyMutation extends SimpleModelPropertyMutation<SimpleMutationOptions> {
  constructor(
    engine: SimpleMutationEngine<SimpleMutations<SimpleMutationOptions>>,
    sourceType: ModelProperty,
    referenceTypes: MemberType[],
    options: SimpleMutationOptions,
    info: MutationInfo,
  ) {
    super(engine as any, sourceType, referenceTypes, options, info);
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
    // Trigger mutation if not already mutated (whenMutated callback will run)
    this.mutationNode.mutate();
    super.mutate();
  }
}
