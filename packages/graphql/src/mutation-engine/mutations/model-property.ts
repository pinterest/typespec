import { ModelPropertyMutation } from "@typespec/mutator-framework";
import { renameForGraphQL } from "../transforms/index.js";

export class GraphQLModelPropertyMutation extends ModelPropertyMutation<any, any> {
  mutate() {
    this.mutateType((property) => {
      renameForGraphQL(property);
    });
    super.mutate();
  }
}

