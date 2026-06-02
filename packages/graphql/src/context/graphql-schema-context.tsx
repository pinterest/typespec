import { type ComponentContext, createNamedContext, useContext } from "@alloy-js/core";
import type { Namespace } from "@typespec/compiler";

/**
 * A self-contained type world produced by the mutation pipeline.
 * The namespace contains all mutated types for the schema.
 */
export interface TypeGraph {
  readonly globalNamespace: Namespace;
}

/**
 * Context value containing the mutated type graph for schema generation.
 *
 * For access to the TypeSpec program and typekit, use `useTsp()` from
 * `@typespec/emitter-framework` instead.
 */
export interface GraphQLSchemaContextValue {
  typeGraph: TypeGraph;
}

/**
 * Context provider for GraphQL schema generation
 */
export const GraphQLSchemaContext: ComponentContext<GraphQLSchemaContextValue> =
  createNamedContext<GraphQLSchemaContextValue>("GraphQLSchema");

/**
 * Hook to access GraphQL schema context
 * @returns The GraphQL schema context value
 * @throws Error if used outside of GraphQLSchemaContext.Provider
 */
export function useGraphQLSchema(): GraphQLSchemaContextValue {
  const context = useContext(GraphQLSchemaContext);

  if (!context) {
    throw new Error(
      "useGraphQLSchema must be used within GraphQLSchemaContext.Provider.",
    );
  }

  return context;
}
