import { type Children } from "@alloy-js/core";
import type { Program } from "@typespec/compiler";
import { TspContext } from "@typespec/emitter-framework";
import {
  GraphQLSchemaContext,
  type GraphQLSchemaContextValue,
} from "../context/index.js";

export interface GraphQLSchemaProps {
  /** TypeSpec program instance */
  program: Program;
  /** Context value containing classified types and type maps */
  contextValue: GraphQLSchemaContextValue;
  /** Child components to render */
  children?: Children;
}

/**
 * Root component for GraphQL schema generation
 *
 * Provides TspContext (program + typekit) from @typespec/emitter-framework
 * and GraphQL-specific context to all child components.
 */
export function GraphQLSchema(props: GraphQLSchemaProps) {
  return (
    <TspContext.Provider value={{ program: props.program }}>
      <GraphQLSchemaContext.Provider value={props.contextValue}>
        {props.children}
      </GraphQLSchemaContext.Provider>
    </TspContext.Provider>
  );
}
