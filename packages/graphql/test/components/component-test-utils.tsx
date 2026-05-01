import { type Children } from "@alloy-js/core";
import * as gql from "@alloy-js/graphql";
import { renderSchema, printSchema } from "@alloy-js/graphql";
import type { Program } from "@typespec/compiler";
import { GraphQLSchema } from "../../src/components/graphql-schema.js";
import type { GraphQLSchemaContextValue } from "../../src/context/index.js";

export interface RenderOptions {
  /** Context overrides for the GraphQL schema context */
  contextOverrides?: Partial<GraphQLSchemaContextValue>;
  /** Skip the placeholder Query type (use when testing QueryType component) */
  skipPlaceholderQuery?: boolean;
}

/**
 * Renders GraphQL components in isolation and returns the printed SDL.
 *
 * Wraps children in the required context providers (TspContext + GraphQLSchemaContext)
 * and includes a placeholder Query type by default (required by graphql-js).
 *
 * Tests should assert on fragments of the returned SDL, ignoring the placeholder Query.
 *
 * @param options - Either RenderOptions object or context overrides directly (for backwards compatibility)
 */
export function renderComponentToSDL(
  program: Program,
  children: Children,
  options?: RenderOptions | Partial<GraphQLSchemaContextValue>,
): string {
  // Backwards compatibility: if options doesn't have RenderOptions keys, treat it as contextOverrides
  const isRenderOptions = options && ("contextOverrides" in options || "skipPlaceholderQuery" in options);
  const { contextOverrides, skipPlaceholderQuery } = isRenderOptions
    ? (options as RenderOptions)
    : { contextOverrides: options as Partial<GraphQLSchemaContextValue> | undefined, skipPlaceholderQuery: false };
  const contextValue: GraphQLSchemaContextValue = {
    typeGraph: {
      globalNamespace: program.getGlobalNamespaceType(),
    },
    ...contextOverrides,
  };

  const schema = renderSchema(
    <GraphQLSchema program={program} contextValue={contextValue}>
      {children}
      {!skipPlaceholderQuery && (
        <gql.Query>
          <gql.Field name="_placeholder" type={gql.Boolean} nonNull={false} />
        </gql.Query>
      )}
    </GraphQLSchema>,
    { namePolicy: null },
  );

  return printSchema(schema);
}
