import type { Namespace } from "@typespec/compiler";
import {
  createDiagnosticCollector,
  type Diagnostic,
  type DiagnosticCollector,
  type EmitContext,
  ListenerFlow,
  navigateProgram,
} from "@typespec/compiler";
import { resolveUsages, type UsageTracker } from "@typespec/compiler";
import { GraphQLObjectType, GraphQLSchema, validateSchema } from "graphql";
import { GraphQLSchemaBuilder } from "./schema-builder.js";
import { GraphQLTSPDenormalizer } from "./denormalization.js";
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

    // Denormalize TSP types into GraphQL friendly TSP types
    const denormalizer = new GraphQLTSPDenormalizer(schemaNamespace, this.context);
    denormalizer.denormalize();

    // Explicitly traverse the updated program (including denormalized types)
    // This makes the type creation process visible and intentional
    navigateProgram(this.context.program, {
      namespace: (namespace) => {
        if (["TypeSpec", "Reflection"].includes(namespace.name)) {    
          return ListenerFlow.NoRecursion;
        }
        return undefined; // Continue recursion for other namespaces
      },
      model: (node) => {
        if (node.namespace === schemaNamespace) {
          this.schemaBuilder.registerModel(node);
        }
      },
      modelProperty: (prop) => {
        if (prop.model && prop.model.namespace === schemaNamespace) {
          // Explicitly register model properties during traversal
          this.schemaBuilder.registerModelProperty(prop);
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
          // Basic operation processing to create query fields
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
    
    // Include all registered types in the schema
    const allTypes = this.schemaBuilder.getAllMaterialized();
    const schema = new GraphQLSchema({
      query: QueryType,
      types: allTypes,
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