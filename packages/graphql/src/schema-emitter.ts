import {
  createDiagnosticCollector,
  isArrayModelType,
  isRecordModelType,
  navigateType,
  navigateTypesInNamespace,
  UsageFlags,
  type Diagnostic,
  type DiagnosticCollector,
  type EmitContext,
  type Enum,
  type Model,
  type Type,
} from "@typespec/compiler";
import { GraphQLSchema, validateSchema } from "graphql";
import { type GraphQLEmitterOptions } from "./lib.js";
import type { Schema } from "./lib/schema.js";
import {
  createGraphQLMutationEngine,
  type GraphQLMutationEngine,
} from "./mutation-engine/index.js";
import { GraphQLTypeRegistry } from "./registry.js";

class GraphQLSchemaEmitter {
  private tspSchema: Schema;
  private context: EmitContext<GraphQLEmitterOptions>;
  private options: GraphQLEmitterOptions;
  private diagnostics: DiagnosticCollector;
  private registry: GraphQLTypeRegistry;
  private engine: GraphQLMutationEngine;

  constructor(
    tspSchema: Schema,
    context: EmitContext<GraphQLEmitterOptions>,
    options: GraphQLEmitterOptions,
  ) {
    this.tspSchema = tspSchema;
    this.context = context;
    this.options = options;
    this.diagnostics = createDiagnosticCollector();
    this.registry = new GraphQLTypeRegistry();
    this.engine = createGraphQLMutationEngine(context.program, tspSchema.type);
  }

  async emitSchema(): Promise<[GraphQLSchema, Readonly<Diagnostic[]>] | undefined> {
    // Pass 1: Mutation - collect all mutated types
    const mutatedTypes: Type[] = [];
    navigateTypesInNamespace(this.tspSchema.type, this.mutationListeners(mutatedTypes));

    // Pass 2: Emission - navigate mutated types to register and materialize
    const emissionListeners = this.emissionListeners();
    for (const type of mutatedTypes) {
      navigateType(type, emissionListeners, {});
    }

    const schemaConfig = this.registry.materializeSchemaConfig();
    const schema = new GraphQLSchema(schemaConfig);

    // Validate the schema
    const validationErrors = validateSchema(schema);
    validationErrors.forEach((error) => {
      this.diagnostics.add({
        message: error.message,
        code: "GraphQLSchemaValidationError",
        target: this.tspSchema.type,
        severity: "error",
      });
    });
    return [schema, this.diagnostics.diagnostics];
  }

  /**
   * Pass 1: Mutation listeners - mutate types and collect them
   */
  mutationListeners(mutatedTypes: Type[]) {
    return {
      enum: (node: Enum) => {
        const mutation = this.engine.mutateEnum(node);
        mutatedTypes.push(mutation.mutatedType);
      },
      model: (node: Model) => {
        const mutation = this.engine.mutateModel(node);
        mutatedTypes.push(mutation.mutatedType);
      },
    };
  }

  /**
   * Pass 2: Emission listeners - register and materialize mutated types
   */
  emissionListeners() {
    return {
      enum: (node: Enum) => {
        this.registry.addEnum(node);
      },
      model: (node: Model) => {
        if (
          isArrayModelType(this.context.program, node) ||
          isRecordModelType(this.context.program, node)
        ) {
          return;
        }
        this.registry.addModel(node, UsageFlags.Output);
      },
      exitEnum: (node: Enum) => {
        this.registry.materializeEnum(node.name);
      },
      exitModel: (node: Model) => {
        if (
          isArrayModelType(this.context.program, node) ||
          isRecordModelType(this.context.program, node)
        ) {
          return;
        }
        this.registry.materializeModel(node.name);
      },
    };
  }
}

export function createSchemaEmitter(
  schema: Schema,
  context: EmitContext<GraphQLEmitterOptions>,
  options: GraphQLEmitterOptions,
): GraphQLSchemaEmitter {
  return new GraphQLSchemaEmitter(schema, context, options);
}

export type { GraphQLSchemaEmitter };
