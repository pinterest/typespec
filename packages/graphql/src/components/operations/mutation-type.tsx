import { type Operation } from "@typespec/compiler";
import * as gql from "@alloy-js/graphql";
import { OperationField } from "../fields/index.js";

export interface MutationTypeProps {
  /** Mutation operations to render as fields */
  operations: Operation[];
}

/**
 * Renders the GraphQL Mutation root type using Alloy's Mutation component
 *
 * Only renders if operations exist (Mutation is optional in GraphQL)
 */
export function MutationType(props: MutationTypeProps) {
  // Don't render if no operations
  if (props.operations.length === 0) {
    return null;
  }

  return (
    <gql.Mutation>
      {props.operations.map((op) => (
        <OperationField operation={op} />
      ))}
    </gql.Mutation>
  );
}
