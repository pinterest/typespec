import {
  emitFile,
  getEncode,
  interpolatePath,
  isArrayModelType,
  isUnknownType,
  navigateTypesInNamespace,
  resolvePath,
  type EmitContext,
  type Enum,
  type Model,
  type ModelProperty,
  type Namespace,
  type Operation,
  type Program,
  type Scalar,
  type Type,
  type Union,
} from "@typespec/compiler";
import { renderSchema, printSchema } from "@alloy-js/graphql";
import { isInterface } from "./lib/interface.js";
import { getOperationKind } from "./lib/operation-kind.js";
import { type GraphQLEmitterOptions, reportDiagnostic } from "./lib.js";
import { resolveTypeUsage, GraphQLTypeUsage, type TypeUsageResolver } from "./type-usage.js";
import { listSchemas } from "./lib/schema.js";
import { createGraphQLMutationEngine } from "./mutation-engine/index.js";
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
import type { ClassifiedTypes, ModelVariants, ScalarVariant } from "./context/index.js";
import { getNullableUnionType } from "./lib/type-utils.js";
import { getScalarMapping } from "./lib/scalar-mappings.js";

/**
 * Main emitter entry point for GraphQL SDL generation (component-based)
 */
export async function $onEmit(context: EmitContext<GraphQLEmitterOptions>) {
  const schemas = listSchemas(context.program);
  if (schemas.length === 0) {
    schemas.push({ type: context.program.getGlobalNamespaceType() });
  }

  // Emit each schema
  for (const schema of schemas) {
    await emitSchema(context, schema);
  }
}

/**
 * Emit a single GraphQL schema
 */
async function emitSchema(
  context: EmitContext<GraphQLEmitterOptions>,
  schema: { type: Namespace; name?: string }
) {
  // Phase 1: Type usage tracking - Determine which types are reachable from operations
  // Must run before mutation so we can filter on original (pre-clone) type objects
  const omitUnreachable = context.options["omit-unreachable-types"] ?? false;
  const typeUsage = resolveTypeUsage(context.program, schema.type, omitUnreachable);

  // Phase 2: Mutation - Transform TypeSpec types with GraphQL naming conventions
  // Unreachable enums/unions are skipped during mutation (avoids identity mismatch with cloned objects)
  const { mutatedTypes, scalarSpecifications, originalToMutated } = mutateTypes(context, schema, typeUsage);

  // Phase 3: Classification - Separate types by category
  const classifiedTypes = classifyTypes(
    context.program,
    mutatedTypes,
    originalToMutated,
    typeUsage
  );

  // Phase 4: Build model variant lookups
  const modelVariants = buildModelVariants(classifiedTypes);

  // Phase 5: Component-based SDL Generation
  const contextValue = {
    classifiedTypes,
    modelVariants,
    scalarSpecifications,
  };

  // Determine output file name
  const outputFilePattern = context.options["output-file"] ?? "{schema-name}.graphql";
  const schemaName = schema.name || "schema";
  const outputFileName = outputFilePattern.includes("{schema-name}")
    ? interpolatePath(outputFilePattern, { "schema-name": schemaName })
    : outputFilePattern;

  // Render the schema using Alloy's renderSchema to get a GraphQLSchema object.
  // We disable name policy validation because TypeSpec has already validated names and applied mutations.
  const graphqlSchema = renderSchema(
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
    { namePolicy: null } // Disable naming policy - TypeSpec has already applied naming conventions
  );

  // Convert the GraphQLSchema to SDL string using graphql-js printSchema
  const rawSdl = printSchema(graphqlSchema);

  if (!rawSdl || rawSdl.trim().length === 0) {
    reportDiagnostic(context.program, {
      code: "empty-schema",
      target: schema.type,
    });
    return;
  }

  // Ensure file ends with blank line (two newlines)
  const sdl = rawSdl.trimEnd() + "\n\n";

  // Write to file
  let outputPath = outputFileName;
  if (!outputPath.startsWith("/")) {
    outputPath = resolvePath(context.emitterOutputDir, outputPath);
  }

  await emitFile(context.program, {
    path: outputPath,
    content: sdl,
  });
}


/**
 * Phase 2: Mutate all types using the mutation engine.
 * Unreachable enums/unions are skipped based on the type usage resolver.
 */
