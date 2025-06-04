import {
  isArrayModelType,
  UsageFlags,
  type Enum,
  type Model,
  type ModelProperty,
  type Program,
  type UsageTracker,
} from "@typespec/compiler";
import {
  GraphQLBoolean,
  GraphQLObjectType,
  GraphQLString,
  type GraphQLEnumType,
  type GraphQLInputObjectType,
  type GraphQLInputType,
  type GraphQLNamedType,
  type GraphQLOutputType,
  type GraphQLSchemaConfig,
} from "graphql";
import { mapScalarToGraphQL } from "./lib/scalars.js";
import { EnumTypeMap, InputTypeMap, ObjectTypeMap, type TSPContext } from "./type-maps.js";

/**
 * Model type name tracking for usage flags
 */
interface ModelTypeNames {
  [UsageFlags.Input]?: string;
  [UsageFlags.Output]?: string;
  [UsageFlags.None]?: string;
}

/**
 * Registry for managing model type names with usage flags
 */
class ModelTypeRegistry {
  private typeNames = new Map<string, ModelTypeNames>();

  /**
   * Register a type name with a usage flag
   */
  registerTypeName(modelName: string, usageFlag: UsageFlags): string {
    if (!this.typeNames.has(modelName)) {
      this.typeNames.set(modelName, {});
    }

    const typeNames = this.typeNames.get(modelName)!;

    let graphqlTypeName: string;
    if (usageFlag === UsageFlags.Input) {
      graphqlTypeName = `${modelName}Input`;
    } else {
      graphqlTypeName = modelName;
    }

    typeNames[usageFlag] = graphqlTypeName;
    return graphqlTypeName;
  }

  /**
   * Get all GraphQL type names for a model
   */
  getModelTypeNames(modelName: string): ModelTypeNames {
    return this.typeNames.get(modelName) || {};
  }

  /**
   * Reset the registry
   */
  reset(): void {
    this.typeNames.clear();
  }
}

/**
 * GraphQLTypeRegistry manages the registration and materialization of TypeSpec (TSP)
 * types into their corresponding GraphQL type definitions.
 *
 * This registry uses a sophisticated type mapping system with specialized maps for
 * different GraphQL types, thunk-based field handling, and proper usage context tracking.
 */
export class GraphQLTypeRegistry {
  // Type name registry
  private modelTypeNames = new ModelTypeRegistry();

  // Type maps for different GraphQL types
  private objectTypes: ObjectTypeMap;
  private inputTypes: InputTypeMap;
  private enumTypes: EnumTypeMap;

  // Usage tracker for determining input vs output usage
  private usageTracker?: UsageTracker;

  // Program instance for TypeSpec utilities
  private program: Program;

  constructor(program: Program) {
    this.program = program;
    // Initialize type maps with necessary dependencies
    this.objectTypes = new ObjectTypeMap();
    this.inputTypes = new InputTypeMap();
    this.enumTypes = new EnumTypeMap();
  }

  /**
   * Set the usage tracker for determining input vs output usage
   */
  setUsageTracker(usageTracker: UsageTracker): void {
    this.usageTracker = usageTracker;
  }

  /**
   * Add a model to the registry
   */
  addModel(model: Model): void {
    const modelName = model.name;
    if (!modelName) return;

    // Always register for output usage (GraphQL object type)
    const outputTypeName = this.modelTypeNames.registerTypeName(modelName, UsageFlags.Output);
    const outputContext: TSPContext<Model> = {
      type: model,
      usageFlag: UsageFlags.Output,
      name: outputTypeName,
    };
    this.objectTypes.register(outputContext);

    // Only register for input usage if the model is actually used as input
    if (this.usageTracker?.isUsedAs(model, UsageFlags.Input)) {
      const inputTypeName = this.modelTypeNames.registerTypeName(modelName, UsageFlags.Input);
      const inputContext: TSPContext<Model> = {
        type: model,
        usageFlag: UsageFlags.Input,
        name: inputTypeName,
      };
      this.inputTypes.register(inputContext);
    }
  }

  /**
   * Materialize a model for all its registered usage contexts
   */
  materializeModelWithAllUsages(modelName: string): {
    outputType?: GraphQLObjectType;
    inputType?: GraphQLInputObjectType;
  } {
    const result: {
      outputType?: GraphQLObjectType;
      inputType?: GraphQLInputObjectType;
    } = {};

    // Get the type names for this model
    const typeNames = this.getModelTypeNames(modelName);

    // Materialize output type if registered
    const outputTypeName = typeNames[UsageFlags.Output];
    if (outputTypeName) {
      result.outputType = this.materializeModel(outputTypeName);
    }

    // Materialize input type if registered
    const inputTypeName = typeNames[UsageFlags.Input];
    if (inputTypeName) {
      result.inputType = this.materializeInputModel(inputTypeName);
    }

    return result;
  }

  /**
   * Add an enum to the registry
   */
  addEnum(tspEnum: Enum): void {
    const context: TSPContext<Enum> = {
      type: tspEnum,
      usageFlag: UsageFlags.Output, // Enums are typically output types
      name: tspEnum.name,
    };

    this.enumTypes.register(context);
  }

  /**
   * Get all GraphQL type names for a model
   */
  getModelTypeNames(modelName: string): ModelTypeNames {
    return this.modelTypeNames.getModelTypeNames(modelName);
  }

