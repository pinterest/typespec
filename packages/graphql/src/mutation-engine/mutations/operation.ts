import type { MemberType, Operation } from "@typespec/compiler";
import {
  SimpleOperationMutation,
  type MutationInfo,
  type SimpleMutationEngine,
  type SimpleMutationOptions,
  type SimpleMutations,
} from "@typespec/mutator-framework";
import { sanitizeNameForGraphQL } from "../../lib/type-utils.js";

/** GraphQL-specific Operation mutation. */
export class GraphQLOperationMutation extends SimpleOperationMutation<SimpleMutationOptions> {
  constructor(
    engine: SimpleMutationEngine<SimpleMutations<SimpleMutationOptions>>,
    sourceType: Operation,
    referenceTypes: MemberType[],
    options: SimpleMutationOptions,
    info: MutationInfo,
  ) {
    super(engine as any, sourceType, referenceTypes, options, info);
  }

  mutate() {
    // Apply GraphQL name sanitization via callback
    this.mutationNode.mutate((operation) => {
      operation.name = sanitizeNameForGraphQL(operation.name);
    });
    super.mutate();
  }
}
