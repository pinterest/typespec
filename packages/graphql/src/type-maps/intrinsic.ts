import type { IntrinsicScalarName, Program, Scalar } from "@typespec/compiler";
import {
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLInt,
  GraphQLString,
  type GraphQLScalarType,
} from "graphql";

/**
 * Get the GraphQL scalar type for a TypeSpec intrinsic scalar.
 * Returns undefined if the scalar is not an intrinsic type that maps to a GraphQL built-in.
 *
 * Uses program.checker.isStdType to check scalar types for accurate type checking
 * (handles extended scalars like int32 extends int64).
 *
 * @param program - The TypeSpec program
 * @param scalar - The TypeSpec scalar to check
 * @returns The corresponding GraphQL scalar type, or undefined if not an intrinsic
 */
export function getIntrinsicGraphQLType(
  program: Program,
  scalar: Scalar,
): GraphQLScalarType | undefined {
  // String type
  if (program.checker.isStdType(scalar, "string")) {
    return GraphQLString;
  }

  // Boolean type
  if (program.checker.isStdType(scalar, "boolean")) {
    return GraphQLBoolean;
  }

  // Integer types - all map to GraphQL Int (32-bit signed integer)
  // Note: GraphQL Int is technically int32, but we map all integer types to it
  if (
    program.checker.isStdType(scalar, "int8") ||
    program.checker.isStdType(scalar, "int16") ||
    program.checker.isStdType(scalar, "int32") ||
    program.checker.isStdType(scalar, "int64") ||
    program.checker.isStdType(scalar, "uint8") ||
    program.checker.isStdType(scalar, "uint16") ||
    program.checker.isStdType(scalar, "uint32") ||
    program.checker.isStdType(scalar, "uint64") ||
    program.checker.isStdType(scalar, "integer") ||
    program.checker.isStdType(scalar, "safeint")
  ) {
    return GraphQLInt;
  }

  // Float types - all map to GraphQL Float
  if (
    program.checker.isStdType(scalar, "float32") ||
    program.checker.isStdType(scalar, "float64") ||
    program.checker.isStdType(scalar, "float") ||
    program.checker.isStdType(scalar, "decimal") ||
    program.checker.isStdType(scalar, "decimal128") ||
    program.checker.isStdType(scalar, "numeric")
  ) {
    return GraphQLFloat;
  }

  // Other intrinsic types (bytes, plainDate, plainTime, utcDateTime, offsetDateTime, duration, url)
  // are not mapped to built-in GraphQL scalars - they should be treated as custom scalars
  return undefined;
}
