import { type Model, getDoc } from "@typespec/compiler";
import * as gql from "@alloy-js/graphql";
import { useTsp } from "@typespec/emitter-framework";
import { Field, OperationField } from "../fields/index.js";
import { getComposition } from "../../lib/interface.js";
import { getOperationFields } from "../../lib/operation-fields.js";

export interface ObjectTypeProps {
  /** The object type to render */
  type: Model;
}

/**
 * Renders a GraphQL object type declaration
 *
 * Handles:
 * - Regular fields from model properties
 * - Interface implementations via @compose
 * - Operation fields via @operationFields
 */
export function ObjectType(props: ObjectTypeProps) {
  const { program } = useTsp();
  const doc = getDoc(program, props.type);
  const properties = Array.from(props.type.properties.values());
  const implementations = getComposition(program, props.type);
  const operationFields = getOperationFields(program, props.type);

  // Convert interface implementations to string references
  const implementsRefs = implementations?.map((iface) => iface.name) || [];

  return (
    <gql.ObjectType
      name={props.type.name}
      description={doc}
      interfaces={implementsRefs}
    >
      {properties.map((prop) => (
        <Field property={prop} isInput={false} />
      ))}
      {Array.from(operationFields).map((op) => (
        <OperationField operation={op} />
      ))}
    </gql.ObjectType>
  );
}
