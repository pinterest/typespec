import { type Operation } from "@typespec/compiler";
import * as gql from "@alloy-js/graphql";
import { OperationField } from "../fields/index.js";

export interface SubscriptionTypeProps {
  /** Subscription operations to render as fields */
  operations: Operation[];
}

/**
 * Renders the GraphQL Subscription root type using Alloy's Subscription component
 *
 * Only renders if operations exist (Subscription is optional in GraphQL)
 */
export function SubscriptionType(props: SubscriptionTypeProps) {
  // Don't render if no operations
  if (props.operations.length === 0) {
    return null;
  }

  return (
    <gql.Subscription>
      {props.operations.map((op) => (
        <OperationField operation={op} />
      ))}
    </gql.Subscription>
  );
}
