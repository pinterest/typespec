import { type Operation } from "@typespec/compiler";
import * as gql from "@alloy-js/graphql";
import { OperationField } from "../fields/index.js";

export interface QueryTypeProps {
  /** Query operations to render as fields */
  operations: Operation[];
}

/**
 * Renders the GraphQL Query root type using Alloy's Query component.
 * Returns null if no query operations exist (the emitter will emit an
 * empty-schema diagnostic in that case).
 */
export function QueryType(props: QueryTypeProps) {
  if (props.operations.length === 0) {
    return null;
  }

  return (
    <gql.Query>
      {props.operations.map((op) => (
        <OperationField operation={op} />
      ))}
    </gql.Query>
  );
}