  /**
   * Add a model property using TypeSpec ModelProperty
   */
  addModelProperty(parentModelName: string, property: ModelProperty): void {
    const propertyName = property.name;

    // Determine if the property is optional
    const isOptional = property.optional;

    // Determine if the property is a list/array using TypeSpec's built-in utility
    const isList = property.type.kind === "Model" && isArrayModelType(this.program, property.type);

    // Get all GraphQL type names for the model
    const typeNames = this.getModelTypeNames(parentModelName);

    // Add to output type map with output-specific thunk
    const outputTypeName = typeNames[UsageFlags.Output];
    if (outputTypeName) {
      const outputTypeThunk = () => {
        return this.resolvePropertyType(property, UsageFlags.Output);
      };

      this.objectTypes.registerField(
        outputTypeName,
        propertyName,
        outputTypeThunk,
        isOptional,
        isList,
      );
    }

    // Add to input type map with input-specific thunk
    const inputTypeName = typeNames[UsageFlags.Input];
    if (inputTypeName) {
      const inputTypeThunk = () => {
        return this.resolvePropertyType(property, UsageFlags.Input);
      };

      this.inputTypes.registerField(
        inputTypeName,
        propertyName,
        inputTypeThunk,
        isOptional,
        isList,
      );
    }
  }

  /**
   * Resolve the GraphQL type for a model property with usage context
   */
  private resolvePropertyType(
    property: ModelProperty,
    usageFlag: UsageFlags,
  ): GraphQLInputType | GraphQLOutputType {
    const propertyType = property.type;

    switch (propertyType.kind) {
      case "Scalar":
        // Map TypeSpec scalars to GraphQL scalars
        return mapScalarToGraphQL(propertyType.name);

      case "Model":
        // Check if this is an array type - resolve to element type directly (non-recursive)
        if (isArrayModelType(this.program, propertyType)) {
          const elementType = propertyType.indexer!.value;
          return this.resolveElementType(elementType, usageFlag);
        }

        // For regular models, reference the registered type
        if (propertyType.name) {
          if (usageFlag === UsageFlags.Input) {
            const referencedInputType = this.materializeInputModel(propertyType.name);
            if (referencedInputType) {
              return referencedInputType;
            }
          } else {
            const referencedOutputType = this.materializeModel(propertyType.name);
            if (referencedOutputType) {
              return referencedOutputType;
            }
          }
        }
        // Fallback to string if model not found
        return GraphQLString;

      case "Enum":
        // Reference to an enum (enums work for both input and output)
        if (propertyType.name) {
          const referencedEnum = this.materializeEnum(propertyType.name);
          if (referencedEnum) {
            return referencedEnum;
          }
        }
        // Fallback to string if enum not found
        return GraphQLString;

      default:
        // Default to GraphQL String for unknown types
        return GraphQLString;
    }
  }

  /**
   * Resolve array element type directly
   */
  private resolveElementType(
    elementType: any,
    usageFlag: UsageFlags,
  ): GraphQLInputType | GraphQLOutputType {
    switch (elementType.kind) {
      case "Scalar":
        return mapScalarToGraphQL(elementType.name);

      case "Model":
        if (elementType.name) {
          if (usageFlag === UsageFlags.Input) {
            const referencedInputType = this.materializeInputModel(elementType.name);
            if (referencedInputType) {
              return referencedInputType;
            }
          } else {
            const referencedOutputType = this.materializeModel(elementType.name);
            if (referencedOutputType) {
              return referencedOutputType;
            }
          }
        }
        return GraphQLString;

      case "Enum":
        if (elementType.name) {
          const referencedEnum = this.materializeEnum(elementType.name);
          if (referencedEnum) {
            return referencedEnum;
          }
        }
        return GraphQLString;

      default:
        return GraphQLString;
    }
  }

  /**
   * Materialize a TSP Enum into a GraphQLEnumType
   */
  materializeEnum(enumName: string): GraphQLEnumType | undefined {
    return this.enumTypes.get(enumName);
  }

  /**
   * Materialize a TSP Model into a GraphQLObjectType
   */
  materializeModel(modelName: string): GraphQLObjectType | undefined {
    return this.objectTypes.get(modelName);
  }

  /**
   * Materialize a TSP Model into a GraphQLInputObjectType
   */
  materializeInputModel(modelName: string): GraphQLInputObjectType | undefined {
    return this.inputTypes.get(modelName);
  }

  /**
   * Generate the GraphQL schema configuration
   */
  materializeSchemaConfig(): GraphQLSchemaConfig {
    const allMaterializedGqlTypes: GraphQLNamedType[] = [
      ...this.objectTypes.getAllMaterialized(),
      ...this.inputTypes.getAllMaterialized(),
      ...this.enumTypes.getAllMaterialized(),
    ];

    let queryType = this.objectTypes.get("Query");

    if (!queryType) {
      queryType = new GraphQLObjectType({
        name: "Query",
        fields: {
          _: {
            type: GraphQLBoolean,
            description:
              "A placeholder field. If you are seeing this, it means no operations were defined that could be emitted.",
          },
        },
      });
    }

    return {
      query: queryType,
      types: allMaterializedGqlTypes.length > 0 ? allMaterializedGqlTypes : null,
    };
  }

  /**
   * Reset all registries to their initial state
   */
  reset(): void {
    this.modelTypeNames.reset();
    this.objectTypes.reset();
    this.inputTypes.reset();
    this.enumTypes.reset();
  }
}
