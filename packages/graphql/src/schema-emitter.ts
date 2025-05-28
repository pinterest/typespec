import {
  createDiagnosticCollector,
  navigateTypesInNamespace,
  type Diagnostic,
  type DiagnosticCollector,
  type EmitContext,
  type Enum,
  type Model,
} from "@typespec/compiler";
import { GraphQLSchema, validateSchema } from "graphql";
import { type GraphQLEmitterOptions } from "./lib.js";
import type { Schema } from "./lib/schema.js";
import { GraphQLTypeRegistry } from "./registry.js";

class GraphQLSchemaEmitter {
  private tspSchema: Schema;
  private context: EmitContext<GraphQLEmitterOptions>;
  private options: GraphQLEmitterOptions;
  private diagnostics: DiagnosticCollector;
  private registry: GraphQLTypeRegistry;
  constructor(
    tspSchema: Schema,
    context: EmitContext<GraphQLEmitterOptions>,
    options: GraphQLEmitterOptions,
  ) {
    // Initialize any properties if needed, including the registry
    this.tspSchema = tspSchema;
    this.context = context;
    this.options = options;
    this.diagnostics = createDiagnosticCollector();
    this.registry = new GraphQLTypeRegistry();
  }

  async emitSchema(): Promise<[GraphQLSchema, Readonly<Diagnostic[]>] | undefined> {
    const schemaNamespace = this.tspSchema.type;
    // Logic to emit the GraphQL schema
    navigateTypesInNamespace(schemaNamespace, this.semanticNodeListener());
    const schemaConfig = this.registry.materializeSchemaConfig();
    const schema = new GraphQLSchema(schemaConfig);
    // validate the schema
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
        this.registry.addEnum(node);
      },
      model: (node: Model) => {
        // Register the model in the registry
        this.registry.addModel(node);
      },
      exitEnum: (node: Enum) => {
        this.registry.materializeEnum(node.name);
      },
      exitModel: (node: Model) => {
        // Materialize the model after all its properties have been processed
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
  // Placeholder for creating a GraphQL schema emitter
  return new GraphQLSchemaEmitter(schema, context, options);
}

export type { GraphQLSchemaEmitter };
