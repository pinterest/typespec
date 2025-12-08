import { ScalarMutation } from "@typespec/mutator-framework";
import { sanitizeNameForGraphQL } from "../../lib/type-utils.js";

export class GraphQLScalarMutation extends ScalarMutation<any, any> {
  mutate() {
    this.mutateType((scalar) => {
      scalar.name = sanitizeNameForGraphQL(scalar.name);
    });
    super.mutate();
  }
}

