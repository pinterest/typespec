import {
  emitFile,
  interpolatePath,
  resolvePath,
  type EmitContext,
  type Namespace,
} from "@typespec/compiler";
import { renderSchema as renderAlloySchema, printSchema } from "@alloy-js/graphql";
import { type GraphQLEmitterOptions, reportDiagnostic } from "./lib.js";
import { listSchemas } from "./lib/schema.js";
import {
  createGraphQLMutationEngine,
  type MutatedSchema,
} from "./mutation-engine/index.js";
import { resolveTypeUsage } from "./type-usage.js";
import { GraphQLSchema } from "./components/graphql-schema.js";
import {
  ScalarVariantTypes,
  EnumTypes,
  UnionTypes,
  InterfaceTypes,
  ObjectTypes,
  InputTypes,
} from "./components/type-collections.js";
import { QueryType, MutationType, SubscriptionType } from "./components/operations/index.js";
import type { ClassifiedTypes, ModelVariants } from "./context/index.js";

/**
 * The bundle of schema-wide data the renderer needs to emit SDL.
 *
 * Produced by the data pipeline (type usage → mutation → variant lookups)
 * and consumed by `renderSchema`.
 */
export interface SchemaPipelineResult {
  mutated: MutatedSchema;
  modelVariants: ModelVariants;
}

/**
 * Main emitter entry point for GraphQL SDL generation.
 *
 * Runs the data pipeline (type usage → mutation → variant lookups) and
 * passes the result to `renderSchema`, which renders via Alloy components
 * and writes the SDL file.
 */
export async function $onEmit(context: EmitContext<GraphQLEmitterOptions>) {
  const schemas = listSchemas(context.program);
  if (schemas.length === 0) {
    schemas.push({ type: context.program.getGlobalNamespaceType() });
  }

  for (const schema of schemas) {
    const pipelineResult = await emitSchema(context, schema);
    if (pipelineResult) {
      await renderSchema(context, schema, pipelineResult);
    }
  }
}

/**
 * Run the data pipeline for a single GraphQL schema.
 *
 * Returns the `SchemaPipelineResult` on success, or `undefined` if the schema
 * cannot be built (e.g., no query root) — in which case a diagnostic has
 * already been emitted.
 */
async function emitSchema(
  context: EmitContext<GraphQLEmitterOptions>,
  schema: { type: Namespace; name?: string },
): Promise<SchemaPipelineResult | undefined> {
  // Phase 1: Type usage tracking — determine which types are reachable from operations.
  // Must run before mutation so the engine can filter on original (pre-clone) type objects.
  const omitUnreachable = context.options["omit-unreachable-types"] ?? false;
  const typeUsage = resolveTypeUsage(schema.type, omitUnreachable);

  // Phase 2: Mutation — transform TypeSpec types with GraphQL naming conventions
  // and classify the results. The engine consumes `typeUsage` internally to
  // filter unreachable types and route models into input/output/interface buckets.
  const engine = createGraphQLMutationEngine(context.program);
  const mutated = engine.mutateSchema(schema.type, typeUsage);

  // Report void-returning operations — GraphQL fields must return a type,
  // so these are excluded from the schema.
  for (const op of mutated.voidOperations) {
    reportDiagnostic(context.program, {
      code: "void-operation-return",
      format: { name: op.name },
      target: op,
    });
  }

  // GraphQL requires at least a Query root type. If there are no query operations,
  // the schema cannot be built. Emit a diagnostic and skip rendering.
  if (mutated.queries.length === 0) {
    reportDiagnostic(context.program, {
      code: "empty-schema",
      target: schema.type,
    });
    return undefined;
  }

  // Phase 3: Build model variant lookups for use by the renderer.
  const modelVariants = buildModelVariants(mutated);

  return { mutated, modelVariants };
}

/**
 * Phase 4: Render the pipeline result to GraphQL SDL via Alloy components,
 * then write the SDL to the emitter output directory.
 */
async function renderSchema(
  context: EmitContext<GraphQLEmitterOptions>,
  schema: { type: Namespace; name?: string },
  result: SchemaPipelineResult,
): Promise<void> {
  const { mutated, modelVariants } = result;

  // Wrapper models from union mutations are always output — fold them into
  // the output bucket for the renderer.
  const classifiedTypes: ClassifiedTypes = {
    interfaces: mutated.interfaces,
    outputModels: [...mutated.outputModels, ...mutated.wrapperModels],
    inputModels: mutated.inputModels,
    enums: mutated.enums,
    scalars: mutated.scalars,
    scalarVariants: mutated.scalarVariants,
    unions: mutated.unions,
    queries: mutated.queries,
    mutations: mutated.mutations,
    subscriptions: mutated.subscriptions,
  };

  const contextValue = {
    classifiedTypes,
    modelVariants,
    scalarSpecifications: mutated.scalarSpecifications,
  };

  // Determine output file name
  const outputFilePattern = context.options["output-file"] ?? "{schema-name}.graphql";
  const schemaName = schema.name || "schema";
  const outputFileName = interpolatePath(outputFilePattern, {
    "schema-name": schemaName,
  });

  // Render the schema using Alloy's renderSchema to get a GraphQLSchema object.
  // We disable name policy validation because TypeSpec has already validated names and applied mutations.
  const graphqlSchema = renderAlloySchema(
    <GraphQLSchema program={context.program} contextValue={contextValue}>
      <ScalarVariantTypes />
      <EnumTypes />
      <UnionTypes />
      <InterfaceTypes />
      <ObjectTypes />
      <InputTypes />
      <QueryType operations={classifiedTypes.queries} />
      <MutationType operations={classifiedTypes.mutations} />
      <SubscriptionType operations={classifiedTypes.subscriptions} />
    </GraphQLSchema>,
    { namePolicy: null },
  );

  // Convert the GraphQLSchema to SDL string using graphql-js printSchema
  const rawSdl = printSchema(graphqlSchema);

  // Ensure file ends with blank line (two newlines)
  const sdl = rawSdl.trimEnd() + "\n\n";

  // Write to file
  const outputPath = resolvePath(context.emitterOutputDir, outputFileName);

  await emitFile(context.program, {
    path: outputPath,
    content: sdl,
    newLine: context.options["new-line"] ?? "lf",
  });
}

/**
 * Build model variant lookups (name → Model) for checking which variants exist.
 * Used by the renderer to decide when to append the "Input" suffix during type
 * resolution.
 */
function buildModelVariants(mutated: MutatedSchema): ModelVariants {
  const modelVariants: ModelVariants = {
    outputModels: new Map(),
    inputModels: new Map(),
  };

  for (const model of mutated.outputModels) {
    modelVariants.outputModels.set(model.name, model);
  }
  for (const model of mutated.inputModels) {
    modelVariants.inputModels.set(model.name, model);
  }
  // Wrapper models are always output variants — include them for name lookups too.
  for (const model of mutated.wrapperModels) {
    modelVariants.outputModels.set(model.name, model);
  }

  return modelVariants;
}
