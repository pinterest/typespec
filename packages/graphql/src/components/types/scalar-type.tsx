import { type Scalar, getDoc } from "@typespec/compiler";
import * as gql from "@alloy-js/graphql";
import { useTsp } from "@typespec/emitter-framework";
import { useGraphQLSchema } from "../../context/index.js";

export interface ScalarTypeProps {
  /** The scalar type to render */
  type: Scalar;
}

/**
 * Renders a GraphQL scalar type declaration with optional @specifiedBy directive
 */
export function ScalarType(props: ScalarTypeProps) {
  const { program } = useTsp();
  const { scalarSpecifications } = useGraphQLSchema();
  const doc = getDoc(program, props.type);
  const specificationUrl = scalarSpecifications.get(props.type.name);

  return (
    <gql.ScalarType
      name={props.type.name}
      description={doc}
      specifiedByUrl={specificationUrl}
    />
  );
}
