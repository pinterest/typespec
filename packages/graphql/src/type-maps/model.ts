import { UsageFlags, type Model } from "@typespec/compiler";
import {
  GraphQLInputObjectType,
  GraphQLObjectType,
  GraphQLString,
  type GraphQLFieldConfigMap,
  type GraphQLInputFieldConfigMap,
  type GraphQLInputType,
  type GraphQLOutputType,
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
      return this.materializeInputType(tspModel, name);
    }
    return this.materializeOutputType(tspModel, name);
  }

  /**
   * Materialize as a GraphQLObjectType (output type).
   */
  private materializeOutputType(tspModel: Model, name: string): GraphQLObjectType {
    const fields: GraphQLFieldConfigMap<unknown, unknown> = {};

    for (const [propName, prop] of tspModel.properties) {
      fields[propName] = {
        type: this.mapOutputType(prop.type),
      };
    }

    return new GraphQLObjectType({ name, fields });
  }

  /**
   * Materialize as a GraphQLInputObjectType (input type).
   */
  private materializeInputType(tspModel: Model, name: string): GraphQLInputObjectType {
    const fields: GraphQLInputFieldConfigMap = {};

    for (const [propName, prop] of tspModel.properties) {
      fields[propName] = {
        type: this.mapInputType(prop.type),
      };
    }

    return new GraphQLInputObjectType({ name, fields });
  }

  /**
   * Map a TypeSpec property type to a GraphQL output type.
   * TODO: Implement full type mapping with references to other registered types.
   */
  private mapOutputType(_type: unknown): GraphQLOutputType {
    // Placeholder - will need to resolve references to other types
    return GraphQLString;
  }

  /**
   * Map a TypeSpec property type to a GraphQL input type.
   * TODO: Implement full type mapping with references to other registered types.
   */
  private mapInputType(_type: unknown): GraphQLInputType {
    // Placeholder - will need to resolve references to other types
    return GraphQLString;
  }
}
