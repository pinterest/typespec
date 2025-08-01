import type { EncodeData, Scalar } from "@typespec/compiler";
import { useTsp } from "@typespec/emitter-framework";
import { reportDiagnostic } from "../lib.js";

import {
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLInt,
  GraphQLScalarType,
  GraphQLString,
  Kind,
} from "graphql";

/**
 * Returns the GraphQL scalar type for the given TSP scalar type.
 * Handles encoding-specific mappings as specified in the design document.
 *
 * @param type - The TSP scalar type to look up.
 * @param encoding - Optional encoding data from @encode decorator.
 * @returns The corresponding GraphQL scalar type.
 */
export function getGraphQLScalarType(type: Scalar, encoding?: EncodeData): GraphQLScalarType {
  const key = getScalarMappingKey(type);

  // Handle encoding-specific mappings for certain scalars
  if (encoding?.encoding) {
    const encodingKey = `${key}_${encoding.encoding}`;
    if (encodingKey in encodingSpecificScalars) {
      return encodingSpecificScalars[encodingKey as keyof typeof encodingSpecificScalars];
    }
    // If encoding is specified but not found, report diagnostic but continue
    const { program } = useTsp();
    reportDiagnostic(program, {
      code: "unknown-scalar-encoding",
      format: {
        encoding: encoding.encoding,
        scalarType: key,
      },
      target: encoding.type ?? type,
    });
  }

  // Fall back to base scalar mapping
  return scalarGraphQLMap[key];
}

/**
 * Validates if a value is a valid date
 */
function isValidDate(date: Date): boolean {
  return !isNaN(date.getTime());
}

/**
 * Custom scalar: BigInt for integer and int64 types
 * Maps to GraphQL String primitive
 */
export const BigIntScalar = new GraphQLScalarType({
  name: "BigInt",
  description: "A large integer value that may exceed the range of the GraphQL Int type",
  serialize(value) {
    if (typeof value === "bigint") {
      return value.toString();
    }
    if (typeof value === "number" || typeof value === "string") {
      return String(value);
    }
    throw new Error(`${this.name} can only serialize number, bigint, or numeric string`);
  },
  parseValue(value) {
    if (typeof value === "string" || typeof value === "number") {
      try {
        return BigInt(value);
      } catch (e) {
        throw new Error("Invalid BigInt value");
      }
    }
    throw new Error(`${this.name} can only parse string or number values`);
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING || ast.kind === Kind.INT) {
      try {
        return BigInt(ast.value);
      } catch (e) {
        throw new Error("Invalid BigInt value");
      }
    }
    return null;
  },
});

/**
 * Custom scalar: Numeric for numeric type
 * Maps to GraphQL String primitive
 */
export const NumericScalar = new GraphQLScalarType({
  name: "Numeric",
  description: "A numeric value with arbitrary precision",
  serialize(value) {
    return String(value);
  },
  parseValue(value) {
    if (typeof value === "string" || typeof value === "number") {
      return String(value);
    }
    throw new Error(`${this.name} can only parse string or number values`);
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING || ast.kind === Kind.INT || ast.kind === Kind.FLOAT) {
      return ast.value;
    }
    return null;
  },
});

/**
 * Custom scalar: BigDecimal for decimal and decimal128 types
 * Maps to GraphQL String primitive
 */
export const BigDecimalScalar = new GraphQLScalarType({
  name: "BigDecimal",
  description: "A decimal value with arbitrary precision",
  serialize(value) {
    return String(value);
  },
  parseValue(value) {
    if (typeof value === "string" || typeof value === "number") {
      return String(value);
    }
    throw new Error(`${this.name} can only parse string or number values`);
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING || ast.kind === Kind.INT || ast.kind === Kind.FLOAT) {
      return ast.value;
    }
    return null;
  },
});

/**
 * Custom scalar: Bytes for base64 encoding
 * Maps to GraphQL String primitive
 */
