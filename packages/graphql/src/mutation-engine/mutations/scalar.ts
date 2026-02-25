import type { MemberType, Scalar } from "@typespec/compiler";
import {
  SimpleScalarMutation,
  type MutationInfo,
  type SimpleMutationEngine,
  type SimpleMutationOptions,
  type SimpleMutations,
} from "@typespec/mutator-framework";
import { sanitizeNameForGraphQL } from "../../lib/type-utils.js";
import { getScalarMapping } from "../../lib/scalar-mappings.js";

/** GraphQL-specific Scalar mutation */
export class GraphQLScalarMutation extends SimpleScalarMutation<SimpleMutationOptions> {
  #specificationUrl?: string;

  constructor(
    engine: SimpleMutationEngine<SimpleMutations<SimpleMutationOptions>>,
    sourceType: Scalar,
    referenceTypes: MemberType[],
    options: SimpleMutationOptions,
    info: MutationInfo,
  ) {
    super(engine, sourceType, referenceTypes, options, info);
  }

  /**
   * Get the specification URL for @specifiedBy directive (if any)
   */
  get specificationUrl(): string | undefined {
    return this.#specificationUrl;
  }

  mutate() {
    // Check if this is a TypeSpec standard library scalar that maps to a GraphQL custom scalar
    const mapping = getScalarMapping(this.engine.$.program, this.sourceType);

    // Apply name transformation and store specification URL
    this.mutationNode.mutate((scalar) => {
      if (mapping) {
        // Use the mapped GraphQL scalar name
        scalar.name = mapping.graphqlName;
        this.#specificationUrl = mapping.specificationUrl;
      } else {
        // Custom scalar - just sanitize the name
        scalar.name = sanitizeNameForGraphQL(scalar.name);
      }
    });
    super.mutate();
  }
}
