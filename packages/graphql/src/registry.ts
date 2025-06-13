import {
  UsageFlags,
  type Enum,
  type Model,
  type ModelProperty,
  type Program,
  type Type,
} from "@typespec/compiler";
import { $ } from "@typespec/compiler/typekit";
import {
  GraphQLBoolean,
  GraphQLObjectType,
  GraphQLString,
  type GraphQLInputType,
  type GraphQLOutputType,
  type GraphQLSchemaConfig,
} from "graphql";
import { mapScalarToGraphQL } from "./lib/scalars.js";
import { ObjectTypeMap, type TSPContext, type TypeKey } from "./type-maps.js";

// The TSPTypeContext interface represents the intermediate TSP type information before materialization.
// It stores the raw TSP type and any extracted metadata relevant for GraphQL generation.
interface TSPTypeContext {
  tspType: Enum | Model; // Extend with other TSP types like Operation, Interface, TSP Union, etc.
  name: string;
  usageFlags?: Set<UsageFlags>;
  // TODO: Add any other TSP-specific metadata here.
}
/**
 * GraphQLTypeRegistry manages the registration and materialization of TypeSpec (TSP)
 * types into their corresponding GraphQL type definitions.
 *
 * The registry operates in a two-stage process:
 * 1. Registration: TSP types (like Enums, Models, etc.) are first registered
 *    along with relevant metadata (e.g., name, usage flags). This stores an
 *    intermediate representation (`TSPTypeContext`) without immediately creating
 *    GraphQL types. This stage is typically performed while traversing the TSP AST.
 *    Register type by calling the appropriate method (e.g., `addEnum`).
 *
 * 2. Materialization: When a GraphQL type is needed (e.g., to build the final
 *    schema or resolve a field type), the registry can materialize the TSP type
 *    into its GraphQL counterpart (e.g., `GraphQLEnumType`, `GraphQLObjectType`).
 *    Materialize types by calling the appropriate method (e.g., `materializeEnum`).
 *
 * This approach helps in:
 *  - Decoupling TSP AST traversal from GraphQL object instantiation.
 *  - Caching materialized GraphQL types to avoid redundant work and ensure object identity.
 *  - Handling forward references and circular dependencies, as types can be
 *    registered first and materialized later when all dependencies are known or
 *    by using thunks for fields/arguments.
 */
export class GraphQLTypeRegistry {
  // Global registry to prevent GraphQL type name collisions
  static #globalNameRegistry = new Set<TypeKey>();

  // Type maps for different GraphQL types
  #objectTypes: ObjectTypeMap;

  // Program reference for using TypeSpec utilities
  #program: Program;

  // TypeSpec typekit for easy access to TypeSpec utilities
  #typekit: ReturnType<typeof $>;

  constructor(program: Program) {
    // Initialize type maps with necessary dependencies
    this.#objectTypes = new ObjectTypeMap();
    this.#program = program;
    this.#typekit = $(program);
  }

  /**
   * Reset the global name registry 
   */
  static resetGlobalRegistry(): void {
    GraphQLTypeRegistry.#globalNameRegistry.clear();
  }

  /**
   * Get GraphQL type names for a model based on usage flags
   * Returns a mapping of usage flags to their corresponding GraphQL type names
   */
  #getModelTypeNames(modelName: string): Record<UsageFlags, string | undefined> {
    // For now, we only support output types
    // TODO: Add support for input types when InputTypeMap is implemented
    const outputTypeName = this.#objectTypes.isRegistered(modelName) ? modelName : undefined;

    return {
      [UsageFlags.None]: undefined,
      [UsageFlags.Input]: undefined, // TODO: Implement when InputTypeMap is added
      [UsageFlags.Output]: outputTypeName,
    };
  }

  /**
   * Register a TSP Model
   */
  addModel(model: Model): void {
    const model_context: TSPContext<Model> = {
      type: model,
      usageFlag: UsageFlags.Output,
      graphqlName: model.name,
      metadata: {},
    };

    // Check if the model name already exists in the global registry
    const graphqlName = model_context.graphqlName as TypeKey;
    if (GraphQLTypeRegistry.#globalNameRegistry.has(graphqlName)) {
      throw new Error(
        `GraphQL type name '${graphqlName}' is already registered. Type names must be unique across the entire schema.`,
      );
    }

    this.#objectTypes.register(model_context);
    GraphQLTypeRegistry.#globalNameRegistry.add(graphqlName);

    // TODO: Register input types for models
  }

  /**
   * Materializes a TSP Model into a GraphQLObjectType.
   */
  materializeModel(modelName: string): GraphQLObjectType | undefined {
    const model = this.#objectTypes.get(modelName as TypeKey);
    return model; // This will be undefined for models with no fields, which is correct
  }

  /**
   * Register a model property
   */
  addModelProperty(property: ModelProperty): void {
    // Only process properties that have a parent model
    if (!property.model) {
      return;
    }

    // Create a thunk for the property type that will be resolved later
    const typeThunk = (): GraphQLOutputType | GraphQLInputType => {
      return this.#mapTypeSpecToGraphQL(property.type);
    };

    // Check if this property represents a list/array type
    const isListType =
      this.#typekit.model.is(property.type) && this.#typekit.array.is(property.type);

    // Register the field with the object type map
    this.#objectTypes.registerField(
      property.model.name, // modelName
      property.name, // fieldName
      typeThunk, // type (thunk)
      property.optional, // isOptional
      isListType, // isList
      undefined, // args
    );
  }

  /**
   * Maps a TypeSpec type to a GraphQL type
   */
  #mapTypeSpecToGraphQL(type: Type): GraphQLOutputType | GraphQLInputType {
    if (this.#typekit.scalar.is(type)) {
      return mapScalarToGraphQL(type, this.#typekit);
    }

    if (this.#typekit.model.is(type)) {
      if (this.#typekit.array.is(type)) {
        const elementType = this.#typekit.array.getElementType(type);
        const graphqlElementType = this.#mapTypeSpecToGraphQL(elementType);
        // Return the array element type directly for now, the GraphQLList wrapper
        // will be applied in the materializeFields method based on the isList flag
        return graphqlElementType;
      }
      // For regular model types, get the materialized GraphQL object type
      const modelType = this.#objectTypes.get(type.name as TypeKey);
      if (!modelType) {
        throw new Error(
          `Referenced model ${type.name} not found. Make sure it's registered before being referenced.`,
        );
      }
      return modelType;
    }

    // For unsupported types, log a warning and default to string
    console.warn(`Unsupported TypeSpec type: ${type.kind}, defaulting to GraphQLString`);
    return GraphQLString;
  }

  /**
   * Materialize the schema configuration for GraphQL
   */
  materializeSchemaConfig(): GraphQLSchemaConfig {
    // TODO: Add other types to allMaterializedGqlTypes
    const allMaterializedGqlTypes = Array.from(this.#objectTypes.getAllMaterialized());
    let queryType = this.#objectTypes.get("Query" as TypeKey) as GraphQLObjectType | undefined;
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
}
