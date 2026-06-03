import { type Scalar, getDoc } from "@typespec/compiler";
import * as gql from "@alloy-js/graphql";
import { useTsp } from "@typespec/emitter-framework";

export interface ScalarTypeProps {
  /** The scalar type to render */
  type: Scalar;
  /** Optional @specifiedBy URL for the scalar */
  specificationUrl?: string;
}

/**
 * Renders a GraphQL scalar type declaration with optional @specifiedBy directive
 */
export function ScalarType(props: ScalarTypeProps) {
  const { program } = useTsp();
  const doc = getDoc(program, props.type);

  return (
    <gql.ScalarType
      name={props.type.name}
      description={doc}
      specifiedByUrl={props.specificationUrl}
    />
  );
}
