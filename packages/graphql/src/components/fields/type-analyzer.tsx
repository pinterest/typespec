import { type Type } from "@typespec/compiler";
import { type Children, useContext } from "@alloy-js/core";
import { useTsp } from "@typespec/emitter-framework";
import { GraphQLTypeResolutionContext, useGraphQLSchema } from "../../context/index.js";
import { type TypeInfo, analyzeType } from "./type-analysis.js";

export interface TypeAnalyzerProps {
  type: Type;
  isOptional: boolean;
  /** The property or parameter that contains the type (for @encode checking) */
  targetType?: Type;
  key?: string;
  children: (typeInfo: TypeInfo) => Children;
}

/**
 * Helper component to analyze a TypeSpec type and extract GraphQL type information.
 * Resolves the type using the current input/output context and returns TypeInfo
 * via render props (children function).
 */
export function TypeAnalyzer(props: TypeAnalyzerProps) {
  const { program } = useTsp();
  const { modelVariants } = useGraphQLSchema();
  const context = useContext(GraphQLTypeResolutionContext);
  const mode = context?.mode ?? "output";

  const typeInfo = analyzeType(
    props.type,
    props.isOptional,
    mode,
    program,
    modelVariants,
    props.targetType
  );

  return props.children(typeInfo);
}
