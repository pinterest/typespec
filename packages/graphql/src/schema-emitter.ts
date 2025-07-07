import type { Namespace } from "@typespec/compiler";
import {
  createDiagnosticCollector,
  type Diagnostic,
  type DiagnosticCollector,
  type EmitContext,
  navigateProgram,
} from "@typespec/compiler";
import { resolveUsages, type UsageTracker } from "@typespec/compiler";
import { GraphQLObjectType, GraphQLSchema, validateSchema } from "graphql";
import { GraphQLSchemaBuilder } from "./schema-builder.js";
import { GraphQLDenormalizer } from "./denormalization.js";
import type { GraphQLEmitterOptions } from "./lib.js";
import type { Schema } from "./lib/schema.js";

class GraphQLSchemaEmitter {
  private tspSchema: Schema;
  private context: EmitContext<GraphQLEmitterOptions>;
  private options: GraphQLEmitterOptions;  
  private diagnostics: DiagnosticCollector;
  private usageTracker!: UsageTracker;
  private schemaBuilder: GraphQLSchemaBuilder;

  constructor(
    tspSchema: Schema,
    context: EmitContext<GraphQLEmitterOptions>,
    options: GraphQLEmitterOptions,
  ) {
    this.tspSchema = tspSchema;
    this.context = context;
    this.options = options;
    this.diagnostics = createDiagnosticCollector();
    this.schemaBuilder = new GraphQLSchemaBuilder(context.program);
  }

  async emitSchema(): Promise<[GraphQLSchema, Readonly<Diagnostic[]>] | undefined> {
    const schemaNamespace = this.tspSchema.type;
    
    // Resolve usage flags using TypeSpec's built-in API
    this.usageTracker = resolveUsages(schemaNamespace);
    
    // Denormalize models: create input variants for models used as inputs
    // This creates real TSP types that integrate with normal processing
    GraphQLDenormalizer.denormalize(schemaNamespace, this.usageTracker, this.context);

    // Explicitly traverse the AST and build GraphQL types
    // This makes the type creation process visible and intentional
    navigateProgram(this.context.program, {
      model: (node) => {
        if (node.namespace === schemaNamespace) {
          // Explicitly create GraphQL types for models during traversal
          this.schemaBuilder.registerModel(node);
        }
      },
      enum: (node) => {
        if (node.namespace === schemaNamespace) {
          // Explicitly create GraphQL types for enums during traversal
          this.schemaBuilder.registerEnum(node);
        }
      },
      operation: (node) => {
        if (node.namespace === schemaNamespace) {
          // Explicitly process operations during traversal
          this.schemaBuilder.registerOperation(node);
        }
      },
    });

    // Build GraphQL schema using the types created during traversal
    const queryFields = this.schemaBuilder.buildQueryFields();
    const QueryType = new GraphQLObjectType({
      name: "Query",
      fields: queryFields,
    });
    const schema = new GraphQLSchema({
      query: QueryType,
    });

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
