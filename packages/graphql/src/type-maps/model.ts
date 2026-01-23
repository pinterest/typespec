import { UsageFlags, type Model } from "@typespec/compiler";
import {
  GraphQLInputObjectType,
  GraphQLObjectType,
  GraphQLString,
  type GraphQLFieldConfigMap,
  type GraphQLInputFieldConfigMap,
} from "graphql";
import { TypeMap, type TSPContext, type TypeKey } from "../type-maps.js";

/**
 * TypeMap for converting TypeSpec Models to GraphQL ObjectTypes or InputObjectTypes.
 *
 * Handles registration of TSP models and lazy materialization into
 * GraphQLObjectType (for output) or GraphQLInputObjectType (for input) instances.
 * The usageFlag in TSPContext determines which type to create.
 */
export class ModelTypeMap extends TypeMap<Model, GraphQLObjectType | GraphQLInputObjectType> {
  /**
   * Derives the type key from the mutated model's name.
   */
  protected getNameFromContext(context: TSPContext<Model>): TypeKey {
    return context.type.name as TypeKey;
  }

  /**
   * Materializes a TypeSpec Model into a GraphQL ObjectType or InputObjectType.
   */
  protected materialize(context: TSPContext<Model>): GraphQLObjectType | GraphQLInputObjectType {
    const tspModel = context.type;
    const name = tspModel.name;

    // Create InputObjectType for input usage, ObjectType for output
    if (context.usageFlag === UsageFlags.Input) {
      return this.materializeInputType(name, tspModel);
    }
    return this.materializeOutputType(name, tspModel);
  }

  private materializeOutputType(name: string, tspModel: Model): GraphQLObjectType {
    const fields: GraphQLFieldConfigMap<unknown, unknown> = {};

    for (const [propName, prop] of tspModel.properties) {
      fields[propName] = {
        type: this.mapPropertyType(prop.type),
        // TODO: Add description from doc comments
      };
    }

    return new GraphQLObjectType({ name, fields });
  }

  private materializeInputType(name: string, tspModel: Model): GraphQLInputObjectType {
    const fields: GraphQLInputFieldConfigMap = {};

    for (const [propName, prop] of tspModel.properties) {
      fields[propName] = {
        type: this.mapPropertyType(prop.type),
        // TODO: Add description from doc comments
      };
    }

    return new GraphQLInputObjectType({ name, fields });
  }

  /**
   * Map a TypeSpec property type to a GraphQL String type.
   * TODO: Implement full type mapping with references to other registered types.
   */
  private mapPropertyType(_type: unknown): typeof GraphQLString {
    // Placeholder - will need to resolve references to other types
    return GraphQLString;
  }
}