export const BytesScalar = new GraphQLScalarType({
  name: "Bytes",
  description: "Base64-encoded binary data",
  serialize(value) {
    if (value instanceof Uint8Array) {
      return Buffer.from(value).toString("base64");
    }
    if (typeof value === "string") {
      return value;
    }
    throw new Error(`${this.name} can only serialize Uint8Array or base64 string`);
  },
  parseValue(value) {
    if (typeof value === "string") {
      try {
        return new Uint8Array(Buffer.from(value, "base64"));
      } catch (e) {
        throw new Error("Invalid base64 string for Bytes");
      }
    }
    throw new Error(`${this.name} can only parse string values`);
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) {
      try {
        return new Uint8Array(Buffer.from(ast.value, "base64"));
      } catch (e) {
        throw new Error("Invalid base64 string for Bytes");
      }
    }
    return null;
  },
});

/**
 * Custom scalar: BytesUrl for base64url encoding
 * Maps to GraphQL String primitive
 */
export const BytesUrlScalar = new GraphQLScalarType({
  name: "BytesUrl",
  description: "Base64url-encoded binary data",
  serialize(value) {
    if (value instanceof Uint8Array) {
      return Buffer.from(value).toString("base64url");
    }
    if (typeof value === "string") {
      return value;
    }
    throw new Error(`${this.name} can only serialize Uint8Array or base64url string`);
  },
  parseValue(value) {
    if (typeof value === "string") {
      try {
        return new Uint8Array(Buffer.from(value, "base64url"));
      } catch (e) {
        throw new Error("Invalid base64url string for BytesUrl");
      }
    }
    throw new Error(`${this.name} can only parse string values`);
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) {
      try {
        return new Uint8Array(Buffer.from(ast.value, "base64url"));
      } catch (e) {
        throw new Error("Invalid base64url string for BytesUrl");
      }
    }
    return null;
  },
});

/**
 * Custom scalar: UTCDateTime for RFC3339 format
 * Maps to GraphQL String primitive
 */
export const UTCDateTimeScalar = new GraphQLScalarType({
  name: "UTCDateTime",
  description: "A UTC date-time string in RFC3339 format",
  serialize(value) {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === "string") {
      return value;
    }
    throw new Error(`${this.name} can only serialize Date or ISO string`);
  },
  parseValue(value) {
    if (typeof value === "string") {
      const date = new Date(value);
      if (!isValidDate(date)) {
        throw new Error(`Invalid date string for ${this.name}`);
      }
      return date;
    }
    throw new Error(`${this.name} can only parse string values`);
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) {
      const date = new Date(ast.value);
      if (!isValidDate(date)) {
        throw new Error(`Invalid date string for ${this.name}`);
      }
      return date;
    }
    return null;
  },
});

/**
 * Custom scalar: UTCDateTimeHuman for RFC7231 format
 * Maps to GraphQL String primitive
 */
export const UTCDateTimeHumanScalar = new GraphQLScalarType({
  name: "UTCDateTimeHuman",
  description: "A UTC date-time string in RFC7231 format (HTTP date)",
  serialize(value) {
    if (value instanceof Date) {
      return value.toUTCString();
    }
    if (typeof value === "string") {
      return value;
    }
    throw new Error(`${this.name} can only serialize Date or HTTP date string`);
  },
  parseValue(value) {
    if (typeof value === "string") {
      const date = new Date(value);
      if (!isValidDate(date)) {
        throw new Error(`Invalid date string for ${this.name}`);
      }
      return date;
    }
    throw new Error(`${this.name} can only parse string values`);
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) {
      const date = new Date(ast.value);
      if (!isValidDate(date)) {
        throw new Error(`Invalid date string for ${this.name}`);
      }
      return date;
    }
    return null;
  },
});

/**
 * Custom scalar: UTCDateTimeUnix for Unix timestamp
 * Maps to GraphQL Int primitive
 */
