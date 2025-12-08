import { ModelMutation } from "@typespec/mutator-framework";
import { renameForGraphQL } from "../transforms/index.js";

export class GraphQLModelMutation extends ModelMutation<any, any> {
  mutate() {
    this.mutateType((model) => {
      renameForGraphQL(model);
    });
    super.mutate();
  }
}

