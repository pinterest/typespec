import { ScalarMutation } from "@typespec/mutator-framework";
import { renameForGraphQL } from "../transforms/index.js";

export class GraphQLScalarMutation extends ScalarMutation<any, any> {
  mutate() {
    this.mutateType((scalar) => {
      renameForGraphQL(scalar);
    });
    super.mutate();
  }
}