export const UTCDateTimeUnixScalar = new GraphQLScalarType({
  name: "UTCDateTimeUnix",
  description: "A UTC date-time as Unix timestamp (seconds since epoch)",
  serialize(value) {
    if (value instanceof Date) {
      return Math.floor(value.getTime() / 1000);
    }
    if (typeof value === "number") {
      return Math.floor(value);
    }
    throw new Error(`${this.name} can only serialize Date or number`);
  },
  parseValue(value) {
    if (typeof value === "number") {
      return new Date(value * 1000);
    }
    throw new Error(`${this.name} can only parse number values`);
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.INT) {
      return new Date(parseInt(ast.value, 10) * 1000);
    }
    return null;
  },
});

/**
 * Custom scalar: OffsetDateTime for RFC3339 format
 * Maps to GraphQL String primitive
 */
export const OffsetDateTimeScalar = new GraphQLScalarType({
  name: "OffsetDateTime",
  description: "An offset date-time string in RFC3339 format",
  serialize(value) {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === "string") {
      return value;
    }
    throw new Error(`${this.name} can only serialize Date or ISO string`);
  },
  parseValue(value) {
    if (typeof value === "string") {
      const date = new Date(value);
      if (!isValidDate(date)) {
        throw new Error(`Invalid date string for ${this.name}`);
      }
      return date;
    }
    throw new Error(`${this.name} can only parse string values`);
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) {
      const date = new Date(ast.value);
      if (!isValidDate(date)) {
        throw new Error(`Invalid date string for ${this.name}`);
      }
      return date;
    }
    return null;
  },
});

/**
 * Custom scalar: OffsetDateTimeHuman for RFC7231 format
 * Maps to GraphQL String primitive
 */
export const OffsetDateTimeHumanScalar = new GraphQLScalarType({
  name: "OffsetDateTimeHuman",
  description: "An offset date-time string in RFC7231 format (HTTP date)",
  serialize(value) {
    if (value instanceof Date) {
      return value.toUTCString();
    }
    if (typeof value === "string") {
      return value;
    }
    throw new Error(`${this.name} can only serialize Date or HTTP date string`);
  },
  parseValue(value) {
    if (typeof value === "string") {
      const date = new Date(value);
      if (!isValidDate(date)) {
        throw new Error(`Invalid date string for ${this.name}`);
      }
      return date;
    }
    throw new Error(`${this.name} can only parse string values`);
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) {
      const date = new Date(ast.value);
      if (!isValidDate(date)) {
        throw new Error(`Invalid date string for ${this.name}`);
      }
      return date;
    }
    return null;
  },
});

/**
 * Custom scalar: OffsetDateTimeUnix for Unix timestamp
 * Maps to GraphQL Int primitive
 */
export const OffsetDateTimeUnixScalar = new GraphQLScalarType({
  name: "OffsetDateTimeUnix",
  description: "An offset date-time as Unix timestamp (seconds since epoch)",
  serialize(value) {
    if (value instanceof Date) {
      return Math.floor(value.getTime() / 1000);
    }
    if (typeof value === "number") {
      return Math.floor(value);
    }
    throw new Error(`${this.name} can only serialize Date or number`);
  },
  parseValue(value) {
    if (typeof value === "number") {
      return new Date(value * 1000);
    }
    throw new Error(`${this.name} can only parse number values`);
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.INT) {
      return new Date(parseInt(ast.value, 10) * 1000);
    }
    return null;
  },
});

/**
 * Custom scalar: Duration for ISO8601 format
 * Maps to GraphQL String primitive
 */
export const DurationScalar = new GraphQLScalarType({
  name: "Duration",
  description: "A duration string in ISO 8601 format",
  serialize(value) {
    return String(value);
  },
  parseValue(value) {
    if (typeof value === "string") {
      return value;
    }
    throw new Error(`${this.name} can only parse string values`);
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) {
      return ast.value;
    }
    return null;
  },
});

