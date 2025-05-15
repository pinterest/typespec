import { UsageFlags, type EnumMember, type RekeyableMap } from "@typespec/compiler";
import {
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLUnionType,
  type GraphQLSchemaConfig,
} from "graphql";

// This interface represents the GraphQL type and its associated metadata to be used during materialization.
interface GraphQLTypeContext {
  // TODO: Add more properties as needed such as fields, non-materialzed fields, etc.
  gqlType?:
    | GraphQLObjectType
    | GraphQLInputObjectType
    | GraphQLEnumType
    | GraphQLUnionType
    | GraphQLInterfaceType
    | GraphQLScalarType;
  usageFlags?: Set<UsageFlags>;
  visibility?: string; // TODO: Figure out how to represent visibility
}

export class GraphQLTypeRegistry {
  private typeRegistry: Map<string, GraphQLTypeContext> = new Map();

  constructor() {}

  registerEnum(enumName: string, enumValues: RekeyableMap<string, EnumMember>) {
    if (this.typeRegistry.has(enumName)) {
      throw new Error(`Type "${enumName}" is already registered.`);
    }
    this.typeRegistry.set(enumName, {
      gqlType: new GraphQLEnumType({
        name: enumName,
        values: Object.fromEntries(
          Array.from(enumValues.entries()).map(([key, value]) => [key, { value: value.name }]),
        ),
      }),
    });
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
