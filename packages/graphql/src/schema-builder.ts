import {
  type Enum,
  type Model,
  type ModelProperty,
  type Operation,
  type Program,
  type Type,
} from "@typespec/compiler";
import { $ } from "@typespec/compiler/typekit";
import {
  GraphQLEnumType,
  GraphQLID,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLObjectType,
  GraphQLString,
  type GraphQLFieldConfigMap,
  type GraphQLInputType,
  type GraphQLOutputType,
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
  private modelPropertiesRegistry = new Map<string, ModelProperty[]>();
  private operationsRegistry = new Map<string, { type: any; args?: Record<string, any> }>();

  constructor(private program: Program) {}

  private static readonly ARRAY_MODEL_NAME = "Array";
  private static readonly INPUT_SUFFIX = "Input";
  private static readonly ID_SCALAR_NAME = "ID";

  /**
   * Handles array type conversion for both input and output types
   */
  private handleArrayType(
    type: Type,
    elementResolver: (type: Type) => GraphQLOutputType | GraphQLInputType,
  ): GraphQLList<any> | null {
    const arrayElement = GraphQLSchemaBuilder.getArrayElementType(type);
    if (arrayElement) {
      const elementType = elementResolver(arrayElement);
      return new GraphQLList(elementType);
    }
    return null; // Signal: not an array, continue processing
  }

  /**
   * Converts TypeSpec scalar and intrinsic types to GraphQL types
   */
  private convertScalarType(type: Type): GraphQLOutputType | GraphQLInputType {
    if (type.kind !== "Scalar" && type.kind !== "Intrinsic") {
      throw new Error(`Expected scalar or intrinsic type, got ${type.kind}`);
    }
    if (type.kind === "Scalar" && type.name === GraphQLSchemaBuilder.ID_SCALAR_NAME) {
      return GraphQLID;
    }
    const typekit = $(this.program);
    const graphqlType = mapScalarToGraphQL(type as any, typekit);
    if (!graphqlType) {
      throw new Error(`Unsupported scalar/intrinsic type: ${type.name || type.kind}`);
    }
    return graphqlType;
  }

  /**
   * Converts TypeSpec enum types to GraphQL enum types
   */
  private convertEnumType(type: Enum): GraphQLEnumType {
    return this.createGraphQLEnumType(type);
  }

  /**
   * Registers a TypeSpec type with a GraphQL name
   */
  registerType(type: Type, name: string): TypeKey {
    const key = name as TypeKey;

    const existing = this.registrationMap.get(key);
    if (existing && existing.type !== type) {
      const existingKind = existing.type.kind;
      const newKind = type.kind;

      throw new Error(
        `GraphQL type name '${name}' collision: ${existingKind} conflicts with ${newKind}. ` +
        `GraphQL requires all type names to be unique across models, enums, and interfaces.`
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
   * Registers a model property for later field creation
   */
  registerModelProperty(property: ModelProperty): void {
    // Only process properties that have a parent model
    if (!property.model) {
      return;
    }
    const modelName = property.model.name;
    const existingProps = this.modelPropertiesRegistry.get(modelName) || [];
    existingProps.push(property);
    this.modelPropertiesRegistry.set(modelName, existingProps);
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
    this.modelPropertiesRegistry.clear();
    this.operationsRegistry.clear();
  }

  /**
   * Creates a GraphQL enum type using the register/materialize pattern
   */
  createGraphQLEnumType(enumType: Enum): GraphQLEnumType {
    const key = enumType.name as TypeKey;

    // Check cache first, before any other work
    if (this.materializedMap.has(key)) {
      return this.materializedMap.get(key);
    }

    // Only register if we need to create the type
    this.registerType(enumType, enumType.name);
    return this.materializeType(key, () => {
      const values = Object.fromEntries(
        Array.from(enumType.members.values()).map((member: any) => [
          member.name,
          { value: member.name },
        ]),
      );

      return new GraphQLEnumType({
        name: enumType.name,
        values,
      });
    });
  }

  /**
   * Creates a GraphQL object type using the register/materialize pattern
   */
  createGraphQLObjectType(model: Model): GraphQLObjectType {
    const key = model.name as TypeKey;

    // Check cache first, before any other work
    if (this.materializedMap.has(key)) {
      return this.materializedMap.get(key);
    }

    // Only register if we need to create the type
    this.registerType(model, model.name);
    return this.materializeType(key, () => {
      return new GraphQLObjectType({
        name: model.name,
        fields: () => {
          const fields: Record<string, { type: any }> = {};
          const properties = this.modelPropertiesRegistry.get(model.name) || [];

          for (const prop of properties) {
            const type = this.getGraphQLOutputType(prop.type);
            fields[prop.name] = { type };
          }

          return fields;
        },
      });
    });
  }

  /**
   * Creates a GraphQL input object type using the register/materialize pattern
   */
  createGraphQLInputObjectType(model: Model): GraphQLInputObjectType {
    const key = model.name as TypeKey;

    // Check cache first, before any other work
    if (this.materializedMap.has(key)) {
      return this.materializedMap.get(key);
    }

    // Only register if we need to create the type
    this.registerType(model, model.name);
    return this.materializeType(key, () => {
      return new GraphQLInputObjectType({
        name: model.name,
        fields: () => {
          const fields: Record<string, { type: any }> = {};
          const properties = this.modelPropertiesRegistry.get(model.name) || [];

          for (const prop of properties) {
            const type = this.getGraphQLInputType(prop.type);
            fields[prop.name] = { type };
          }

          return fields;
        },
      });
    });
  }

  /**
   * Converts TSP types to GraphQL output types on-demand
   */
  getGraphQLOutputType(type: Type): GraphQLOutputType {
    // Handle arrays first
    const arrayResult = this.handleArrayType(type, (elementType) =>
      this.getGraphQLOutputType(elementType),
    );
    if (arrayResult) {
      return arrayResult;
    }

    if (type.kind === "Model") {
      const model = type as Model;

      // Skip Array types - they're handled as GraphQL Lists
      if (model.name === GraphQLSchemaBuilder.ARRAY_MODEL_NAME) {
        throw new Error("Array types should be handled as GraphQL Lists");
      }

      // Input models should not be used as output types
      if (model.name.endsWith(GraphQLSchemaBuilder.INPUT_SUFFIX)) {
        throw new Error(`Input model '${model.name}' cannot be used as output type`);
      }

      return this.createGraphQLObjectType(model);
    }

    if (type.kind === "Enum") {
      return this.convertEnumType(type as Enum);
    }

    if (type.kind === "Scalar") {
      return this.convertScalarType(type) as GraphQLOutputType;
    }

    if (type.kind === "Intrinsic") {
      // Handle TypeSpec intrinsic types like void, never, etc.
      return this.convertScalarType(type) as GraphQLOutputType;
    }

    throw new Error(`Unsupported type for GraphQL output: ${type.kind}`);
  }

  /**
   * Converts TSP types to GraphQL input types on-demand
   */
  getGraphQLInputType(type: Type): GraphQLInputType {
    // Handle arrays first
    const arrayResult = this.handleArrayType(type, (elementType) =>
      this.getGraphQLInputType(elementType),
    );
    if (arrayResult) {
      return arrayResult;
    }

    if (type.kind === "Model") {
      const model = type as Model;

      // Skip Array types - they're handled as GraphQL Lists
      if (model.name === GraphQLSchemaBuilder.ARRAY_MODEL_NAME) {
        throw new Error("Array types should be handled as GraphQL Lists");
      }

      // For input types, look for the corresponding input model first
      const inputModelName = model.name + GraphQLSchemaBuilder.INPUT_SUFFIX;
      const inputModel = model.namespace?.models.get(inputModelName);
      if (inputModel) {
        return this.createGraphQLInputObjectType(inputModel);
      }

      // If this model itself is an input model, use it directly
      if (model.name.endsWith(GraphQLSchemaBuilder.INPUT_SUFFIX)) {
        return this.createGraphQLInputObjectType(model);
      }

      // No input variant available
      throw new Error(
        `No input variant found for model '${model.name}'. Expected corresponding '${inputModelName}' model to exist.`,
      );
    }

    if (type.kind === "Enum") {
      return this.convertEnumType(type as Enum) as GraphQLInputType;
    }

    if (type.kind === "Scalar") {
      return this.convertScalarType(type) as GraphQLInputType;
    }

    if (type.kind === "Intrinsic") {
      // Handle TypeSpec intrinsic types like void, never, etc.
      return this.convertScalarType(type) as GraphQLInputType;
    }

    throw new Error(`Unsupported type for GraphQL input: ${type.kind}`);
  }

  /**
   * Registers a TSP model as a GraphQL type
   * After denormalization, uses name-based detection for input vs output types
   */
  registerModel(model: Model): void {
    // Skip Array types - they're handled as GraphQL Lists
    if (model.name === GraphQLSchemaBuilder.ARRAY_MODEL_NAME) {
      return;
    }

    // After denormalization, input models have "Input" suffix
    if (model.name.endsWith(GraphQLSchemaBuilder.INPUT_SUFFIX)) {
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
    if (
      operation.parameters &&
      operation.parameters.properties &&
      operation.parameters.properties.size > 0
    ) {
      for (const [name, param] of operation.parameters.properties) {
        const inputType = this.getGraphQLInputType(param.type);
        if (inputType) {
          args[name] = { type: inputType };
        }
      }
    }

    // Store the processed operation in the registry
    this.operationsRegistry.set(operation.name, {
      type: returnType,
      args: Object.keys(args).length ? args : undefined,
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