/**
 * Custom scalar: DurationSeconds for seconds encoding
 * Handles both Int and Float values based on @encode target type
 */
export const DurationSecondsScalar = new GraphQLScalarType({
  name: "DurationSeconds",
  description: "A duration in seconds (Int or Float based on target type)",
  serialize(value) {
    if (typeof value === "number") {
      return value;
    }
    if (typeof value === "string") {
      const num = Number(value);
      if (!isNaN(num)) {
        return num;
      }
    }
    throw new Error(`${this.name} can only serialize number or numeric string values`);
  },
  parseValue(value) {
    if (typeof value === "number") {
      return value;
    }
    if (typeof value === "string") {
      const num = Number(value);
      if (!isNaN(num)) {
        return num;
      }
    }
    throw new Error(`${this.name} can only parse number or numeric string values`);
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.INT) {
      return parseInt(ast.value, 10);
    }
    if (ast.kind === Kind.FLOAT) {
      return parseFloat(ast.value);
    }
    return null;
  },
});

/**
 * Custom scalar: PlainDate
 * Maps to GraphQL String primitive
 */
export const PlainDateScalar = new GraphQLScalarType({
  name: "PlainDate",
  description: "A date string in YYYY-MM-DD format",
  serialize(value) {
    if (value instanceof Date) {
      return value.toISOString().split("T")[0];
    }
    if (typeof value === "string") {
      return value;
    }
    throw new Error(`${this.name} can only serialize Date or date string`);
  },
  parseValue(value) {
    if (typeof value === "string") {
      const date = new Date(value + "T00:00:00.000Z");
      if (!isValidDate(date)) {
        throw new Error(`Invalid date string for ${this.name}`);
      }
      return date;
    }
    throw new Error(`${this.name} can only parse string values`);
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) {
      const date = new Date(ast.value + "T00:00:00.000Z");
      if (!isValidDate(date)) {
        throw new Error(`Invalid date string for ${this.name}`);
      }
      return date;
    }
    return null;
  },
});

/**
 * Custom scalar: PlainTime
 * Maps to GraphQL String primitive
 */
export const PlainTimeScalar = new GraphQLScalarType({
  name: "PlainTime",
  description: "A time string in HH:mm:ss format",
  serialize(value) {
    return String(value);
  },
  parseValue(value) {
    if (typeof value === "string") {
      return value;
    }
    throw new Error(`${this.name} can only parse string values`);
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) {
      return ast.value;
    }
    return null;
  },
});

/**
 * Custom scalar: URL
 * Maps to GraphQL String primitive
 */
export const URLScalar = new GraphQLScalarType({
  name: "URL",
  description: "A valid URL string",
  serialize(value) {
    return String(value);
  },
  parseValue(value) {
    if (typeof value === "string") {
      try {
        new URL(value);
        return value;
      } catch (e) {
        throw new Error(`Invalid URL string`);
      }
    }
    throw new Error(`${this.name} can only parse string values`);
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) {
      try {
        new URL(ast.value);
        return ast.value;
      } catch (e) {
        throw new Error(`Invalid URL string`);
      }
    }
    return null;
  },
});

/**
 * Custom scalar: Unknown
 * Maps to GraphQL String primitive
 */
export const UnknownScalar = new GraphQLScalarType({
  name: "Unknown",
  description: "An unknown type represented as a string",
  serialize(value) {
    return String(value);
  },
  parseValue(value) {
    return String(value);
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) {
      return ast.value;
    }
    if (ast.kind === Kind.INT || ast.kind === Kind.FLOAT || ast.kind === Kind.BOOLEAN) {
      return ast.value;
    }
    return null;
  },
});

/**
 * Base scalar mappings to GraphQL types as specified in design document.
 * Built-in GraphQL scalars are used when possible.
 */
