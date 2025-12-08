import { OperationMutation } from "@typespec/mutator-framework";
import { renameForGraphQL } from "../transforms/index.js";

export class GraphQLOperationMutation extends OperationMutation<any, any> {
  mutate() {
    this.mutateType((operation) => {
      renameForGraphQL(operation);
    });
    super.mutate();
  }
}

