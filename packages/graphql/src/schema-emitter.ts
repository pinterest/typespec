import type { Model, ModelProperty, Namespace } from "@typespec/compiler";
import {
  createDiagnosticCollector,
  ListenerFlow,
  navigateTypesInNamespace,
  type Diagnostic,
  type DiagnosticCollector,
  type EmitContext,
} from "@typespec/compiler";
import { GraphQLObjectType, GraphQLSchema, validateSchema } from "graphql";
import {
  annotateEnum,
  annotateModel,
  annotateModelProperty,
  buildQueryFields,
} from "./graphql-helpers.js";
import type { GraphQLEmitterOptions } from "./lib.js";
import type { Schema } from "./lib/schema.js";

class GraphQLSchemaEmitter {
  private tspSchema: Schema;
  private context: EmitContext<GraphQLEmitterOptions>;
  private options: GraphQLEmitterOptions;
  private diagnostics: DiagnosticCollector;
  // private registry: GraphQLTypeRegistry;
  // Registry removed: will use AST node state instead.
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
    // this.registry = new GraphQLTypeRegistry(context.program);
    // Registry removed: will use AST node state instead.
  }

  async emitSchema(): Promise<[GraphQLSchema, Readonly<Diagnostic[]>] | undefined> {
    const schemaNamespace = this.tspSchema.type;
    // Traverse and annotate all types
    navigateTypesInNamespace(schemaNamespace, this.semanticNodeListener());

    // Build root Query type fields from operations
    const queryFields = buildQueryFields(this.context, schemaNamespace);
    const QueryType = new GraphQLObjectType({
      name: "Query",
      fields: queryFields,
    });
    const schema = new GraphQLSchema({
      query: QueryType,
    });

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
      namespace: (namespace: Namespace) => {
        if (["TypeSpec", "Reflection"].includes(namespace.name)) {
          return ListenerFlow.NoRecursion;
        }
        return;
      },
      enum: (node: any) => {
        annotateEnum(this.context, node);
      },
      model: (node: Model) => {
        annotateModel(this.context, node);
      },
      exitModel: (node: Model) => {
        // Finalize model annotation if needed
        // (if annotateModel handles everything, this can be a no-op)
      },
      modelProperty: (node: ModelProperty) => {
        annotateModelProperty(this.context, node);
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
