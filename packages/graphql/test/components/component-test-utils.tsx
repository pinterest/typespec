import { type Children } from "@alloy-js/core";
import * as gql from "@alloy-js/graphql";
import { renderSchema, printSchema } from "@alloy-js/graphql";
import type { Program } from "@typespec/compiler";
import { GraphQLSchema } from "../../src/components/graphql-schema.js";
import type { GraphQLSchemaContextValue } from "../../src/context/index.js";

/**
 * Renders GraphQL components in isolation and returns the printed SDL.
 *
 * Wraps children in the required context providers (TspContext + GraphQLSchemaContext)
 * and always includes a placeholder Query type (required by graphql-js).
 *
 * Tests should assert on fragments of the returned SDL, ignoring the placeholder Query.
 */
export function renderComponentToSDL(
  program: Program,
  children: Children,
  contextOverrides?: Partial<GraphQLSchemaContextValue>,
): string {
  const contextValue: GraphQLSchemaContextValue = {
    classifiedTypes: {
      interfaces: [],
      outputModels: [],
      inputModels: [],
      enums: [],
      scalars: [],
      scalarVariants: [],
      unions: [],
      queries: [],
      mutations: [],
      subscriptions: [],
    },
    modelVariants: { outputModels: new Map(), inputModels: new Map() },
    scalarSpecifications: new Map(),
    ...contextOverrides,
  };

  const schema = renderSchema(
    <GraphQLSchema program={program} contextValue={contextValue}>
      {children}
      <gql.Query>
        <gql.Field name="_placeholder" type={gql.Boolean} nonNull={false} />
      </gql.Query>
    </GraphQLSchema>,
    { namePolicy: null },
  );

  return printSchema(schema);
}
