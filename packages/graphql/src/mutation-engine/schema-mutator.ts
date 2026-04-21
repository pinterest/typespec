import {
  getEncode,
  isArrayModelType,
  isUnknownType,
  isVoidType,
  navigateTypesInNamespace,
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
import type { ScalarVariant } from "../context/index.js";
import { isInterface } from "../lib/interface.js";
import { getOperationKind } from "../lib/operation-kind.js";
import { getGraphQLBuiltinName, getScalarMapping } from "../lib/scalar-mappings.js";
import { getSpecifiedBy } from "../lib/specified-by.js";
import { unwrapNullableUnion } from "../lib/type-utils.js";
import {
  GraphQLTypeUsage,
  type TypeUsageResolver,
} from "../type-usage.js";
import type { GraphQLMutationEngine } from "./engine.js";
import { GraphQLTypeContext } from "./options.js";

/**
 * The fully-mutated schema produced by `GraphQLMutationEngine.mutateSchema`.
 *
 * Types are pre-classified into input/output/interface buckets and
 * operations are pre-classified by kind, so the renderer doesn't need
 * pre-mutation types or a type-usage resolver.
 */
export interface MutatedSchema {
  // Pre-classified model buckets
  /** Models marked with @Interface */
  interfaces: Model[];
  /** Models used as outputs (return values) or declared but unreferenced */
  outputModels: Model[];
  /** Models used as inputs (operation parameters) */
  inputModels: Model[];

  // Non-model type buckets
  enums: Enum[];
  scalars: Scalar[];
  unions: Union[];

  // Operations, classified by kind
  queries: Operation[];
  mutations: Operation[];
  subscriptions: Operation[];
  /**
   * Operations that return `void`. Excluded from the kind buckets above
   * since GraphQL fields must return a type. Exposed separately so the
   * emitter can report a diagnostic — mutation shapes the graph; the
   * emitter decides what's worth warning about.
   */
  voidOperations: Operation[];

  // Derived metadata
  /** Synthetic wrapper models created by union mutations for scalar variants */
  wrapperModels: Model[];
  /** Encoded stdlib scalars mapped to GraphQL custom scalars (e.g. bytes + base64 → Bytes) */
  scalarVariants: ScalarVariant[];
  /** `@specifiedBy` URLs indexed by GraphQL scalar name */
  scalarSpecifications: Map<string, string>;
}

/**
 * Mutate every type declared in the schema namespace and classify the
 * results. This is the internal implementation called by
 * `GraphQLMutationEngine.mutateSchema`.
 *
 * The engine parameter is passed in explicitly (rather than being the
 * receiver) to avoid a circular import between this module and engine.ts.
 */
export function mutateSchema(
  program: Program,
  engine: GraphQLMutationEngine,
  schema: Namespace,
  typeUsage: TypeUsageResolver,
): MutatedSchema {
  // Pre-classified model buckets — populated at visit time.
  const interfaces: Model[] = [];
  const outputModels: Model[] = [];
  const inputModels: Model[] = [];

  // Non-model type buckets.
  const enums: Enum[] = [];
  const scalars: Scalar[] = [];
  const unions: Union[] = [];

  // Operations are classified by kind inline. We also keep the full list
  // (including void-returning ops) for scalar collection in Phase B — a
  // void op's params can still reference stdlib scalars that need to be
  // declared in the schema.
  const queries: Operation[] = [];
  const mutations: Operation[] = [];
  const subscriptions: Operation[] = [];
  const allOperations: Operation[] = [];

  // Synthetic wrapper models from union mutation (always output).
  const wrapperModels: Model[] = [];

  // Void-returning operations — collected here so the emitter can report
  // the diagnostic. Mutation shapes the graph; it doesn't warn.
  const voidOperations: Operation[] = [];

  // Metadata.
  const scalarSpecifications = new Map<string, string>();
  const scalarVariantsMap = new Map<string, ScalarVariant>();

  // Scalar dedup: a single scalar can be declared in the namespace AND
  // referenced from many properties. Mutate once, add to bucket once.
  const processedScalars = new Set<string>();

  // Track the mutated models we've visited so we can collect referenced
  // scalars from their properties after the namespace walk.
  const visitedModelOriginals: Model[] = [];

  const processScalar = (node: Scalar): void => {
    // Skip scalars that map directly onto GraphQL built-ins (String, Int,
    // Float, Boolean, ID) — they're emitted by reference and don't need
    // their own scalar declaration in the schema.
    if (getGraphQLBuiltinName(program, node)) return;

    const mutation = engine.mutateScalar(node);
    const graphqlName = mutation.mutatedType.name;

    if (!processedScalars.has(graphqlName)) {
      processedScalars.add(graphqlName);
      scalars.push(mutation.mutatedType);

      const specUrl = getSpecifiedBy(program, mutation.mutatedType);
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
      program.checker.isStdType(target.type) &&
      !getGraphQLBuiltinName(program, target.type)
    ) {
      const encodeData = getEncode(program, target);
      const encoding = encodeData?.encoding;
      const mapping = getScalarMapping(program, target.type, encoding);
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

  const classifyModel = (originalModel: Model, mutatedModel: Model): void => {
    // @Interface is checked on the original (pre-clone) model, since decorator
    // state is stored against original type identity, not mutated clones.
    if (isInterface(program, originalModel)) {
      interfaces.push(mutatedModel);
      return;
    }

    const usage = typeUsage.getUsage(originalModel);
    const usedAsInput = usage?.has(GraphQLTypeUsage.Input) ?? false;
    const usedAsOutput = usage?.has(GraphQLTypeUsage.Output) ?? false;

    if (!usedAsInput && !usedAsOutput) {
      // Reachable but not referenced by any operation — default to Output so
      // that namespace-declared models still appear in the schema. Without
      // this, a model declared in the schema namespace but never referenced
      // by a query/mutation would silently disappear.
      outputModels.push(mutatedModel);
      return;
    }
    if (usedAsOutput) outputModels.push(mutatedModel);
    if (usedAsInput) inputModels.push(mutatedModel);
  };

  const classifyOperation = (op: Operation): void => {
    allOperations.push(op);
    if (isVoidType(op.returnType)) {
      voidOperations.push(op);
      return;
    }
    const kind = getOperationKind(program, op);
    if (kind === "Query") queries.push(op);
    else if (kind === "Mutation") mutations.push(op);
    else if (kind === "Subscription") subscriptions.push(op);
  };

  // Phase A: Walk every type declared in the namespace, mutate it, and
  // classify the result. Unreachable types are skipped here so we don't
  // pay the cost of mutation for types that won't appear in the schema.
  navigateTypesInNamespace(schema, {
    model: (node: Model) => {
      if (isArrayModelType(program, node)) return;
      if (typeUsage.isUnreachable(node)) return;
      const mutation = engine.mutateModel(node, GraphQLTypeContext.Output);
      classifyModel(node, mutation.mutatedType);
      visitedModelOriginals.push(node);
    },
    enum: (node: Enum) => {
      if (typeUsage.isUnreachable(node)) return;
      const mutation = engine.mutateEnum(node);
      enums.push(mutation.mutatedType);
    },
    scalar: (node: Scalar) => {
      processScalar(node);
    },
    union: (node: Union) => {
      // Skip nullable unions (e.g., string | null) — they're not union
      // declarations. Nullability for these is detected at render time in
      // GraphQLTypeExpression. We must NOT mutate them here because
      // replace() would call setNullable() on the shared inner type (e.g.,
      // the string scalar singleton), poisoning all other uses of that type.
      if (unwrapNullableUnion(node) !== undefined) return;
      if (typeUsage.isUnreachable(node)) return;
      const mutation = engine.mutateUnion(node, GraphQLTypeContext.Output);
      unions.push(mutation.mutatedType as Union);
      wrapperModels.push(...mutation.wrapperModels);
    },
    operation: (node: Operation) => {
      // Operations pass through unmutated. classifyOperation collects void
      // ops for the emitter to report on, and routes the rest by
      // @query/@mutation/@subscription.
      classifyOperation(node);
    },
  });

  // Phase B: Collect referenced scalars and scalar variants from model
  // properties and operation params/returns. Standard-library scalars like
  // int64 and utcDateTime aren't declared in the namespace but are
  // referenced from properties, so we have to walk the type graph to find
  // them.
  const visitedTypes = new Set<Type>();

  const collectReferencedScalars = (type: Type): void => {
    if (visitedTypes.has(type)) return;
    visitedTypes.add(type);

    if (type.kind === "Scalar") {
      processScalar(type);
    } else if (type.kind === "Model" && isArrayModelType(program, type)) {
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

  // Uses original (pre-mutation) models because mutated scalar refs won't
  // match processedScalars' dedup keys (which are GraphQL names derived
  // from mutated scalars).
  for (const model of visitedModelOriginals) {
    for (const prop of model.properties.values()) {
      collectReferencedScalars(prop.type);
      processScalarVariant(prop);
    }
  }

  // Walk params/returns for every operation — even void-returning ones,
  // since their parameters can still reference scalars. classifyOperation
  // above has already excluded void ops from the queries/mutations/
  // subscriptions buckets, but we still want their param types' scalars.
  for (const op of allOperations) {
    for (const param of op.parameters.properties.values()) {
      collectReferencedScalars(param.type);
      processScalarVariant(param);
    }
    collectReferencedScalars(op.returnType);
  }

  return {
    interfaces,
    outputModels,
    inputModels,
    enums,
    scalars,
    unions,
    queries,
    mutations,
    subscriptions,
    voidOperations,
    wrapperModels,
    scalarVariants: Array.from(scalarVariantsMap.values()),
    scalarSpecifications,
  };
}
