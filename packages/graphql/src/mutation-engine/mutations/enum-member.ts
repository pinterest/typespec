import { EnumMemberMutation } from "@typespec/mutator-framework";
import { renameForGraphQL } from "../transforms/index.js";

export class GraphQLEnumMemberMutation extends EnumMemberMutation<any, any> {
  mutate() {
    this.mutateType((member) => {
      renameForGraphQL(member);
    });
    super.mutate();
  }
}

