import type { Model } from "@typespec/compiler";
import * as gql from "@alloy-js/graphql";
import { useTsp } from "@typespec/emitter-framework";
import { Field } from "../fields/index.js";

export interface InputTypeProps {
  /** The input type to render */
  type: Model;
}

/**
 * Renders a GraphQL input type declaration.
 */
export function InputType(props: InputTypeProps) {
  const { $ } = useTsp();
  const doc = $.type.getDoc(props.type);
  const properties = Array.from(props.type.properties.values());

  return (
    <gql.InputObjectType name={props.type.name} description={doc}>
      {properties.map((prop) => (
        <Field property={prop} isInput={true} />
      ))}
    </gql.InputObjectType>
  );
}
