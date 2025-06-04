import {
  GraphQLBoolean,
  GraphQLString,
  GraphQLInt,
  GraphQLFloat,
  type GraphQLInputType,
  type GraphQLOutputType,
} from "graphql";

/**
 * Map TypeSpec scalar types to GraphQL scalar types
 */
export function mapScalarToGraphQL(scalarName: string): GraphQLInputType | GraphQLOutputType {
  switch (scalarName) {
    case "string":
      return GraphQLString;
    case "int32":
    case "integer":
      return GraphQLInt;
    case "int64":
      // GraphQL doesn't have int64, use string representation
      return GraphQLString;
    case "float32":
    case "float64":
      return GraphQLFloat;
    case "boolean":
      return GraphQLBoolean;
    default:
      return GraphQLString;
  }
} 