function mutateTypes(context: EmitContext<GraphQLEmitterOptions>, schema: { type: Namespace }, typeUsage: TypeUsageResolver) {
  const engine = createGraphQLMutationEngine(context.program);
  const mutatedModels: Model[] = [];
  const mutatedEnums: Enum[] = [];
  const mutatedScalars: Scalar[] = [];
  const mutatedUnions: Union[] = [];
  const mutatedOperations: Operation[] = [];
  const wrapperModels: Model[] = [];
  const scalarSpecifications = new Map<string, string>();
  const originalToMutated = new Map<Model, Model>();
  const processedScalars = new Set<string>(); // Track processed scalar names to avoid duplicates
  const scalarVariantsMap = new Map<string, ScalarVariant>(); // Track scalar variants for @encode mappings

  // Helper to process a scalar (avoid duplicates)
  const processScalar = (node: Scalar): void => {
    const isDirectGraphQLBuiltin =
      context.program.checker.isStdType(node, "string") ||
      context.program.checker.isStdType(node, "int32") ||
      context.program.checker.isStdType(node, "float32") ||
      context.program.checker.isStdType(node, "float64") ||
      context.program.checker.isStdType(node, "boolean");

    if (isDirectGraphQLBuiltin) return;

    const mutation = engine.mutateScalar(node);
    const graphqlName = mutation.mutatedType.name;

    // Only add if we haven't seen this scalar name before
    // (e.g., both decimal and decimal128 map to BigDecimal)
    if (!processedScalars.has(graphqlName)) {
      processedScalars.add(graphqlName);
      mutatedScalars.push(mutation.mutatedType);

      // Store specification URL if available
      if (mutation.specificationUrl) {
        scalarSpecifications.set(graphqlName, mutation.specificationUrl);
      }
    }
  };

  // Helper to collect scalar variants from properties/parameters with @encode
  const processScalarVariant = (target: ModelProperty): void => {
    if (isUnknownType(target.type)) {
      if (!scalarVariantsMap.has('Unknown')) {
        scalarVariantsMap.set('Unknown', {
          sourceScalar: target.type,
          encoding: 'default',
          graphqlName: 'Unknown',
          specificationUrl: undefined,
        });
      }
      return;
    }
    if (target.type.kind === "Scalar" && context.program.checker.isStdType(target.type)) {
      const encodeData = getEncode(context.program, target);
      const encoding = encodeData?.encoding;
      const mapping = getScalarMapping(context.program, target.type, encoding);
      if (mapping && !scalarVariantsMap.has(mapping.graphqlName)) {
        scalarVariantsMap.set(mapping.graphqlName, {
          sourceScalar: target.type,
          encoding: encoding || 'default',
          graphqlName: mapping.graphqlName,
          specificationUrl: mapping.specificationUrl,
        });
      }
    }
  };

  navigateTypesInNamespace(schema.type, {
    model: (node: Model) => {
      const mutation = engine.mutateModel(node);
      mutatedModels.push(mutation.mutatedType);
      originalToMutated.set(node, mutation.mutatedType);
    },
    enum: (node: Enum) => {
      if (typeUsage.isUnreachable(node)) return;
      const mutation = engine.mutateEnum(node);
      mutatedEnums.push(mutation.mutatedType);
    },
    scalar: (node: Scalar) => {
      processScalar(node);
    },
    union: (node: Union) => {
      // Skip nullable unions (e.g., string | null) - they're not emitted as union declarations
      if (getNullableUnionType(node) !== undefined) {
        return;
      }
      if (typeUsage.isUnreachable(node)) return;
      const mutation = engine.mutateUnion(node);
      mutatedUnions.push(mutation.mutatedType);
      // Collect wrapper models created by the mutation
      wrapperModels.push(...mutation.wrapperModels);
    },
    operation: (node: Operation) => {
      // INVARIANT: Operations are passed through unmutated. This is load-bearing:
      // 1. typeUsage walked operation params/returns on original types to mark input/output.
      // 2. classifyTypes reverse-maps mutated models to originals via originalToMutated.
      //    Operations must reference original types for this mapping to work.
      mutatedOperations.push(node);
    },
  });

  // Collect referenced scalars from model properties and operations.
  // Standard library scalars like int64, utcDateTime are not declared in the schema,
  // but are referenced in model properties — we need to collect and mutate them.
  const visitedTypes = new Set<Type>(); // Track visited types to avoid infinite recursion on circular references

  const collectReferencedScalars = (type: Type): void => {
    // Prevent infinite recursion on circular references
    if (visitedTypes.has(type)) {
      return;
    }
    visitedTypes.add(type);

    if (type.kind === "Scalar") {
      processScalar(type);
    } else if (type.kind === "Model" && isArrayModelType(context.program, type)) {
      // Handle array types
      if (type.indexer?.value) {
        collectReferencedScalars(type.indexer.value);
      }
    } else if (type.kind === "Model") {
      // Handle model properties
      for (const prop of type.properties.values()) {
        collectReferencedScalars(prop.type);
      }
    } else if (type.kind === "Union") {
      // Handle union variants
      for (const variant of type.variants.values()) {
        collectReferencedScalars(variant.type);
      }
    }
  };

  // Collect referenced scalars and scalar variants from model properties and operations.
  // Uses original (pre-mutation) models because mutated type refs won't match processedScalars.
  // Also collects @encode-based scalar variants in the same pass to avoid a second iteration.
  const originalModels = Array.from(originalToMutated.keys());
  for (const model of originalModels) {
    for (const prop of model.properties.values()) {
      collectReferencedScalars(prop.type);
      processScalarVariant(prop);
    }
  }

  for (const op of mutatedOperations) {
    for (const param of op.parameters.properties.values()) {
      collectReferencedScalars(param.type);
      processScalarVariant(param);
    }
    collectReferencedScalars(op.returnType);
  }

  return {
    mutatedTypes: {
      models: mutatedModels,
      enums: mutatedEnums,
      scalars: mutatedScalars,
      unions: mutatedUnions,
      operations: mutatedOperations,
      wrapperModels,
      scalarVariants: Array.from(scalarVariantsMap.values()),
    },
    scalarSpecifications,
    originalToMutated,
  };
}

