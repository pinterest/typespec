import { type Operation } from "@typespec/compiler";
import * as gql from "@alloy-js/graphql";
import { Boolean as GraphQLBoolean } from "@alloy-js/graphql";
import { OperationField } from "../fields/index.js";

export interface QueryTypeProps {
  /** Query operations to render as fields */
  operations: Operation[];
}

/**
 * Renders the GraphQL Query root type using Alloy's Query component
 *
 * Query is always required in GraphQL. If no operations exist, renders a
 * placeholder field.
 */
export function QueryType(props: QueryTypeProps) {
  // Query is required, but may be empty - add placeholder
  if (props.operations.length === 0) {
    return (
      <gql.Query>
        <gql.Field
          name="_"
          type={GraphQLBoolean}
          nonNull={false}
          description="Placeholder field. No query operations were defined in the TypeSpec schema."
        />
      </gql.Query>
    );
  }

  return (
    <gql.Query>
      {props.operations.map((op) => (
        <OperationField operation={op} />
      ))}
    </gql.Query>
  );
}
