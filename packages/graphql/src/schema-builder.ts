import {
  type Program,
  type Type,
  type Enum,
  type Model,
  type Operation,
} from "@typespec/compiler";
import { $ } from "@typespec/compiler/typekit";
import {
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLObjectType,
  GraphQLString,
  GraphQLID,
  type GraphQLFieldConfigMap,
} from "graphql";
import { mapScalarToGraphQL } from "./lib/scalars.js";

export type TypeKey = string & { __typeKey: any };

/**
 * GraphQL schema builder that handles type registration, materialization, and conversion
 * from TypeSpec types to GraphQL types. Follows the type-map pattern for efficient
 * type creation and supports both output and input GraphQL types.
 */
export class GraphQLSchemaBuilder {
  // Type registration and materialization maps
  private registrationMap = new Map<TypeKey, { type: Type; name: string }>();
  private materializedMap = new Map<TypeKey, any>();
  private operationsRegistry = new Map<string, { type: any; args?: Record<string, any> }>();

  constructor(private program: Program) {}

  // === CORE REGISTRY METHODS ===

  /**
   * Registers a TypeSpec type with a GraphQL name
   */
  registerType(type: Type, name: string): TypeKey {
    const key = name as TypeKey;
    
    // Check for name collisions
    const existing = this.registrationMap.get(key);
    if (existing && existing.type !== type) {
      throw new Error(
        `GraphQL type name '${name}' is already registered. Type names must be unique across the entire schema.`
      );
    }
    
    this.registrationMap.set(key, { type, name });
    return key;
  }

  /**
   * Materializes a registered type using the provided materializer function
   */
  materializeType(key: TypeKey, materializer: () => any): any {
    if (this.materializedMap.has(key)) {
      return this.materializedMap.get(key);
    }
    
    const graphqlType = materializer();
    this.materializedMap.set(key, graphqlType);
    return graphqlType;
  }

  /**
   * Gets the context for a registered type
   */
  getContext(key: TypeKey): { type: Type; name: string } | undefined {
    return this.registrationMap.get(key);
  }

  /**
   * Adds an operation to the operations registry
   */
  addOperation(name: string, fieldConfig: { type: any; args?: Record<string, any> }): void {
    this.operationsRegistry.set(name, fieldConfig);
  }

  /**
   * Gets all registered operations
   */
  getAllOperations(): Map<string, { type: any; args?: Record<string, any> }> {
    return this.operationsRegistry;
  }

  /**
   * Gets all materialized GraphQL types
   */
  getAllMaterialized(): any[] {
    return Array.from(this.materializedMap.values());
  }

  /**
   * Resets all registries and caches
   */
  reset(): void {
    this.registrationMap.clear();
    this.materializedMap.clear();
    this.operationsRegistry.clear();
  }

  // === TYPE CREATION METHODS ===

  /**
   * Creates a GraphQL enum type using the register/materialize pattern
   */
  createGraphQLEnumType(enumType: Enum): GraphQLEnumType {
    const key = this.registerType(enumType, enumType.name);
    
    return this.materializeType(key, () => {
      const values = Object.fromEntries(
        Array.from(enumType.members.values()).map((member: any) => [member.name, { value: member.name }]),
      );
      
      return new GraphQLEnumType({
        name: enumType.name,
        values,
      });
    });
  }

  /**
   * Creates GraphQL object fields directly from TSP model properties
   */
  createGraphQLModelFields(
    model: Model,
    typeResolver: (type: Type) => any,
  ): Record<string, { type: any }> {
    const fields: Record<string, { type: any }> = {};
    
    for (const [name, prop] of model.properties) {
      const type = typeResolver(prop.type);
      if (type) {
        fields[prop.name] = { type };
      }
    }
    
    return fields;
  }

  /**
   * Creates a GraphQL object type using the register/materialize pattern
   */
  createGraphQLObjectType(model: Model): GraphQLObjectType {
    const key = this.registerType(model, model.name);
    
    return this.materializeType(key, () => {
      return new GraphQLObjectType({
        name: model.name,
        fields: () => this.createGraphQLModelFields(model, (type) => this.getGraphQLOutputType(type)),
      });
    });
  }

  /**
   * Creates a GraphQL input object type using the register/materialize pattern
   */
  createGraphQLInputObjectType(model: Model): GraphQLInputObjectType {
    const key = this.registerType(model, model.name);
    
    return this.materializeType(key, () => {
      return new GraphQLInputObjectType({
        name: model.name,
        fields: () => this.createGraphQLModelFields(model, (type) => this.getGraphQLInputType(type)),
      });
    });
  }

