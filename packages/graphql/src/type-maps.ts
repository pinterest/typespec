import { UsageFlags, type Model, type Type } from "@typespec/compiler";
import {
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  type GraphQLFieldConfigArgumentMap,
  type GraphQLFieldConfigMap,
  type GraphQLInputType,
  type GraphQLOutputType,
  type GraphQLType,
} from "graphql";

/**
 * TypeSpec context for type mapping
 * @template T - The TypeSpec type
 */
export interface TSPContext<T extends Type> {
  type: T; // The TypeSpec type
  usageFlag: UsageFlags; // How the type is being used (input, output, etc.)
  graphqlName?: string; // Optional GraphQL type name override (e.g., "ModelInput" for input types)
  metadata: Record<string, any>; // Additional metadata
}

/**
 * Thunk types for lazy evaluation of GraphQL types and arguments
 */
export type ThunkGraphQLType = () => GraphQLInputType | GraphQLOutputType;
export type ThunkGraphQLFieldConfigArgumentMap = () => GraphQLFieldConfigArgumentMap;

/**
 * Configuration for thunk-based field definitions
 */
export interface ThunkFieldConfig {
  type: ThunkGraphQLType;
  isOptional: boolean;
  isList: boolean;
  args?: ThunkGraphQLFieldConfigArgumentMap;
}

/**
 * Model field map to store thunk field configurations
 */
export class ModelFieldMap {
  #fieldMap = new Map<string, ThunkFieldConfig>();

  /**
   * Add a field with thunk configuration
   */
  addField(
    fieldName: string,
    type: ThunkGraphQLType,
    isOptional: boolean,
    isList: boolean,
    args?: ThunkGraphQLFieldConfigArgumentMap,
  ): void {
    this.#fieldMap.set(fieldName, {
      type,
      isOptional,
      isList,
      args,
    });
  }

  /**
   * Get all field thunk configurations
   */
  getFieldThunks(): Map<string, ThunkFieldConfig> {
    return this.#fieldMap;
  }
}

/**
 * Nominal type for keys in the TypeMap
 */
export type TypeKey = string & { __typeKey: any };

/**
 * Base TypeMap for all GraphQL type mappings
 * @template T - The TypeSpec type constrained to TSP's Type
 * @template G - The GraphQL type constrained to GraphQL's GraphQLType
 */
export abstract class TypeMap<T extends Type, G extends GraphQLType> {
  // Map of materialized GraphQL types
  protected materializedMap = new Map<TypeKey, G>();

  // Map of registration contexts
  protected registrationMap = new Map<TypeKey, TSPContext<T>>();

  /**
   * Register a TypeSpec type with context for later materialization
   * @param context - The TypeSpec context
   * @returns The name used for registration as a TypeKey
   */
  register(context: TSPContext<T>): TypeKey {
    // Check if the type is already registered
    const name = this.getNameFromContext(context);
    if (this.isRegistered(name)) {
      throw new Error(`Type ${name} is already registered`);
    }

    // Register the type
    this.registrationMap.set(name, context);
    return name;
  }

  /**
   * Get the materialized GraphQL type
   * @param name - The type name as a TypeKey
   * @returns The materialized GraphQL type or undefined
   */
  get(name: TypeKey): G | undefined {
    // Return already materialized type if available
    if (this.materializedMap.has(name)) {
      return this.materializedMap.get(name);
    }

    // Attempt to materialize if registered
    const context = this.registrationMap.get(name);
    if (context) {
      const materializedType = this.materialize(context);
      this.materializedMap.set(name, materializedType);
      return materializedType;
    }

    return undefined;
  }

  /**
   * Check if a type is registered
   */
  isRegistered(name: string): boolean {
    return this.registrationMap.has(name as TypeKey);
  }

  /**
   * Get all materialized types
   */
  getAllMaterialized(): MapIterator<G> {
    return this.materializedMap.values();
  }

  /**
   * Reset the type map
   */
  reset(): void {
    this.materializedMap.clear();
    this.registrationMap.clear();
  }

  /**
   * Get a name from a context
   */
  protected abstract getNameFromContext(context: TSPContext<T>): TypeKey;

