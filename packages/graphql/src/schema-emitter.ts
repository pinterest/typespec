import {
  createDiagnosticCollector,
  ListenerFlow,
  navigateTypesInNamespace,
  resolveUsages,
  UsageFlags,
  type Diagnostic,
  type DiagnosticCollector,
  type EmitContext,
  type Enum,
  type Model,
  type ModelProperty,
  type Namespace,
} from "@typespec/compiler";
import { 
  GraphQLSchema, 
  validateSchema 
} from "graphql";
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
    this.tspSchema = tspSchema;
    this.context = context;
    this.options = options;
    this.diagnostics = createDiagnosticCollector();
    this.registry = new GraphQLTypeRegistry(context.program);
  }

  async emitSchema(): Promise<[GraphQLSchema, Readonly<Diagnostic[]>] | undefined> {
    const schemaNamespace = this.tspSchema.type;
    
    // Analyze usage patterns in the schema namespace
    const usageTracker = resolveUsages(schemaNamespace);
    
    // Set the usage tracker in the registry
    this.registry.setUsageTracker(usageTracker);
    
    // Single pass: Register types, process fields, and materialize
    navigateTypesInNamespace(schemaNamespace, this.semanticNodeListener());
    
    // Generate the final schema
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
   * Single-pass semantic node listener
   * 
   * Two-Phase Processing Pattern
   * ============================
   * 
   * Registration Phase (on visit):
   * - Register models/enums when encountered to make them known to the registry
   * - Enables forward references and circular dependency resolution
   * - Creates thunks for deferred type resolution
   * 
   * Materialization Phase (on exit):
   * - Create actual GraphQL types with all fields resolved
   * - Thunks can safely resolve since all referenced types are registered
   * - Produces complete GraphQL type definitions
   */
  semanticNodeListener() {
    return {
      namespace: (namespace: Namespace) => {
        if (namespace.name === "TypeSpec" || namespace.name === "Reflection") {
          return ListenerFlow.NoRecursion;
        }
        return;
      },
      enum: (node: Enum) => {
        this.registry.addEnum(node);
      },
      model: (node: Model) => {
        this.registry.addModel(node);
      },
      modelProperty: (property: ModelProperty) => {
        const parentModel = property.model;
        if (parentModel?.name) {
          this.registry.addModelProperty(parentModel.name, property);
        }
      },
      exitEnum: (node: Enum) => {
        this.registry.materializeEnum(node.name);
      },
      exitModel: (node: Model) => {
        if (node.name) {
          this.registry.materializeModelWithAllUsages(node.name);
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
