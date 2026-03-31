import { For } from "@alloy-js/core";
import * as gql from "@alloy-js/graphql";
import type { Model } from "@typespec/compiler";
import { isNeverType } from "@typespec/compiler";
import { useTsp } from "../../core/context/tsp-context.js";
import { getTypeReference } from "./type-expression.js";

export interface ObjectTypeDeclarationProps {
  name?: string;
  type: Model;
  doc?: string;
}

export function ObjectTypeDeclaration(props: ObjectTypeDeclarationProps) {
  const { $ } = useTsp();
  const type = props.type;
  const name = props.name ?? type.name!;
  const doc = props.doc ?? $.type.getDoc(type) ?? undefined;
  const properties = Array.from($.model.getProperties(type).values()).filter(
    (prop) => !isNeverType(prop.type),
  );

  return (
    <gql.ObjectType name={name} description={doc}>
      <For each={properties}>
        {(prop) => {
          const propDoc = $.type.getDoc(prop) ?? undefined;
          return (
            <gql.Field
              name={prop.name}
              type={getTypeReference($, prop.type)}
              nonNull={!prop.optional}
              description={propDoc}
            />
          );
        }}
      </For>
    </gql.ObjectType>
  );
}
