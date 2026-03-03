import type { MemberType, Scalar } from "@typespec/compiler";
import {
  SimpleScalarMutation,
  type MutationInfo,
  type SimpleMutationEngine,
  type SimpleMutationOptions,
  type SimpleMutations,
} from "@typespec/mutator-framework";
import { getScalarMapping, isGraphQLBuiltinScalar, isStdScalar } from "../../lib/scalar-mappings.js";
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
    const isDirectStd = isStdScalar(tk, this.sourceType);

    // Skip GraphQL builtins (string, boolean, int32, float32, float64) entirely.
    // These map to built-in GraphQL types and must never be renamed, even though
    // they may inherit a mapping from an ancestor via the extends chain
    // (e.g. float32 → float → numeric → "Numeric").
    const isBuiltin = isGraphQLBuiltinScalar(this.sourceType);

    if (mapping && isDirectStd && !isBuiltin) {
      // Std library scalar that maps to a custom GraphQL scalar (e.g. int64 → Long)
      this.mutationNode.mutate((scalar) => {
        scalar.name = mapping.graphqlName;
        scalar.baseScalar = undefined;
      });
    } else if (!isDirectStd) {
      // User-defined custom scalar — sanitize name, strip extends.
      // May still have a mapping via extends chain (e.g. scalar MyInt extends int64),
      // which is used for @specifiedBy below but not for renaming.
      this.mutationNode.mutate((scalar) => {
        scalar.name = sanitizeNameForGraphQL(scalar.name);
        scalar.baseScalar = undefined;
      });
    }
    // Built-in std scalars (string, boolean, int32, etc.) are left untouched —
    // they map to GraphQL built-in types and are resolved at emit time.

    // Apply @specifiedBy: explicit decorator on source wins, then mapping table
    // (mapping may come from an ancestor via the extends chain)
    const specUrl =
      getSpecifiedBy(program, this.sourceType) ?? mapping?.specificationUrl;
    if (specUrl) {
      setSpecifiedByUrl(program, this.mutatedType, specUrl);
    }

    super.mutate();
  }
}
