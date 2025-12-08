import { ModelPropertyMutation } from "@typespec/mutator-framework";
import { sanitizeNameForGraphQL } from "../../lib/type-utils.js";

export class GraphQLModelPropertyMutation extends ModelPropertyMutation<any, any> {
  mutate() {
    this.mutateType((property) => {
      property.name = sanitizeNameForGraphQL(property.name);
    });
    super.mutate();
  }
}

