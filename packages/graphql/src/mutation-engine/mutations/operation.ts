import { OperationMutation } from "@typespec/mutator-framework";
import { sanitizeNameForGraphQL } from "../../lib/type-utils.js";

export class GraphQLOperationMutation extends OperationMutation<any, any> {
  mutate() {
    this.mutateType((operation) => {
      operation.name = sanitizeNameForGraphQL(operation.name);
    });
    super.mutate();
  }
}

