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
import type { GraphQLSchemaContextValue } from "./context/index.js";

/**
 * Main emitter entry point for GraphQL SDL generation.
 *
 * Runs the data pipeline (type usage → mutation) and passes the result to
 * `renderSchema`, which renders via Alloy components and writes the SDL file.
 */
export async function $onEmit(context: EmitContext<GraphQLEmitterOptions>) {
  const schemas = listSchemas(context.program);
  if (schemas.length === 0) {
    schemas.push({ type: context.program.getGlobalNamespaceType() });
  }

  for (const schema of schemas) {
    const mutated = await emitSchema(context, schema);
    if (mutated) {
      await renderSchema(context, schema, mutated);
    }
  }
}

/**
 * Run the data pipeline for a single GraphQL schema.
 *
 * Returns the `MutatedSchema` on success, or `undefined` if the schema
 * cannot be built (e.g., no query root) — in which case a diagnostic has
 * already been emitted.
 */
async function emitSchema(
  context: EmitContext<GraphQLEmitterOptions>,
  schema: { type: Namespace; name?: string },
): Promise<MutatedSchema | undefined> {
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

  return mutated;
}

/**
 * Phase 3: Render the mutated schema to GraphQL SDL via Alloy components,
 * then write the SDL to the emitter output directory.
 */
async function renderSchema(
  context: EmitContext<GraphQLEmitterOptions>,
  schema: { type: Namespace; name?: string },
  mutated: MutatedSchema,
): Promise<void> {
  // Wrapper models from union mutations are always output — fold them into
  // the output bucket for the renderer.
  const outputModels = [...mutated.outputModels, ...mutated.wrapperModels];

  // Build the TypeGraph context - components access the type graph through context,
  // while specific data is passed via props
  const contextValue: GraphQLSchemaContextValue = {
    typeGraph: {
      globalNamespace: schema.type,
    },
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
      <ScalarVariantTypes
        scalarVariants={mutated.scalarVariants}
        scalars={mutated.scalars}
        scalarSpecifications={mutated.scalarSpecifications}
      />
      <EnumTypes enums={mutated.enums} />
      <UnionTypes unions={mutated.unions} />
      <InterfaceTypes interfaces={mutated.interfaces} />
      <ObjectTypes models={outputModels} />
      <InputTypes models={mutated.inputModels} />
      <QueryType operations={mutated.queries} />
      <MutationType operations={mutated.mutations} />
      <SubscriptionType operations={mutated.subscriptions} />
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
