import { type ComponentContext, createNamedContext, useContext } from "@alloy-js/core";
import {
  type Model,
  type Enum,
  type Scalar,
  type Type,
  type Union,
  type Operation,
} from "@typespec/compiler";

/**
 * Classified types separated by category for schema generation
 */
export interface ClassifiedTypes {
  /** Interface types marked with @Interface */
  interfaces: Model[];
  /** Models used as output types (return values) */
  outputModels: Model[];
  /** Models used as input types (parameters) */
  inputModels: Model[];
  /** Enum types */
  enums: Enum[];
  /** Custom scalar types */
  scalars: Scalar[];
  /** Scalar variants for encoded scalars (e.g., bytes + base64 → Bytes) */
  scalarVariants: ScalarVariant[];
  /** Union types */
  unions: Union[];
  /** Query operations */
  queries: Operation[];
  /** Mutation operations */
  mutations: Operation[];
  /** Subscription operations */
  subscriptions: Operation[];
}

/**
 * Model variant lookups for quick checking whether output and/or input variants exist.
 * Used to determine when to append "Input" suffix during type resolution.
 */
export interface ModelVariants {
  /** Output model variants indexed by name */
  outputModels: Map<string, Model>;
  /** Input model variants indexed by name */
  inputModels: Map<string, Model>;
}

/**
 * Scalar variant information for encoded scalars.
 * When a scalar has @encode, we emit it as a different GraphQL scalar (e.g., bytes + base64 → Bytes)
 */
export interface ScalarVariant {
  /** The original TypeSpec scalar type (or Intrinsic for `unknown`) */
  sourceScalar: Scalar | Type;
  /** The encoding used (e.g., "base64", "rfc3339") */
  encoding: string;
  /** The GraphQL scalar name to emit (e.g., "Bytes", "UTCDateTime") */
  graphqlName: string;
  /** Optional specification URL for @specifiedBy directive */
  specificationUrl?: string;
}

/**
 * Context value containing GraphQL-specific schema information.
 *
 * For access to the TypeSpec program and typekit, use `useTsp()` from
 * `@typespec/emitter-framework` instead.
 */
export interface GraphQLSchemaContextValue {
  /** Classified types for schema generation */
  classifiedTypes: ClassifiedTypes;
  /** Model variant lookups for input/output type resolution */
  modelVariants: ModelVariants;
  /** Scalar specification URLs for @specifiedBy directives */
  scalarSpecifications: Map<string, string>;
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
      "useGraphQLSchema must be used within GraphQLSchemaContext.Provider. " +
      "Ensure the component is rendered inside <GraphQLSchema> from graphql-schema.tsx."
    );
  }

  return context;
}
