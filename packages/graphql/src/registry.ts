import { UsageFlags, type Enum, type Model } from "@typespec/compiler";
import {
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLObjectType,
  GraphQLString,
  type GraphQLNamedType,
  type GraphQLOutputType,
  type GraphQLSchemaConfig,
} from "graphql";

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
 *  - Handling forward references and circular dependencies through thunks
 */
export class GraphQLTypeRegistry {
  // Stores intermediate TSP type information, keyed by TSP type name.
  private TSPTypeContextRegistry: Map<string, TSPTypeContext> = new Map();

  // Stores materialized GraphQL types, keyed by their GraphQL name.
  private materializedGraphQLTypes: Map<string, GraphQLNamedType> = new Map();

  addEnum(tspEnum: Enum): void {
    const enumName = tspEnum.name;
    if (this.TSPTypeContextRegistry.has(enumName)) {
      // Optionally, log a warning or update if new information is more complete.
      return;
    }

    this.TSPTypeContextRegistry.set(enumName, {
      tspType: tspEnum,
      name: enumName,
      // TODO: Populate usageFlags based on TSP context and other decorator context.
    });
  }

  addModel(tspModel: Model): void {
    const modelName = tspModel.name;
    if (this.TSPTypeContextRegistry.has(modelName)) {
      // Optionally, log a warning or update if new information is more complete.
      return;
    }

    this.TSPTypeContextRegistry.set(modelName, {
      tspType: tspModel,
      name: modelName,
      // TODO: Populate usageFlags based on TSP context and other decorator context.
    });
  }

  // Materializes a TSP Enum into a GraphQLEnumType.
  materializeEnum(enumName: string): GraphQLEnumType | undefined {
    // Check if the GraphQL type is already materialized.
    if (this.materializedGraphQLTypes.has(enumName)) {
      return this.materializedGraphQLTypes.get(enumName) as GraphQLEnumType;
    }

    const context = this.TSPTypeContextRegistry.get(enumName);
    if (!context || context.tspType.kind !== "Enum") {
      // TODO: Handle error or warning for missing context.
      return undefined;
    }

    const tspEnum = context.tspType as Enum;

    const gqlEnum = new GraphQLEnumType({
      name: context.name,
      values: Object.fromEntries(
        Array.from(tspEnum.members.values()).map((member) => [
          member.name,
          {
            value: member.value ?? member.name,
          },
        ]),
      ),
    });

    this.materializedGraphQLTypes.set(enumName, gqlEnum);
    return gqlEnum;
  }

  private computeModelFields(tspModel: Model): Record<string, { type: GraphQLOutputType }> {
    const fields: Record<string, { type: GraphQLOutputType }> = {};

    // Process each property of the model
    for (const [propertyName, property] of tspModel.properties) {
      // For now, we'll handle only simple scalar types and references to other models
      // TODO: Add proper type resolution based on the property type
      let fieldType: GraphQLOutputType = GraphQLString; // Default to string for now

      // If the property type is a reference to another type, try to materialize it
      if (property.type.kind === "Model") {
        const referencedType = this.materializeModel(property.type.name);
        if (referencedType) {
          fieldType = referencedType;
        }
      } else if (property.type.kind === "Enum") {
        const referencedType = this.materializeEnum(property.type.name);
        if (referencedType) {
          fieldType = referencedType;
        }
      }

      fields[propertyName] = { type: fieldType };
    }

    return fields;
  }

  // Materializes a TSP Model into a GraphQLObjectType.
  materializeModel(modelName: string): GraphQLObjectType | undefined {
    // Check if the GraphQL type is already materialized.
    if (this.materializedGraphQLTypes.has(modelName)) {
      return this.materializedGraphQLTypes.get(modelName) as GraphQLObjectType;
    }

    const context = this.TSPTypeContextRegistry.get(modelName);
    if (!context || context.tspType.kind !== "Model") {
      // TODO: Handle error or warning for missing context.
      return undefined;
    }

    const tspModel = context.tspType as Model;

    // Create the GraphQL object type with a thunk for fields to handle forward references
    const gqlObjectType = new GraphQLObjectType({
      name: context.name,
      fields: () => this.computeModelFields(tspModel),
    });

    this.materializedGraphQLTypes.set(modelName, gqlObjectType);
    return gqlObjectType;
  }

  materializeSchemaConfig(): GraphQLSchemaConfig {
    const allMaterializedGqlTypes = Array.from(this.materializedGraphQLTypes.values());
    let queryType = this.materializedGraphQLTypes.get("Query") as GraphQLObjectType | undefined;
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
