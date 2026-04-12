import { type Model, getDoc } from "@typespec/compiler";
import * as gql from "@alloy-js/graphql";
import { useTsp } from "@typespec/emitter-framework";
import { Field } from "../fields/index.js";

export interface InterfaceTypeProps {
  /** The interface type to render */
  type: Model;
}

/**
 * Renders a GraphQL interface type declaration
 *
 * Interfaces are marked with @Interface decorator in TypeSpec
 */
export function InterfaceType(props: InterfaceTypeProps) {
  const { program } = useTsp();
  const doc = getDoc(program, props.type);
  const properties = Array.from(props.type.properties.values());

  return (
    <gql.InterfaceType name={props.type.name} description={doc}>
      {properties.map((prop) => (
        <Field property={prop} isInput={false} />
      ))}
    </gql.InterfaceType>
  );
}