const scalarGraphQLMap = {
  // Built-in GraphQL scalars
  string: GraphQLString,
  boolean: GraphQLBoolean,
  int32: GraphQLInt,
  int16: GraphQLInt,
  int8: GraphQLInt,
  safeint: GraphQLInt,
  uint32: GraphQLInt,
  uint16: GraphQLInt,
  uint8: GraphQLInt,
  float: GraphQLFloat,
  float32: GraphQLFloat,
  float64: GraphQLFloat,

  // Custom scalars
  integer: BigIntScalar,
  int64: BigIntScalar,
  uint64: BigIntScalar, // Too large for GraphQL Int
  numeric: NumericScalar,
  decimal: BigDecimalScalar,
  decimal128: BigDecimalScalar,
  bytes: BytesScalar, // Default to base64
  utcDateTime: UTCDateTimeScalar, // Default to rfc3339
  offsetDateTime: OffsetDateTimeScalar, // Default to rfc3339
  duration: DurationScalar, // Default to ISO8601
  plainDate: PlainDateScalar,
  plainTime: PlainTimeScalar,
  url: URLScalar,
  unknown: UnknownScalar,
};

/**
 * Encoding-specific scalar mappings using TypeSpec encoding types.
 * These override the base mappings when specific encodings are used.
 *
 * Key format: `${scalarType}_${encodingValue}`
 * - bytes: Uses BytesKnownEncoding values ("base64", "base64url")
 * - utcDateTime/offsetDateTime: Uses DateTimeKnownEncoding values ("rfc3339", "rfc7231", "unixTimestamp")
 * - duration: Uses DurationKnownEncoding values ("ISO8601", "seconds")
 */
const encodingSpecificScalars = {
  // bytes encoding variants (BytesKnownEncoding)
  bytes_base64: BytesScalar,
  bytes_base64url: BytesUrlScalar,

  // utcDateTime encoding variants (DateTimeKnownEncoding)
  utcDateTime_rfc3339: UTCDateTimeScalar,
  utcDateTime_rfc7231: UTCDateTimeHumanScalar,
  utcDateTime_unixTimestamp: UTCDateTimeUnixScalar,

  // offsetDateTime encoding variants (DateTimeKnownEncoding)
  offsetDateTime_rfc3339: OffsetDateTimeScalar,
  offsetDateTime_rfc7231: OffsetDateTimeHumanScalar,
  offsetDateTime_unixTimestamp: OffsetDateTimeUnixScalar,

  // duration encoding variants (DurationKnownEncoding)
  duration_ISO8601: DurationScalar,
  duration_seconds: DurationSecondsScalar,
} as const satisfies Record<string, GraphQLScalarType>;

/**
 * Tests for determining the scalar mapping key.
 *
 * ⚠️  ORDER MATTERS: More specific types must come before broader types
 * to avoid inheritance conflicts. For example:
 * - `url` must come before `string` (url extends string)
 * - `safeint` must come before `integer` (safeint extends integer)
 * - All specific numeric types must come before `numeric`
 *
 * If you change the order, test thoroughly to ensure no regressions.
 */
type ScalarTest = (type: Scalar) => boolean;

