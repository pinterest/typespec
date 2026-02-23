import type { EmitContext } from "@typespec/compiler";
import { resolvePath } from "@typespec/compiler";
import { createGraphQLEmitter } from "./graphql-emitter.js";
import type { GraphQLEmitterOptions } from "./lib.js";

const defaultOptions = {
  "omit-unreachable-types": false,
} as const;

export async function $onEmit(context: EmitContext<GraphQLEmitterOptions>) {
  const options = resolveOptions(context);
  const emitter = createGraphQLEmitter(context, options);
  await emitter.emitGraphQL();
}

export interface ResolvedGraphQLEmitterOptions {
  outputFile: string;
  omitUnreachableTypes: boolean;
}

export function resolveOptions(
  context: EmitContext<GraphQLEmitterOptions>,
): ResolvedGraphQLEmitterOptions {
  const resolvedOptions = { ...defaultOptions, ...context.options };
  const outputFile = resolvedOptions["output-file"] ?? "{schema-name}.graphql";

  return {
    outputFile: resolvePath(context.emitterOutputDir, outputFile),
    omitUnreachableTypes: resolvedOptions["omit-unreachable-types"],
  };
}
