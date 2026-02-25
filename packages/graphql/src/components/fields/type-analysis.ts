import { type Type, type Program, type Union, type Scalar, type ModelProperty, isArrayModelType, getEncode, isUnknownType } from "@typespec/compiler";
import { type ModelVariants } from "../../context/index.js";
import { getUnionName, getNullableUnionType } from "../../lib/type-utils.js";
import { getScalarMapping } from "../../lib/scalar-mappings.js";

/**
 * Information about a GraphQL type after analysis
 */
export interface TypeInfo {
  /** The base type name (without wrappers) */
  typeName: string;
  /** Whether this is a list type */
  isList: boolean;
  /** Whether the field itself is non-null */
  isNonNull: boolean;
  /** Whether list items are non-null (only meaningful if isList is true) */
  itemNonNull: boolean;
}

/**
 * Analyze a TypeSpec type and return GraphQL type information
 *
 * This extracts:
 * - Base type name
 * - Whether it's a list
 * - Nullability at field and item level
 *
 * @param type The TypeSpec type to analyze
 * @param isOptional Whether the field is marked as optional
 * @param mode Whether we're in input or output context
 * @param program The TypeSpec program
 * @param modelVariants Model variant lookups
 * @param targetType Optional target type (property/parameter) to check for @encode
 * @returns Type information for rendering
 */
export function analyzeType(
  type: Type,
  isOptional: boolean,
  mode: "input" | "output",
  program: Program,
  modelVariants: ModelVariants,
  targetType?: Type
): TypeInfo {
  // Handle nullable unions first (e.g., string | null)
  if (type.kind === "Union") {
    const nullableType = getNullableUnionType(type as Union);
    if (nullableType) {
      // Unwrap the null union and analyze the inner type
      // Mark as nullable since it's a T | null union
      const inner = analyzeType(nullableType, true, mode, program, modelVariants, targetType);
      return { ...inner, isNonNull: false };
    }
  }

  // Handle arrays
  if (type.kind === "Model" && isArrayModelType(program, type)) {
    if (type.indexer?.value) {
      const elementType = type.indexer.value;

      // Check if the element type is nullable
      let elementIsNullable = false;

      if (elementType.kind === "Union") {
        elementIsNullable = getNullableUnionType(elementType as Union) !== undefined;
      }

      // Recursively analyze the element type to get its base name
      const elementInfo = analyzeType(elementType, false, mode, program, modelVariants, targetType);

      return {
        typeName: elementInfo.typeName,
        isList: true,
        // In output context: array field is non-null unless optional
        // In input context: array field is always non-null (? doesn't affect nullability)
        isNonNull: mode === "input" ? true : !isOptional,
        // Elements are non-null unless the element type is nullable
        itemNonNull: !elementIsNullable,
      };
    }
  }

  // Not a list - get the base type name
  const typeName = resolveBaseTypeName(type, mode, program, modelVariants, targetType);

  return {
    typeName,
    isList: false,
    // In output context: non-null unless optional (? means nullable)
    // In input context: always non-null (? doesn't affect nullability, only | null does)
    isNonNull: mode === "input" ? true : !isOptional,
    itemNonNull: false, // Not meaningful for non-list types
  };
}

/**
 * Resolve the base type name (without wrappers)
 * @param type The TypeSpec type to resolve
 * @param mode Whether we're in input or output context
 * @param program The TypeSpec program
 * @param modelVariants Model variant lookups
 * @param targetType Optional target type (property/parameter) to check for @encode
 * @returns The GraphQL type name
 */
function resolveBaseTypeName(
  type: Type,
  mode: "input" | "output",
  program: Program,
  modelVariants: ModelVariants,
  targetType?: Type
): string {
  // Handle unknown intrinsic type
  if (isUnknownType(type)) {
    return "Unknown";
  }

  // Handle scalars (intrinsics)
  if (type.kind === "Scalar") {
    // Check for scalar mappings FIRST (before builtin checks)
    // This handles types like bytes → Bytes, utcDateTime → UTCDateTime, etc.
    if (program.checker.isStdType(type)) {
      // Check for encoding-specific mapping
      if (targetType && (targetType.kind === "Scalar" || targetType.kind === "ModelProperty")) {
        const encodeData = getEncode(program, targetType as Scalar | ModelProperty);
        const encoding = encodeData?.encoding;
        const mapping = getScalarMapping(program, type, encoding);
        if (mapping) {
          return mapping.graphqlName;
        }
      }

      // Check for default mapping (without encoding)
      const mapping = getScalarMapping(program, type);
      if (mapping) {
        return mapping.graphqlName;
      }
    }

    // Then check for direct GraphQL builtins
    if (program.checker.isStdType(type, "string")) return "String";
    if (program.checker.isStdType(type, "int32")) return "Int";
    if (program.checker.isStdType(type, "float32")) return "Float";
    if (program.checker.isStdType(type, "float64")) return "Float";
    if (program.checker.isStdType(type, "boolean")) return "Boolean";

    // Custom scalar - use the name
    return type.name;
  }

  // Handle models
  if (type.kind === "Model") {
    // In input context, if both output and input variants exist, use Input variant
    const hasOutputVariant = modelVariants.outputModels.has(type.name);
    const hasInputVariant = modelVariants.inputModels.has(type.name);

    if (mode === "input" && hasOutputVariant && hasInputVariant) {
      return `${type.name}Input`;
    }
    return type.name;
  }

  // Handle enums
  if (type.kind === "Enum") {
    return type.name;
  }

  // Handle unions (non-nullable unions)
  if (type.kind === "Union") {
    return getUnionName(type as Union, program);
  }

  throw new Error(
    `Unexpected type kind "${type.kind}" in resolveBaseTypeName. ` +
    `This is a bug in the GraphQL emitter.`
  );
}
