import type { Scalar } from "@typespec/compiler";
import { $ } from "@typespec/compiler/typekit";
import {
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLInt,
  GraphQLString,
  type GraphQLScalarType,
} from "graphql";

/**
 * Map TypeSpec scalar types to GraphQL Built-in types
 */
export function mapScalarToGraphQL(
  scalar: Scalar,
  typekit: ReturnType<typeof $>,
): GraphQLScalarType {
  // Check for string type
  if (typekit.scalar.isString(scalar)) {
    return GraphQLString;
  }

  // Check for integer types
  if (
    typekit.scalar.isInt8(scalar) ||
    typekit.scalar.isInt16(scalar) ||
    typekit.scalar.isInt32(scalar) ||
    typekit.scalar.isSafeint(scalar) ||
    typekit.scalar.isUint8(scalar) ||
    typekit.scalar.isUint16(scalar) ||
    typekit.scalar.isUint32(scalar)
  ) {
    return GraphQLInt;
  }

  // Check for float types
  if (
    typekit.scalar.isFloat32(scalar) ||
    typekit.scalar.isFloat64(scalar) ||
    typekit.scalar.isFloat(scalar)
  ) {
    return GraphQLFloat;
  }

  // Check for boolean type
  if (typekit.scalar.isBoolean(scalar)) {
    return GraphQLBoolean;
  }

  // Default to string for unknown scalar types
  return GraphQLString;
}