  /**
   * Materialize a type from a context
   */
  protected abstract materialize(context: TSPContext<T>): G;
}

/**
 * TypeMap for GraphQL Object types (output types)
 */
export class ObjectTypeMap extends TypeMap<Model, GraphQLObjectType> {
  // Maps for fields by model name
  #modelFieldMaps = new Map<string, ModelFieldMap>();

  // For handling interfaces
  #interfacesMap = new Map<string, GraphQLInterfaceType[]>();

  /**
   * Get a name from a context
   */
  protected override getNameFromContext(context: TSPContext<Model>): TypeKey {
    return (context.graphqlName as TypeKey) || (context.type.name as TypeKey) || ("" as TypeKey);
  }

  /**
   * Register a field for a model
   */
  registerField(
    modelName: string,
    fieldName: string,
    type: ThunkGraphQLType,
    isOptional: boolean,
    isList: boolean,
    args?: ThunkGraphQLFieldConfigArgumentMap,
  ): void {
    if (!this.#modelFieldMaps.has(modelName)) {
      this.#modelFieldMaps.set(modelName, new ModelFieldMap());
    }

    this.#modelFieldMaps.get(modelName)!.addField(fieldName, type, isOptional, isList, args);
  }

  /**
   * Add an interface to a model
   */
  addInterface(modelName: string, interfaceType: GraphQLInterfaceType): void {
    if (!this.#interfacesMap.has(modelName)) {
      this.#interfacesMap.set(modelName, []);
    }
    this.#interfacesMap.get(modelName)!.push(interfaceType);
  }

  /**
   * Get interfaces for a model
   */
  getInterfaces(modelName: string): GraphQLInterfaceType[] {
    return this.#interfacesMap.get(modelName) || [];
  }

  /**
   * Check if a model has any fields
   */
  hasFields(modelName: string): boolean {
    const fieldMap = this.#modelFieldMaps.get(modelName);
    return fieldMap ? fieldMap.getFieldThunks().size > 0 : false;
  }

  /**
   * Get the materialized GraphQL type, but only if it has fields
   * @param name - The type name as a TypeKey
   * @returns The materialized GraphQL type or undefined
   */
  override get(name: TypeKey): GraphQLObjectType | undefined {
    // Return already materialized type if available
    if (this.materializedMap.has(name)) {
      return this.materializedMap.get(name);
    }

    // Check if the model has fields before attempting to materialize
    // GraphQL requires object types to have at least one field
    if (!this.hasFields(name)) {
      return undefined;
    }

    // Attempt to materialize if registered
    const context = this.registrationMap.get(name);
    if (context) {
      const materializedType = this.materialize(context);
      this.materializedMap.set(name, materializedType);
      return materializedType;
    }

    return undefined;
  }

  /**
   * Materialize a GraphQL object type
   */
  protected override materialize(context: TSPContext<Model>): GraphQLObjectType {
    const modelName = this.getNameFromContext(context);

    return new GraphQLObjectType({
      name: modelName,
      fields: () => this.#materializeFields(modelName),
      interfaces: () => this.getInterfaces(modelName),
    });
  }

  /**
   * Materialize fields for a model
   */
  #materializeFields(modelName: string): GraphQLFieldConfigMap<any, any> {
    const fieldMap = this.#modelFieldMaps.get(modelName);
    if (!fieldMap) {
      return {};
    }

    const result: GraphQLFieldConfigMap<any, any> = {};
    const fieldThunks = fieldMap.getFieldThunks();

    fieldThunks.forEach((config, fieldName) => {
      let fieldType = config.type() as GraphQLOutputType;

      if (fieldType instanceof GraphQLInputObjectType) {
        throw new Error(
          `Model "${modelName}" has a field "${fieldName}" that is an input type. It should be an output type.`,
        );
      }

      if (!config.isOptional) {
        fieldType = new GraphQLNonNull(fieldType);
      }

      if (config.isList) {
        fieldType = new GraphQLNonNull(new GraphQLList(fieldType));
      }

      result[fieldName] = {
        type: fieldType,
        args: config.args ? config.args() : undefined,
      };
    });

    return result;
  }
}
