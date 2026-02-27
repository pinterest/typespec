import { For } from "@alloy-js/core";
import * as gql from "@alloy-js/graphql";
import type { Enum, Union } from "@typespec/compiler";
import { useTsp } from "../../core/context/tsp-context.js";
import { reportDiagnostic } from "../../lib.js";

export interface EnumDeclarationProps {
  name?: string;
  type: Union | Enum;
  doc?: string;
}

export function EnumDeclaration(props: EnumDeclarationProps) {
  const { $ } = useTsp();
  let type: Enum;
  if ($.union.is(props.type)) {
    if (!$.union.isValidEnum(props.type)) {
      throw new Error("The provided union type cannot be represented as an enum");
    }
    type = $.enum.createFromUnion(props.type);
  } else {
    type = props.type;
  }

  if (!props.type.name || props.type.name === "") {
    reportDiagnostic($.program, { code: "type-declaration-missing-name", target: props.type });
  }

  const name = props.name ?? props.type.name!;
  const members = Array.from(type.members.entries());
  const doc = props.doc ?? $.type.getDoc(type) ?? undefined;

  return (
    <gql.EnumType name={name} description={doc}>
      <For each={members}>
        {([_key, value]) => {
          const memberDoc = $.type.getDoc(value) ?? undefined;
          return <gql.EnumValue name={value.name} description={memberDoc} />;
        }}
      </For>
    </gql.EnumType>
  );
}
