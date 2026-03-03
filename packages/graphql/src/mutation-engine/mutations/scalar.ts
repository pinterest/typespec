import type { MemberType, Scalar } from "@typespec/compiler";
import {
  SimpleScalarMutation,
  type MutationInfo,
  type SimpleMutationEngine,
  type SimpleMutationOptions,
  type SimpleMutations,
} from "@typespec/mutator-framework";
import { getScalarMapping, isStdScalar } from "../../lib/scalar-mappings.js";
import { getSpecifiedBy, setSpecifiedByUrl } from "../../lib/specified-by.js";
import { sanitizeNameForGraphQL } from "../../lib/type-utils.js";

/** GraphQL-specific Scalar mutation */
export class GraphQLScalarMutation extends SimpleScalarMutation<SimpleMutationOptions> {
  constructor(
    engine: SimpleMutationEngine<SimpleMutations<SimpleMutationOptions>>,
    sourceType: Scalar,
    referenceTypes: MemberType[],
    options: SimpleMutationOptions,
    info: MutationInfo,
  ) {
    super(engine, sourceType, referenceTypes, options, info);
  }

  mutate() {
    const tk = this.engine.$;
    const program = tk.program;
    const mapping = getScalarMapping(program, this.sourceType);

    if (mapping) {
      // Standard library scalar that maps to a custom GraphQL scalar (e.g. int64 → Long)
      this.mutationNode.mutate((scalar) => {
        scalar.name = mapping.graphqlName;
      });
    } else if (!isStdScalar(tk, this.sourceType)) {
      // User-defined custom scalar — sanitize the name
      this.mutationNode.mutate((scalar) => {
        scalar.name = sanitizeNameForGraphQL(scalar.name);
      });
    }
    // Built-in std scalars (string, boolean, int32, etc.) are left untouched —
    // they map to GraphQL built-in types and are resolved at emit time.

    // Apply @specifiedBy to the mutated scalar: explicit decorator on source wins, then mapping table
    const specUrl =
      getSpecifiedBy(program, this.sourceType) ?? mapping?.specificationUrl;
    if (specUrl) {
      setSpecifiedByUrl(program, this.mutatedType, specUrl);
    }

    super.mutate();
  }
}
