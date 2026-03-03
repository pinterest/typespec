import { type ComponentContext, createNamedContext, useContext } from "@alloy-js/core";

/**
 * Type resolution mode for context-aware type name resolution
 */
export type TypeResolutionMode = "input" | "output";

/**
 * Context value for type resolution
 */
export interface GraphQLTypeResolutionContextValue {
  /** Whether we're resolving types in input or output context */
  mode: TypeResolutionMode;
}

/**
 * Context provider for type resolution mode
 */
export const GraphQLTypeResolutionContext: ComponentContext<GraphQLTypeResolutionContextValue> =
  createNamedContext<GraphQLTypeResolutionContextValue>("TypeResolution");
