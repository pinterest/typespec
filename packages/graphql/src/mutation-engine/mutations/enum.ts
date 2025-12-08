import { EnumMutation } from "@typespec/mutator-framework";
import { sanitizeNameForGraphQL } from "../../lib/type-utils.js";

export class GraphQLEnumMutation extends EnumMutation<any, any> {
  mutate() {
    this.mutateType((enumType) => {
      enumType.name = sanitizeNameForGraphQL(enumType.name);
    });
    super.mutate();
  }
}

