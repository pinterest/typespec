import type { Model, ModelProperty, Namespace } from "@typespec/compiler";
import {
  createDiagnosticCollector,
  ListenerFlow,
  navigateProgram,
  type Diagnostic,
  type DiagnosticCollector,
  type EmitContext,
} from "@typespec/compiler";
import { $ } from "@typespec/compiler/typekit";
import { UsageFlags, resolveUsages, type UsageTracker } from "@typespec/compiler";
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
  private usageTracker!: UsageTracker;

  constructor(
    tspSchema: Schema,
    context: EmitContext<GraphQLEmitterOptions>,
    options: GraphQLEmitterOptions,
  ) {
    this.tspSchema = tspSchema;
    this.context = context;
    this.options = options;
    this.diagnostics = createDiagnosticCollector();
  }

  async emitSchema(): Promise<[GraphQLSchema, Readonly<Diagnostic[]>] | undefined> {
    const schemaNamespace = this.tspSchema.type;
    
    // Resolve usage flags using TypeSpec's built-in API directly
    this.usageTracker = resolveUsages(schemaNamespace);
    
    // NEW: Create input models as real TSP types
    this.createInputModels(schemaNamespace);
    
    // Modernized AST traversal using navigateProgram (like MCP/Zod)
    navigateProgram(
      this.context.program,
      this.semanticNodeListener(),
      { includeTemplateDeclaration: false }
    );

    // Use existing working GraphQL generation logic
    const queryFields = buildQueryFields(this.context, schemaNamespace);
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

  /**
   * Create input models as real TSP types for models that need input variants
   */
  private createInputModels(namespace: Namespace): void {
    const typekit = $(this.context.program);
    
    // Collect models that need input types (to avoid modifying during iteration)
    const modelsNeedingInput: Model[] = [];
    for (const [name, model] of namespace.models) {
      if (this.usageTracker.isUsedAs(model, UsageFlags.Input)) {
        modelsNeedingInput.push(model);
      }
    }
    
    // Create input models
    for (const model of modelsNeedingInput) {
      const inputModel = this.createInputModelFromOutput(model, typekit);
      namespace.models.set(model.name + "Input", inputModel);
    }
  }

  /**
   * Create an input model variant from an output model
   */
  private createInputModelFromOutput(outputModel: Model, typekit: ReturnType<typeof $>): Model {
    // Create input model properties
    const inputProperties: Record<string, ModelProperty> = {};
    for (const [name, prop] of outputModel.properties) {
      inputProperties[name] = typekit.modelProperty.create({
        name: prop.name,
        type: prop.type, // TODO: Transform nested model types to input variants
        optional: prop.optional,
      });
    }
    
    // Create the input model with all properties
    const inputModel = typekit.model.create({
      name: outputModel.name + "Input",
      properties: inputProperties,
    });
    
    // Fix the parent-child relationship by setting the model property on each property
    for (const [name, prop] of inputModel.properties) {
      // Directly set the model field to establish the parent relationship
      (prop as any).model = inputModel;
    }
    
    return inputModel;
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
        annotateModel(this.context, node, this.usageTracker);
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
