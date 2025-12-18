import type { EnumMember, MemberType } from "@typespec/compiler";
import {
  EnumMemberMutation,
  EnumMemberMutationNode,
  MutationEngine,
  type MutationInfo,
  type MutationOptions,
} from "@typespec/mutator-framework";
import { sanitizeNameForGraphQL } from "../../lib/type-utils.js";

/**
 * GraphQL-specific EnumMember mutation that sanitizes member names for GraphQL.
 */
export class GraphQLEnumMemberMutation extends EnumMemberMutation<
  MutationOptions,
  any,
  MutationEngine<any>
> {
  #mutationNode: EnumMemberMutationNode;

  constructor(
    engine: MutationEngine<any>,
    sourceType: EnumMember,
    referenceTypes: MemberType[],
    options: MutationOptions,
    info: MutationInfo,
  ) {
    super(engine, sourceType, referenceTypes, options, info);
    this.#mutationNode = this.engine.getMutationNode(this.sourceType, {
      mutationKey: info.mutationKey,
      isSynthetic: info.isSynthetic,
    }) as EnumMemberMutationNode;
    // Register rename callback BEFORE any edge connections trigger mutation.
    // whenMutated fires when the node is mutated (even via edge propagation),
    // ensuring the name is sanitized before edge callbacks read it.
    this.#mutationNode.whenMutated((member) => {
      if (member) {
        member.name = sanitizeNameForGraphQL(member.name);
      }
    });
  }

  get mutationNode() {
    return this.#mutationNode;
  }

  get mutatedType() {
    return this.#mutationNode.mutatedType;
  }

  mutate() {
    // Trigger mutation if not already mutated (whenMutated callback will run)
    this.#mutationNode.mutate();
    super.mutate();
  }
}
