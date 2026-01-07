import {
  createDiagnosticCollector,
  navigateTypesInNamespace,
  UsageFlags,
  type Diagnostic,
  type DiagnosticCollector,
  type EmitContext,
  type Enum,
  type Model,
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
    // Navigate the original namespace, mutate on-demand via engine
    navigateTypesInNamespace(this.tspSchema.type, this.semanticNodeListener());

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

  semanticNodeListener() {
    return {
      enum: (node: Enum) => {
        const mutation = this.engine.mutateEnum(node);
        this.registry.addEnum(mutation.mutatedType);
      },
      model: (node: Model) => {
        // Mutate the model - returns input/output variants
        const result = this.engine.mutateModel(node);

        // Register output variant if present
        if (result.output) {
          this.registry.addModel(result.output.mutatedType, UsageFlags.Output);
        }

        // Register input variant if present
        if (result.input) {
          this.registry.addModel(result.input.mutatedType, UsageFlags.Input);
        }
      },
      exitEnum: (node: Enum) => {
        const mutation = this.engine.mutateEnum(node);
        this.registry.materializeEnum(mutation.mutatedType.name);
      },
      exitModel: (node: Model) => {
        // Materialize both input and output variants
        const result = this.engine.mutateModel(node);

        if (result.output) {
          this.registry.materializeModel(result.output.mutatedType.name);
        }

        if (result.input) {
          this.registry.materializeModel(result.input.mutatedType.name);
        }
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
