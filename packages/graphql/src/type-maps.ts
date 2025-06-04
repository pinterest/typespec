import { UsageFlags, type Enum, type Model } from "@typespec/compiler";
import {
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  type GraphQLEnumValueConfig,
  type GraphQLFieldConfigMap,
  type GraphQLInputFieldConfigMap,
  type GraphQLInputType,
  type GraphQLOutputType,
  type GraphQLFieldConfigArgumentMap,
} from "graphql";

/**
 * TypeSpec context for type mapping
 * @template T - The TypeSpec type
 */
export interface TSPContext<T = any> {
  type: T;                    // The TypeSpec type
  usageFlag: UsageFlags;      // How the type is being used
  name?: string;              // Optional name override
  metadata?: Record<string, any>; // Optional additional metadata
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
  private fieldMap = new Map<string, ThunkFieldConfig>();
  
  /**
   * Add a field with thunk configuration
   */
  addField(
    fieldName: string, 
    type: ThunkGraphQLType,
    isOptional: boolean, 
    isList: boolean,
    args?: ThunkGraphQLFieldConfigArgumentMap
  ): void {
    this.fieldMap.set(fieldName, {
      type,
      isOptional,
      isList,
      args
    });
  }
  
  /**
   * Get all field thunk configurations
   */
  getFieldThunks(): Map<string, ThunkFieldConfig> {
    return this.fieldMap;
  }
}

/**
 * Base TypeMap for all GraphQL type mappings
 * @template T - The TypeSpec type
 * @template G - The GraphQL type
 */
export abstract class TypeMap<T, G> {
  // Map of materialized GraphQL types
  protected materializedMap = new Map<string, G>();
  
  // Map of registration contexts
  protected registrationMap = new Map<string, TSPContext<T>>();
  
  /**
   * Register a TypeSpec type with context for later materialization
   * @param context - The TypeSpec context
   * @returns The name used for registration
   */
  register(context: TSPContext<T>): string {
    const name = this.getNameFromContext(context);
    
    // Check for conflicts with existing registrations
    const existing = this.registrationMap.get(name);
    if (existing && existing.usageFlag !== context.usageFlag) {
      throw new Error(
        `Type conflict for "${name}": attempting to register as ${UsageFlags[context.usageFlag]} but already registered as ${UsageFlags[existing.usageFlag]}`
      );
    }
    
    this.registrationMap.set(name, context);
    return name;
  }
  
  /**
   * Get the materialized GraphQL type
   * @param name - The type name
   * @returns The materialized GraphQL type or undefined
   */
  get(name: string): G | undefined {
    // Return already materialized type if available
    if (this.materializedMap.has(name)) {
      return this.materializedMap.get(name);
    }
    
    // Attempt to materialize if registered
    const context = this.registrationMap.get(name);
    if (context) {
      const materializedType = this.materialize(context);
      if (materializedType) {
        this.materializedMap.set(name, materializedType);
        return materializedType;
      }
    }
    
    return undefined;
  }
  
  /**
   * Check if a type is registered
   */
  isRegistered(name: string): boolean {
    return this.registrationMap.has(name);
  }
  
  /**
   * Get all materialized types
   */
  getAllMaterialized(): G[] {
    return Array.from(this.materializedMap.values());
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
  protected abstract getNameFromContext(context: TSPContext<T>): string;
  
  /**
   * Materialize a type from a context
   */
  protected abstract materialize(context: TSPContext<T>): G | undefined;
}

/**
 * TypeMap for GraphQL Object types (output types)
 */
export class ObjectTypeMap extends TypeMap<Model, GraphQLObjectType> {
  // Maps for fields by model name
  private modelFieldMaps = new Map<string, ModelFieldMap>();
  
  // For handling interfaces
  private interfacesMap = new Map<string, GraphQLInterfaceType[]>();
  
  /**
   * Get a name from a context
   */
  protected override getNameFromContext(context: TSPContext<Model>): string {
    return context.name || context.type.name || '';
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
    args?: ThunkGraphQLFieldConfigArgumentMap
  ): void {
    if (!this.modelFieldMaps.has(modelName)) {
      this.modelFieldMaps.set(modelName, new ModelFieldMap());
    }
    
    this.modelFieldMaps.get(modelName)!.addField(
      fieldName,
      type,
      isOptional,
      isList,
      args
    );
  }
  
  /**
   * Add an interface to a model
   */
  addInterface(modelName: string, interfaceType: GraphQLInterfaceType): void {
    if (!this.interfacesMap.has(modelName)) {
      this.interfacesMap.set(modelName, []);
    }
    this.interfacesMap.get(modelName)!.push(interfaceType);
  }
  
  /**
   * Get interfaces for a model
   */
  getInterfaces(modelName: string): GraphQLInterfaceType[] {
    return this.interfacesMap.get(modelName) || [];
  }
  
