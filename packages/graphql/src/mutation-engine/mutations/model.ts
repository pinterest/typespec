import { ModelMutation } from "@typespec/mutator-framework";
import { sanitizeNameForGraphQL } from "../../lib/type-utils.js";

export class GraphQLModelMutation extends ModelMutation<any, any> {
  mutate() {
    this.mutateType((model) => {
      model.name = sanitizeNameForGraphQL(model.name);
    });
    super.mutate();
  }
}

