import type { MemberType, Model } from "@typespec/compiler";
import {
  SimpleModelMutation,
  SimpleMutationEngine,
  type MutationInfo,
  type SimpleMutationOptions,
  type SimpleMutations,
} from "@typespec/mutator-framework";
import { sanitizeNameForGraphQL } from "../../lib/type-utils.js";

export class GraphQLModelMutation extends SimpleModelMutation<SimpleMutationOptions> {
  constructor(
    engine: SimpleMutationEngine<SimpleMutations<SimpleMutationOptions>>,
    sourceType: Model,
    referenceTypes: MemberType[],
    options: SimpleMutationOptions,
    info: MutationInfo,
  ) {
    super(engine as any, sourceType, referenceTypes, options, info);
  }

  mutate() {
    // Apply GraphQL name sanitization via callback
    this.mutationNode.mutate((model) => {
      model.name = sanitizeNameForGraphQL(model.name);
    });
    super.mutate();
  }
}
