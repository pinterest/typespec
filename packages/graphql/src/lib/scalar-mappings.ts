import { type Program, type Scalar } from "@typespec/compiler";
import { getEncode } from "@typespec/compiler";

/**
 * Represents a mapping from TypeSpec scalar to GraphQL custom scalar
 */
export interface ScalarMapping {
  /** The GraphQL scalar name to emit */
  graphqlName: string;
  /** The base GraphQL type (String, Int, or Float) */
  baseType: "String" | "Int" | "Float" | "Boolean" | "ID";
  /** Optional URL to specification for @specifiedBy directive */
  specificationUrl?: string;
}

/**
 * Mapping table for TypeSpec standard library scalars to GraphQL custom scalars.
 */
const SCALAR_MAPPINGS = {
  // int64 → Long (String)
  int64: {
    default: {
      graphqlName: "Long",
      baseType: "String",
      specificationUrl: "http://scalars.graphql.org/jakobmerrild/long.html",
    },
  },

  // numeric → Numeric (String)
  numeric: {
    default: {
      graphqlName: "Numeric",
      baseType: "String",
    },
  },

  // decimal, decimal128 → BigDecimal (String)
  decimal: {
    default: {
      graphqlName: "BigDecimal",
      baseType: "String",
    },
  },
  decimal128: {
    default: {
      graphqlName: "BigDecimal",
      baseType: "String",
    },
  },

  // bytes — requires @encode to determine format; without encoding, no GraphQL mapping applies
  bytes: {
    base64: {
      graphqlName: "Bytes",
      baseType: "String",
      specificationUrl: "https://datatracker.ietf.org/doc/html/rfc4648#section-4",
    },
    base64url: {
      graphqlName: "BytesUrl",
      baseType: "String",
      specificationUrl: "https://datatracker.ietf.org/doc/html/rfc4648#section-5",
    },
  },

  // utcDateTime — requires @encode to determine wire format; no default mapping without encoding
  utcDateTime: {
    rfc3339: {
      graphqlName: "UTCDateTime",
      baseType: "String",
      specificationUrl: "https://scalars.graphql.org/chillicream/date-time.html",
    },
    rfc7231: {
      graphqlName: "UTCDateTimeHuman",
      baseType: "String",
      specificationUrl: "https://datatracker.ietf.org/doc/html/rfc7231#section-7.1.1.1",
    },
    unixTimestamp: {
      graphqlName: "UTCDateTimeUnix",
      baseType: "Int",
    },
  },

  // offsetDateTime — requires @encode to determine wire format; no default mapping without encoding
  offsetDateTime: {
    rfc3339: {
      graphqlName: "OffsetDateTime",
      baseType: "String",
      specificationUrl: "https://scalars.graphql.org/chillicream/date-time.html",
    },
    rfc7231: {
      graphqlName: "OffsetDateTimeHuman",
      baseType: "String",
      specificationUrl: "https://datatracker.ietf.org/doc/html/rfc7231#section-7.1.1.1",
    },
    unixTimestamp: {
      graphqlName: "OffsetDateTimeUnix",
      baseType: "Int",
    },
  },

  // unixTimestamp32 → OffsetDateTimeUnix (Int)
  unixTimestamp32: {
    default: {
      graphqlName: "OffsetDateTimeUnix",
      baseType: "Int",
    },
  },

  // duration — requires @encode to determine wire format; no default mapping without encoding
  duration: {
    ISO8601: {
      graphqlName: "Duration",
      baseType: "String",
      specificationUrl: "https://www.iso.org/standard/70907.html",
    },
    seconds: {
      graphqlName: "DurationSeconds",
      baseType: "Int", // Could be Float based on context, defaulting to Int
    },
  },

  // plainDate → PlainDate (String)
  plainDate: {
    default: {
      graphqlName: "PlainDate",
      baseType: "String",
    },
  },

  // plainTime → PlainTime (String)
  plainTime: {
    default: {
      graphqlName: "PlainTime",
      baseType: "String",
    },
  },

  // url → URL (String)
  url: {
    default: {
      graphqlName: "URL",
      baseType: "String",
      specificationUrl: "https://url.spec.whatwg.org/",
    },
  },

  // unknown → Unknown (String)
  unknown: {
    default: {
      graphqlName: "Unknown",
      baseType: "String",
    },
  },
} as const;

/**
 * Get the GraphQL scalar mapping for a TypeSpec scalar.
 * Returns undefined if the scalar should be emitted as-is (custom scalar).
 *
 * @param program The TypeSpec program
 * @param scalar The scalar type to map
 * @param encoding Optional encoding to use instead of checking @encode on the scalar
 * @returns The scalar mapping or undefined if no mapping exists
 */
export function getScalarMapping(
  program: Program,
  scalar: Scalar,
  encoding?: string
): ScalarMapping | undefined {
  // Only map standard library scalars, not user-defined ones
  if (!program.checker.isStdType(scalar)) {
    return undefined;
  }

  const scalarName = scalar.name;
  const mappingTable = (SCALAR_MAPPINGS as Record<string, Record<string, ScalarMapping>>)[scalarName];

  if (!mappingTable) {
    return undefined;
  }

  // Use provided encoding, or check for @encode decorator on the scalar
  const actualEncoding = encoding ?? getEncode(program, scalar)?.encoding;

  if (actualEncoding && mappingTable[actualEncoding]) {
    return mappingTable[actualEncoding];
  }

  // Fall back to default mapping
  return mappingTable.default;
}
