import { UsageFlags, type Model, type Program, type Type } from "@typespec/compiler";
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
import { getIntrinsicGraphQLType } from "./intrinsic.js";

/**
 * TypeMap for converting TypeSpec Models to GraphQL ObjectTypes or InputObjectTypes.
 *
 * Handles registration of TSP models and lazy materialization into
 * GraphQLObjectType (for output) or GraphQLInputObjectType (for input) instances.
 * The usageFlag in TSPContext determines which type to create.
 */
export class ModelTypeMap extends TypeMap<Model, GraphQLObjectType | GraphQLInputObjectType> {
  private program: Program;

  constructor(program: Program) {
    super();
    this.program = program;
  }
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
   */
  private mapOutputType(type: Type): GraphQLOutputType {
    // Handle Scalar types (including intrinsics)
    if (type.kind === "Scalar") {
      const intrinsicType = getIntrinsicGraphQLType(this.program, type);
      if (intrinsicType) {
        return intrinsicType;
      }

      // If not an intrinsic, it's a custom scalar
      // TODO: Handle custom scalars in PR #4
      return GraphQLString; // Placeholder for custom scalars
    }

    // TODO: Handle other types (Model, Enum, Array, Union) in future PRs
    return GraphQLString;
  }

  /**
   * Map a TypeSpec property type to a GraphQL input type.
   */
  private mapInputType(type: Type): GraphQLInputType {
    // Handle Scalar types (including intrinsics)
    if (type.kind === "Scalar") {
      // Check if it's an intrinsic scalar
      const intrinsicType = getIntrinsicGraphQLType(this.program, type);
      if (intrinsicType) {
        return intrinsicType;
      }

      // If not an intrinsic, it's a custom scalar
      // TODO: Handle custom scalars in PR #4
      return GraphQLString; // Placeholder for custom scalars
    }

    // TODO: Handle other types (Model, Enum, Array) in future PRs
    // Note: Unions cannot be input types in GraphQL
    return GraphQLString;
  }
}
