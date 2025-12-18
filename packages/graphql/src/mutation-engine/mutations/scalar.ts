import type { MemberType, Scalar } from "@typespec/compiler";
import {
  SimpleMutationEngine,
  SimpleScalarMutation,
  type MutationInfo,
  type SimpleMutationOptions,
  type SimpleMutations,
} from "@typespec/mutator-framework";
import { sanitizeNameForGraphQL } from "../../lib/type-utils.js";

export class GraphQLScalarMutation extends SimpleScalarMutation<SimpleMutationOptions> {
  constructor(
    engine: SimpleMutationEngine<SimpleMutations<SimpleMutationOptions>>,
    sourceType: Scalar,
    referenceTypes: MemberType[],
    options: SimpleMutationOptions,
    info: MutationInfo,
  ) {
    super(engine as any, sourceType, referenceTypes, options, info);
  }

  mutate() {
    // Apply GraphQL name sanitization via callback
    this.mutationNode.mutate((scalar) => {
      scalar.name = sanitizeNameForGraphQL(scalar.name);
    });
    super.mutate();
  }
}