  /**
   * Materialize a GraphQL object type
   */
  protected override materialize(context: TSPContext<Model>): GraphQLObjectType | undefined {
    const modelName = this.getNameFromContext(context);
    
    return new GraphQLObjectType({
      name: modelName,
      fields: () => this.materializeFields(modelName),
      interfaces: () => this.getInterfaces(modelName)
    });
  }
  
  /**
   * Materialize fields for a model
   */
  private materializeFields(modelName: string): GraphQLFieldConfigMap<any, any> {
    const fieldMap = this.modelFieldMaps.get(modelName);
    if (!fieldMap) {
      return {};
    }
    
    const result: GraphQLFieldConfigMap<any, any> = {};
    const fieldThunks = fieldMap.getFieldThunks();
    
    fieldThunks.forEach((config, fieldName) => {
      let fieldType = config.type() as GraphQLOutputType;
      
      if (fieldType instanceof GraphQLInputObjectType) {
        throw new Error(
          `Model "${modelName}" has a field "${fieldName}" that is an input type. It should be an output type.`
        );
      }
      
      if (config.isList) {
        fieldType = new GraphQLNonNull(new GraphQLList(fieldType));
      }
      
      result[fieldName] = {
        type: fieldType,
        args: config.args ? config.args() : undefined
      };
    });
    
    return result;
  }
}

/**
 * TypeMap for GraphQL Input types
 */
export class InputTypeMap extends TypeMap<Model, GraphQLInputObjectType> {
  // Maps for fields by model name
  private modelFieldMaps = new Map<string, ModelFieldMap>();
  
  /**
   * Get a name from a context
   */
  protected override getNameFromContext(context: TSPContext<Model>): string {
    return context.name || `${context.type.name || ''}Input`;
  }
  
  /**
   * Register a field for an input model
   */
  registerField(
    modelName: string,
    fieldName: string,
    type: ThunkGraphQLType,
    isOptional: boolean,
    isList: boolean
  ): void {
    if (!this.modelFieldMaps.has(modelName)) {
      this.modelFieldMaps.set(modelName, new ModelFieldMap());
    }
    
    this.modelFieldMaps.get(modelName)!.addField(
      fieldName,
      type,
      isOptional,
      isList
    );
  }
  
  /**
   * Materialize a GraphQL input type
   */
  protected override materialize(context: TSPContext<Model>): GraphQLInputObjectType | undefined {
    const modelName = this.getNameFromContext(context);
    
    return new GraphQLInputObjectType({
      name: modelName,
      fields: () => this.materializeFields(modelName)
    });
  }
  
  /**
   * Materialize fields for an input model
   */
  private materializeFields(modelName: string): GraphQLInputFieldConfigMap {
    const fieldMap = this.modelFieldMaps.get(modelName);
    if (!fieldMap) {
      return {};
    }
    
    const result: GraphQLInputFieldConfigMap = {};
    const fieldThunks = fieldMap.getFieldThunks();
    
    fieldThunks.forEach((config, fieldName) => {
      let fieldType = config.type() as GraphQLInputType;
      
      if (fieldType instanceof GraphQLObjectType) {
        throw new Error(
          `Input model "${modelName}" has a field "${fieldName}" that is an output type. It should be an input type.`
        );
      }
      
      if (config.isList) {
        fieldType = new GraphQLNonNull(new GraphQLList(fieldType));
      }
      
      result[fieldName] = {
        type: fieldType
      };
    });
    
    return result;
  }
}

/**
 * TypeMap for GraphQL Enum types
 */
export class EnumTypeMap extends TypeMap<Enum, GraphQLEnumType> {
  
  /**
   * Get a name from a context
   */
  protected override getNameFromContext(context: TSPContext<Enum>): string {
    return context.name || context.type.name || '';
  }
  
  /**
   * Sanitize enum member names for GraphQL compatibility
   */
  private sanitizeEnumMemberName(name: string): string {
    // Basic sanitization - replace invalid characters and ensure it starts with letter/underscore
    return name.replace(/[^A-Za-z0-9_]/g, '_').replace(/^[^A-Za-z_]/, '_$&');
  }
  
  /**
   * Materialize a GraphQL enum type
   */
  protected override materialize(context: TSPContext<Enum>): GraphQLEnumType | undefined {
    const enumType = context.type;
    const name = this.getNameFromContext(context);
    
    return new GraphQLEnumType({
      name,
      values: Array.from(enumType.members.values()).reduce<{
        [key: string]: GraphQLEnumValueConfig;
      }>((acc, member) => {
        acc[this.sanitizeEnumMemberName(member.name)] = {
          value: member.value ?? member.name,
        };
        return acc;
      }, {})
    });
  }
} 