import {
  getEncode,
  isArrayModelType,
  isUnknownType,
  navigateTypesInNamespace,
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
import { isInterface } from "./lib/interface.js";
import { getOperationKind } from "./lib/operation-kind.js";
import type { GraphQLEmitterOptions } from "./lib.js";
import { resolveTypeUsage, GraphQLTypeUsage, type TypeUsageResolver } from "./type-usage.js";
import { listSchemas } from "./lib/schema.js";
import { createGraphQLMutationEngine, GraphQLTypeContext } from "./mutation-engine/index.js";
import type { ClassifiedTypes, ModelVariants, ScalarVariant } from "./context/index.js";
import { unwrapNullableUnion } from "./lib/type-utils.js";
import { getGraphQLBuiltinName, getScalarMapping } from "./lib/scalar-mappings.js";
import { getSpecifiedBy } from "./lib/specified-by.js";

/**
 * Main emitter entry point for GraphQL SDL generation.
 *
 * Runs the full data pipeline (type usage → mutation → classification) but
 * does not yet render output. Component-based SDL rendering will be added
 * in follow-up PRs.
 */
export async function $onEmit(context: EmitContext<GraphQLEmitterOptions>) {
  const schemas = listSchemas(context.program);
  if (schemas.length === 0) {
    schemas.push({ type: context.program.getGlobalNamespaceType() });
  }

  for (const schema of schemas) {
    await emitSchema(context, schema);
  }
}

/**
 * Process a single GraphQL schema through the data pipeline.
 */
async function emitSchema(
  context: EmitContext<GraphQLEmitterOptions>,
  schema: { type: Namespace; name?: string },
) {
  // Phase 1: Type usage tracking — determine which types are reachable from operations.
  // Must run before mutation so we can filter on original (pre-clone) type objects.
  const omitUnreachable = context.options["omit-unreachable-types"] ?? false;
  const typeUsage = resolveTypeUsage(schema.type, omitUnreachable);

  // Phase 2: Mutation — transform TypeSpec types with GraphQL naming conventions.
  // Unreachable enums/unions are skipped during mutation (avoids identity mismatch with cloned objects).
  const { mutatedTypes, scalarSpecifications, originalToMutated } = mutateTypes(
    context,
    schema,
    typeUsage,
  );

  // Phase 3: Classification — separate types by category.
  const classifiedTypes = classifyTypes(
    context.program,
    mutatedTypes,
    originalToMutated,
    typeUsage,
  );

  // Phase 4: Build model variant lookups.
  const _modelVariants = buildModelVariants(classifiedTypes);

  // Phase 5: Component-based SDL rendering.
  // TODO: Render using Alloy JSX components (added in follow-up PRs).
  void _modelVariants;
  void scalarSpecifications;
}

// ---------------------------------------------------------------------------
// Phase 2: Mutation
// ---------------------------------------------------------------------------

/**
 * Mutate all types in a schema namespace using the mutation engine.
 * Unreachable enums/unions are skipped based on the type usage resolver.
 */
function mutateTypes(
  context: EmitContext<GraphQLEmitterOptions>,
  schema: { type: Namespace },
  typeUsage: TypeUsageResolver,
) {
  const engine = createGraphQLMutationEngine(context.program);
  const mutatedModels: Model[] = [];
  const mutatedEnums: Enum[] = [];
  const mutatedScalars: Scalar[] = [];
  const mutatedUnions: Union[] = [];
  const mutatedOperations: Operation[] = [];
  const wrapperModels: Model[] = [];
  const scalarSpecifications = new Map<string, string>();
  const originalToMutated = new Map<Model, Model>();
  const processedScalars = new Set<string>();
  const scalarVariantsMap = new Map<string, ScalarVariant>();

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

    if (!processedScalars.has(graphqlName)) {
      processedScalars.add(graphqlName);
      mutatedScalars.push(mutation.mutatedType);

      const specUrl = getSpecifiedBy(context.program, mutation.mutatedType);
      if (specUrl) {
        scalarSpecifications.set(graphqlName, specUrl);
      }
    }
  };

  const processScalarVariant = (target: ModelProperty): void => {
    if (isUnknownType(target.type)) {
      if (!scalarVariantsMap.has("Unknown")) {
        scalarVariantsMap.set("Unknown", {
          sourceScalar: target.type,
          encoding: "default",
          graphqlName: "Unknown",
          specificationUrl: undefined,
        });
      }
      return;
    }
    if (
      target.type.kind === "Scalar" &&
      context.program.checker.isStdType(target.type) &&
      !getGraphQLBuiltinName(context.program, target.type)
    ) {
      const encodeData = getEncode(context.program, target);
      const encoding = encodeData?.encoding;
      const mapping = getScalarMapping(context.program, target.type, encoding);
      if (mapping && !scalarVariantsMap.has(mapping.graphqlName)) {
        scalarVariantsMap.set(mapping.graphqlName, {
          sourceScalar: target.type,
          encoding: encoding || "default",
          graphqlName: mapping.graphqlName,
          specificationUrl: mapping.specificationUrl,
        });
      }
    }
  };

  navigateTypesInNamespace(schema.type, {
    model: (node: Model) => {
      if (isArrayModelType(context.program, node)) return;
      const mutation = engine.mutateModel(node, GraphQLTypeContext.Output);
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
      // Skip nullable unions (e.g., string | null) — they're not union declarations.
      // Nullability for these is detected at render time in GraphQLTypeExpression.
      if (unwrapNullableUnion(node) !== undefined) {
        return;
      }
      if (typeUsage.isUnreachable(node)) return;
      const mutation = engine.mutateUnion(node, GraphQLTypeContext.Output);
      mutatedUnions.push(mutation.mutatedType as Union);
      wrapperModels.push(...mutation.wrapperModels);
    },
    operation: (node: Operation) => {
      // Operations are passed through unmutated. This is load-bearing:
      // typeUsage walked operation params/returns on original types to mark input/output.
      // classifyTypes reverse-maps mutated models via originalToMutated.
      mutatedOperations.push(node);
    },
  });

  // Collect referenced scalars from model properties and operations.
  // Standard library scalars like int64, utcDateTime are not declared in the schema,
  // but are referenced in model properties — we need to collect and mutate them.
  const visitedTypes = new Set<Type>();

  const collectReferencedScalars = (type: Type): void => {
    if (visitedTypes.has(type)) return;
    visitedTypes.add(type);

    if (type.kind === "Scalar") {
      processScalar(type);
    } else if (type.kind === "Model" && isArrayModelType(context.program, type)) {
      if (type.indexer?.value) {
        collectReferencedScalars(type.indexer.value);
      }
    } else if (type.kind === "Model") {
      for (const prop of type.properties.values()) {
        collectReferencedScalars(prop.type);
      }
    } else if (type.kind === "Union") {
      for (const variant of type.variants.values()) {
        collectReferencedScalars(variant.type);
      }
    }
  };

  // Uses original (pre-mutation) models because mutated type refs won't match processedScalars.
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

// ---------------------------------------------------------------------------
// Phase 3: Classification
// ---------------------------------------------------------------------------

/**
 * Classify types into categories (interfaces, output types, input types, operations).
 */
function classifyTypes(
  program: Program,
  mutatedTypes: ReturnType<typeof mutateTypes>["mutatedTypes"],
  originalToMutated: Map<Model, Model>,
  typeUsage: TypeUsageResolver,
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

  for (const model of mutatedTypes.models) {
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

// ---------------------------------------------------------------------------
// Phase 4: Model variant lookups
// ---------------------------------------------------------------------------

/**
 * Build model variant lookups for checking which variants exist.
 */
function buildModelVariants(classifiedTypes: ClassifiedTypes): ModelVariants {
  const modelVariants: ModelVariants = {
    outputModels: new Map(),
    inputModels: new Map(),
  };

  classifiedTypes.outputModels.forEach((m) =>
    modelVariants.outputModels.set(m.name, m),
  );
  classifiedTypes.inputModels.forEach((m) =>
    modelVariants.inputModels.set(m.name, m),
  );

  return modelVariants;
}