function getScalarTests(): { key: keyof typeof scalarGraphQLMap; test: ScalarTest }[] {
  try {
    const { $ } = useTsp();
    return [
      // Most specific types first (to avoid being caught by broader inheritance)
      { key: "url", test: (t) => $.scalar.isUrl(t) || $.scalar.extendsUrl(t) },
      { key: "safeint", test: (t) => $.scalar.isSafeint(t) || $.scalar.extendsSafeint(t) },
      { key: "decimal128", test: (t) => $.scalar.isDecimal128(t) || $.scalar.extendsDecimal128(t) },
      { key: "decimal", test: (t) => $.scalar.isDecimal(t) || $.scalar.extendsDecimal(t) },
      { key: "float64", test: (t) => $.scalar.isFloat64(t) || $.scalar.extendsFloat64(t) },
      { key: "float32", test: (t) => $.scalar.isFloat32(t) || $.scalar.extendsFloat32(t) },
      { key: "int8", test: (t) => $.scalar.isInt8(t) || $.scalar.extendsInt8(t) },
      { key: "int16", test: (t) => $.scalar.isInt16(t) || $.scalar.extendsInt16(t) },
      { key: "int32", test: (t) => $.scalar.isInt32(t) || $.scalar.extendsInt32(t) },
      { key: "int64", test: (t) => $.scalar.isInt64(t) || $.scalar.extendsInt64(t) },
      { key: "uint8", test: (t) => $.scalar.isUint8(t) || $.scalar.extendsUint8(t) },
      { key: "uint16", test: (t) => $.scalar.isUint16(t) || $.scalar.extendsUint16(t) },
      { key: "uint32", test: (t) => $.scalar.isUint32(t) || $.scalar.extendsUint32(t) },
      { key: "uint64", test: (t) => $.scalar.isUint64(t) || $.scalar.extendsUint64(t) },
      {
        key: "utcDateTime",
        test: (t) => $.scalar.isUtcDateTime(t) || $.scalar.extendsUtcDateTime(t),
      },
      {
        key: "offsetDateTime",
        test: (t) => $.scalar.isOffsetDateTime(t) || $.scalar.extendsOffsetDateTime(t),
      },
      { key: "plainDate", test: (t) => $.scalar.isPlainDate(t) || $.scalar.extendsPlainDate(t) },
      { key: "plainTime", test: (t) => $.scalar.isPlainTime(t) || $.scalar.extendsPlainTime(t) },
      { key: "bytes", test: (t) => $.scalar.isBytes(t) || $.scalar.extendsBytes(t) },
      { key: "duration", test: (t) => $.scalar.isDuration(t) || $.scalar.extendsDuration(t) },

      // Broader types (lower specificity)
      { key: "float", test: (t) => $.scalar.isFloat(t) || $.scalar.extendsFloat(t) },
      { key: "integer", test: (t) => $.scalar.isInteger(t) || $.scalar.extendsInteger(t) },
      { key: "numeric", test: (t) => $.scalar.isNumeric(t) || $.scalar.extendsNumeric(t) },
      { key: "string", test: (t) => $.scalar.isString(t) || $.scalar.extendsString(t) },
      { key: "boolean", test: (t) => $.scalar.isBoolean(t) || $.scalar.extendsBoolean(t) },

      // Name-based fallback for unknown
      { key: "unknown", test: (t) => t.name === "unknown" },
    ];
  } catch (error) {
    // If useTsp() fails (e.g., no TspContext), provide minimal fallback tests
    return [
      { key: "string", test: (t) => t.name === "string" },
      { key: "boolean", test: (t) => t.name === "boolean" },
      { key: "unknown", test: () => true }, // Catch-all fallback
    ];
  }
}

/**
 * Determines the key to use in the scalarGraphQLMap for the given scalar type.
 *
 * @param type - The scalar type to check.
 * @returns The corresponding key from the scalarGraphQLMap, or "unknown" as fallback.
 */
function getScalarMappingKey(type: Scalar): keyof typeof scalarGraphQLMap {
  try {
    for (const { key, test } of getScalarTests()) {
      if (test(type)) {
        return key;
      }
    }

    // Report warning for unknown scalar types but continue with fallback
    const { program } = useTsp();
    reportDiagnostic(program, {
      code: "unknown-scalar-type",
      format: {
        scalarType: type.name,
      },
      target: type,
    });

    return "unknown";
  } catch (error) {
    // If getScalarTests fails (e.g., no TspContext), report error and fallback
    const { program } = useTsp();
    reportDiagnostic(program, {
      code: "scalar-mapping-error",
      format: {
        scalarType: type.name,
        error: String(error),
      },
      target: type,
    });

    return "unknown";
  }
}
