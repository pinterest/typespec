import type { MemberType, Model } from "@typespec/compiler";
import {
  SimpleModelMutation,
  type MutationInfo,
  type SimpleMutationEngine,
  type SimpleMutationOptions,
  type SimpleMutations,
} from "@typespec/mutator-framework";
import { sanitizeNameForGraphQL } from "../../lib/type-utils.js";

/**
 * GraphQL-specific Model mutation.
 */
export class GraphQLModelMutation extends SimpleModelMutation<SimpleMutationOptions> {
  constructor(
    engine: SimpleMutationEngine<SimpleMutations<SimpleMutationOptions>>,
    sourceType: Model,
    referenceTypes: MemberType[],
    options: SimpleMutationOptions,
    info: MutationInfo,
  ) {
    super(engine, sourceType, referenceTypes, options, info);
  }

  mutate() {
    // Apply GraphQL name sanitization
    this.mutationNode.mutate((model) => {
      model.name = sanitizeNameForGraphQL(model.name);
    });
    super.mutate();
  }
}