  /**
   * Converts TSP types to GraphQL output types on-demand
   */
  getGraphQLOutputType(type: Type): any {
    // Handle arrays first
    const arrayElement = GraphQLSchemaBuilder.getArrayElementType(type);
    if (arrayElement) {
      const elementType = this.getGraphQLOutputType(arrayElement);
      return elementType ? new GraphQLList(elementType) : undefined;
    }

    if (type.kind === "Model") {
      const model = type as Model;
      
      // Skip Array types - they're handled as GraphQL Lists
      if (model.name === "Array") {
        return undefined;
      }
      
      // Input models should not be used as output types
      if (model.name.endsWith("Input")) {
        return undefined;
      }
      
      return this.createGraphQLObjectType(model);
    }

    if (type.kind === "Enum") {
      return this.createGraphQLEnumType(type as Enum);
    }

    if (type.kind === "Scalar") {
      if (type.name === "ID") {
        return GraphQLID;
      }
      const typekit = $(this.program);
      return mapScalarToGraphQL(type as any, typekit);
    }
    
    return undefined;
  }

  /**
   * Converts TSP types to GraphQL input types on-demand
   */
  getGraphQLInputType(type: Type): any {
    // Handle arrays first
    const arrayElement = GraphQLSchemaBuilder.getArrayElementType(type);
    if (arrayElement) {
      const elementType = this.getGraphQLInputType(arrayElement);
      return elementType ? new GraphQLList(elementType) : undefined;
    }

    if (type.kind === "Model") {
      const model = type as Model;
      
      // Skip Array types - they're handled as GraphQL Lists
      if (model.name === "Array") {
        return undefined;
      }
      
      // For input types, look for the corresponding input model first
      const inputModelName = model.name + "Input";
      const inputModel = model.namespace?.models.get(inputModelName);
      if (inputModel) {
        return this.createGraphQLInputObjectType(inputModel);
      }
      
      // If this model itself is an input model, use it directly
      if (model.name.endsWith("Input")) {
        return this.createGraphQLInputObjectType(model);
      }
      
      // No input variant available
      return undefined;
    }

    if (type.kind === "Enum") {
      return this.createGraphQLEnumType(type as Enum);
    }

    if (type.kind === "Scalar") {
      if (type.name === "ID") {
        return GraphQLID;
      }
      const typekit = $(this.program);
      return mapScalarToGraphQL(type as any, typekit);
    }
    
    return undefined;
  }

  // === HIGH-LEVEL TYPE REGISTRATION METHODS ===

  /**
   * Registers a TSP model as a GraphQL type
   * After denormalization, uses name-based detection for input vs output types
   */
  registerModel(model: Model): void {
    // Skip Array types - they're handled as GraphQL Lists
    if (model.name === "Array") {
      return;
    }

    // After denormalization, input models have "Input" suffix
    if (model.name.endsWith("Input")) {
      this.createGraphQLInputObjectType(model);
    } else {
      // Regular models become output types
      this.createGraphQLObjectType(model);
    }
  }

  /**
   * Registers a TSP enum as a GraphQL enum type
   */
  registerEnum(enumType: Enum): void {
    this.createGraphQLEnumType(enumType);
  }

  /**
   * Registers a TSP operation as a GraphQL field
   */
  registerOperation(operation: Operation): void {
    // Process the operation's return type
    const returnType = this.getGraphQLOutputType(operation.returnType);
    if (!returnType) return; // Skip operations without valid return types

    // Handle arguments for operations with parameters
    const args: Record<string, any> = {};
    if (operation.parameters && operation.parameters.properties && operation.parameters.properties.size > 0) {
      for (const [name, param] of operation.parameters.properties) {
        const inputType = this.getGraphQLInputType(param.type);
        if (inputType) {
          args[name] = { type: inputType };
        }
      }
    }

    // Store the processed operation in the registry
    this.addOperation(operation.name, { 
      type: returnType, 
      args: Object.keys(args).length ? args : undefined 
    });
  }

  /**
   * Builds GraphQL query fields from registered operations
   */
  buildQueryFields(): GraphQLFieldConfigMap<any, any> {
    const queryFields: GraphQLFieldConfigMap<any, any> = {};
    
    // Collect all processed operations from the registry
    for (const [operationName, fieldConfig] of this.operationsRegistry.entries()) {
      queryFields[operationName] = fieldConfig;
    }
    
    // Fallback if no operations were processed
    if (Object.keys(queryFields).length === 0) {
      queryFields._ = { type: GraphQLString };
    }
    
    return queryFields;
  }

  // === STATIC UTILITY METHODS ===

  /**
   * Extracts the element type from an array type
   */
  static getArrayElementType(type: any): any | undefined {
    // Model-based array: Array<T>
    if (
      type &&
      type.name === "Array" &&
      "templateArguments" in type &&
      Array.isArray(type.templateArguments) &&
      type.templateArguments.length === 1
    ) {
      return type.templateArguments[0];
    }
    // AST-based array: { kind: "Array", elementType }
    if (type && type.kind === "Array" && "elementType" in type && type.elementType) {
      return type.elementType;
    }
    return undefined;
  }
}

 