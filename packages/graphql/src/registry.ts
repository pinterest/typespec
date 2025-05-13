import {
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLUnionType,
  type GraphQLSchemaConfig,
} from "graphql";

export class GraphQLTypeRegistry {
  // A map of type names to their corresponding GraphQL types
  private types: Map<
    string,
    | GraphQLScalarType
    | GraphQLObjectType
    | GraphQLInputObjectType
    | GraphQLEnumType
    | GraphQLUnionType
  > = new Map();

  constructor() {}

  /**
   * Registers a new GraphQL type in the registry.
   * @param name The name of the type as defined in the TypeSpec program.
   * @param type The GraphQL type to register.
   */
  registerType(
    name: string,
    type:
      | GraphQLScalarType
      | GraphQLObjectType
      | GraphQLInputObjectType
      | GraphQLEnumType
      | GraphQLUnionType,
  ) {
    // TODO: Add custom logic needed for registering specific types
    this.types.set(name, type);
  }

  /**
   * Retrieves a GraphQL type by its name.
   * @param name The name of the type to retrieve.
   * @returns The GraphQL type if found, otherwise undefined.
   */
  getType(
    name: string,
  ):
    | GraphQLScalarType
    | GraphQLObjectType
    | GraphQLInputObjectType
    | GraphQLEnumType
    | GraphQLUnionType
    | undefined {
    return this.types.get(name);
  }

  /**
   * Checks if a type is registered in the registry.
   * @param name The name of the type to check.
   * @returns True if the type is registered, otherwise false.
   */
  hasType(name: string): boolean {
    return this.types.has(name);
  }

  materializeSchemaConfig(): GraphQLSchemaConfig {
    // TODO: Update logic to materialize the schema config from the registered types. For now, it returns a placeholder schema.
    const schemaConfig: GraphQLSchemaConfig = {
      query: new GraphQLObjectType({
        name: "Query",
        fields: {
          _: {
            type: GraphQLBoolean,
            description:
              "A placeholder field. If you are seeing this, it means no operations were defined that could be emitted.",
          },
        },
      }),
    };
    return schemaConfig;
  }
}
