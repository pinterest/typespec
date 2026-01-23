import { UsageFlags, type Enum, type Model } from "@typespec/compiler";
import {
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLObjectType,
  type GraphQLNamedType,
  type GraphQLSchemaConfig,
} from "graphql";
import { type TypeKey } from "./type-maps.js";
import { EnumTypeMap, ModelTypeMap } from "./type-maps/index.js";
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
  // TypeMaps for each type kind
  private enumTypeMap = new EnumTypeMap();
  private modelTypeMap = new ModelTypeMap();

  // Track all registered names to detect cross-TypeMap name collisions
  private allRegisteredNames = new Set<string>();

  addEnum(tspEnum: Enum): void {
    const enumName = tspEnum.name;

    // Check for duplicate names across all type maps
    if (this.allRegisteredNames.has(enumName)) {
      // Already registered (could be same enum or name collision)
      // TODO: Add a warning to the diagnostics
      return;
    }

    this.enumTypeMap.register({
      type: tspEnum,
      usageFlag: UsageFlags.Output, // Enums are same for input/output
    });
    this.allRegisteredNames.add(enumName);
  }

  addModel(tspModel: Model, usageFlag: UsageFlags): void {
    const modelName = tspModel.name;

    // Check for duplicate names across all type maps
    if (this.allRegisteredNames.has(modelName)) {
      // Already registered (could be same model or name collision)
      return;
    }

    this.modelTypeMap.register({
      type: tspModel,
      usageFlag,
    });
    this.allRegisteredNames.add(modelName);
  }

  materializeEnum(enumName: string): GraphQLEnumType | undefined {
    return this.enumTypeMap.get(enumName as TypeKey);
  }

  materializeModel(modelName: string): GraphQLObjectType | GraphQLInputObjectType | undefined {
    return this.modelTypeMap.get(modelName as TypeKey);
  }

  materializeSchemaConfig(): GraphQLSchemaConfig {
    // Collect all materialized types from all TypeMaps
    const allMaterializedGqlTypes: GraphQLNamedType[] = [
      ...this.enumTypeMap.getAllMaterialized(),
      ...this.modelTypeMap.getAllMaterialized(),
    ];
    // TODO: Query type will come from operations
    let queryType: GraphQLObjectType | undefined = undefined;
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
