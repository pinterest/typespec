import { EnumMutation } from "@typespec/mutator-framework";
import { renameForGraphQL } from "../transforms/index.js";

export class GraphQLEnumMutation extends EnumMutation<any, any> {
  mutate() {
    this.mutateType((enumType) => {
      renameForGraphQL(enumType);
    });
    super.mutate();
  }
}

