import { EnumMemberMutation } from "@typespec/mutator-framework";
import { sanitizeNameForGraphQL } from "../../lib/type-utils.js";

export class GraphQLEnumMemberMutation extends EnumMemberMutation<any, any> {
  mutate() {
    this.mutateType((member) => {
      member.name = sanitizeNameForGraphQL(member.name);
    });
    super.mutate();
  }
}