/**
 * Phase 3: Classify types into categories (interfaces, output types, input types, operations)
 */
function classifyTypes(
  program: Program,
  mutatedTypes: ReturnType<typeof mutateTypes>["mutatedTypes"],
  originalToMutated: Map<Model, Model>,
  typeUsage: TypeUsageResolver
): ClassifiedTypes {
  const interfaces: Model[] = [];
  const outputModels: Model[] = [];
  const inputModels: Model[] = [];
  const queries: Operation[] = [];
  const mutations: Operation[] = [];
  const subscriptions: Operation[] = [];

  // Create reverse mapping
  const mutatedToOriginal = new Map<Model, Model>();
  for (const [orig, mut] of originalToMutated) {
    mutatedToOriginal.set(mut, orig);
  }

  // Classify models
  for (const model of mutatedTypes.models) {
    // Skip unreachable types when omit-unreachable-types is enabled
    const originalModel = mutatedToOriginal.get(model) || model;
    if (typeUsage.isUnreachable(originalModel)) {
      continue;
    }

    // Check @Interface on the original (pre-clone) model, since decorator state
    // is stored against original type identity, not mutated clones.
    if (isInterface(program, originalModel)) {
      interfaces.push(model);
    } else {
      const usage = typeUsage.getUsage(originalModel);
      const usedAsInput = usage?.has(GraphQLTypeUsage.Input) ?? false;
      const usedAsOutput = usage?.has(GraphQLTypeUsage.Output) ?? false;

      if (!usedAsInput && !usedAsOutput) {
        // Reachable but not referenced by any operation — default to Output
        // (preserves behavior for types included via omit-unreachable-types=false)
        outputModels.push(model);
      } else {
        if (usedAsOutput) outputModels.push(model);
        if (usedAsInput) inputModels.push(model);
      }
    }
  }

  // Add wrapper models created by union mutations (always used as output)
  outputModels.push(...mutatedTypes.wrapperModels);

  // Classify operations by kind
  for (const op of mutatedTypes.operations) {
    const kind = getOperationKind(program, op);
    if (kind === "Query") queries.push(op);
    else if (kind === "Mutation") mutations.push(op);
    else if (kind === "Subscription") subscriptions.push(op);
  }

  return {
    interfaces,
    outputModels,
    inputModels,
    enums: mutatedTypes.enums,
    scalars: mutatedTypes.scalars,
    scalarVariants: mutatedTypes.scalarVariants,
    unions: mutatedTypes.unions,
    queries,
    mutations,
    subscriptions,
  };
}

/**
 * Build model variant lookups for checking which variants exist
 */
function buildModelVariants(classifiedTypes: ClassifiedTypes): ModelVariants {
  const modelVariants: ModelVariants = {
    outputModels: new Map(),
    inputModels: new Map(),
  };

  classifiedTypes.outputModels.forEach((m) => modelVariants.outputModels.set(m.name, m));
  classifiedTypes.inputModels.forEach((m) => modelVariants.inputModels.set(m.name, m));

  return modelVariants;
}


