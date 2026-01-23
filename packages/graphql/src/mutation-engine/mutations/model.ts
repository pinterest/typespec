import { UsageFlags, type MemberType, type Model } from "@typespec/compiler";
import {
  SimpleModelMutation,
  type MutationInfo,
  type SimpleMutationEngine,
  type SimpleMutationOptions,
  type SimpleMutations,
} from "@typespec/mutator-framework";
import { sanitizeNameForGraphQL } from "../../lib/type-utils.js";
import type { GraphQLMutationOptions } from "../options.js";

/**
 * GraphQL-specific Model mutation that sanitizes names for GraphQL compatibility.
 * Adds "Input" suffix when the model is used as an input type.
 */
export class GraphQLModelMutation extends SimpleModelMutation<SimpleMutationOptions> {
  private graphqlOptions: GraphQLMutationOptions;

  constructor(
    engine: SimpleMutationEngine<SimpleMutations<SimpleMutationOptions>>,
    sourceType: Model,
    referenceTypes: MemberType[],
    options: SimpleMutationOptions,
    info: MutationInfo,
  ) {
    super(engine as any, sourceType, referenceTypes, options, info);
    this.graphqlOptions = options as GraphQLMutationOptions;
  }

  mutate() {
    // Apply GraphQL name sanitization
    this.mutationNode.mutate((model) => {
      let name = sanitizeNameForGraphQL(model.name);

      // Add "Input" suffix for input types
      if (this.graphqlOptions.usageFlag === UsageFlags.Input) {
        name = `${name}Input`;
      }

      model.name = name;
    });
    super.mutate();
  }
}
