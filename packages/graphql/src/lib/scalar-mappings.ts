import type { Scalar } from "@typespec/compiler";
import {
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLInt,
  GraphQLScalarType,
  GraphQLString,
} from "graphql";

/**
 * Maps TypeSpec scalar types to GraphQL scalar types.
 */
export function getGraphQLScalarType(scalar: Scalar): GraphQLScalarType | undefined {
  switch (scalar.name) {
    // String types
    case "string":
      return GraphQLString;

    // Integer types
    case "int8":
    case "int16":
    case "int32":
    case "uint8":
    case "uint16":
    case "uint32":
    case "safeint":
      return GraphQLInt;

    // Float types
    case "float":
    case "float32":
    case "float64":
      return GraphQLFloat;

    // Boolean
    case "boolean":
      return GraphQLBoolean;

    default:
      return undefined;
  }
}
