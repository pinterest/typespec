import type { EnumMember, MemberType } from "@typespec/compiler";
import {
  EnumMemberMutation,
  EnumMemberMutationNode,
  MutationEngine,
  type MutationInfo,
  type MutationOptions,
} from "@typespec/mutator-framework";
import { convertNumericEnumValue, sanitizeNameForGraphQL } from "../../lib/type-utils.js";

/**
 * GraphQL-specific EnumMember mutation.
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
  }

  get mutationNode() {
    return this.#mutationNode;
  }

  get mutatedType() {
    return this.#mutationNode.mutatedType;
  }

  mutate() {
    // Trigger mutation with a callback to set the name
    this.#mutationNode.mutate((member) => {
      // If the source enum member has an EXPLICIT numeric value (not auto-generated),
      // use that value to generate the name. Check node.value to see if it was explicit.
      if (
        this.sourceType.node?.value &&
        typeof this.sourceType.value === "number"
      ) {
        member.name = convertNumericEnumValue(this.sourceType.value);
      } else {
        member.name = sanitizeNameForGraphQL(member.name);
      }
    });
    super.mutate();
  }
}
