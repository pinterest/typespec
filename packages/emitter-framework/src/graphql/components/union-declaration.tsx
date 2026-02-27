import * as gql from "@alloy-js/graphql";
import type { Union } from "@typespec/compiler";
import { useTsp } from "../../core/context/tsp-context.js";
import { reportDiagnostic } from "../../lib.js";
import { reportGraphqlDiagnostic } from "../lib.js";

export interface UnionDeclarationProps {
  name?: string;
  type: Union;
  doc?: string;
}

export function UnionDeclaration(props: UnionDeclarationProps) {
  const { $ } = useTsp();
  const type = props.type;

  if (!type.name || type.name === "") {
    reportDiagnostic($.program, { code: "type-declaration-missing-name", target: type });
  }

  const name = props.name ?? type.name!;
  const doc = props.doc ?? $.type.getDoc(type) ?? undefined;

  // GraphQL unions can only contain object types. Filter to named model members.
  const validMembers: string[] = [];
  for (const variant of type.variants.values()) {
    const variantType = variant.type;
    if (variantType.kind === "Model" && variantType.name && !$.array.is(variantType) && !$.record.is(variantType)) {
      validMembers.push(variantType.name);
    } else {
      reportGraphqlDiagnostic($.program, {
        code: "graphql-unsupported-type",
        target: variant,
      });
    }
  }

  return (
    <gql.UnionType name={name} description={doc} members={validMembers} />
  );
}
