import { type Program, type Scalar } from "@typespec/compiler";
import { $, type Typekit } from "@typespec/compiler/typekit";

/**
 * Represents a mapping from a TypeSpec standard library scalar to a GraphQL custom scalar.
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
 *
 * Built-in scalars (string, boolean, int32, float64, etc.) are NOT included here —
 * they map directly to GraphQL built-in types and are resolved at emit time.
 * This table only covers scalars that need to become custom GraphQL scalar types.
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

} as const;

type MappedScalarName = keyof typeof SCALAR_MAPPINGS;

/**
 * Check if a scalar name is a key in the SCALAR_MAPPINGS table.
 */
function isMappedScalarName(name: string): name is MappedScalarName {
  return name in SCALAR_MAPPINGS;
}

/**
 * Check whether a scalar IS a standard library scalar (not just extends one).
 * A std scalar's std base is itself. A user-defined scalar's std base is
 * its ancestor (or null if it has no std ancestor).
 */
export function isStdScalar(tk: Typekit, scalar: Scalar): boolean {
  return tk.scalar.getStdBase(scalar) === scalar;
}

/**
 * Get the GraphQL custom scalar mapping for a scalar by walking its extends chain.
 *
 * For std scalars (e.g. `int64`), returns the direct mapping.
 * For user-defined scalars that extend a mapped std scalar
 * (e.g. `scalar MyInt extends int64`), returns the ancestor's mapping.
 * Returns undefined for built-in scalars (string, boolean, etc.)
 * and scalars with no mapped ancestor.
 *
 * The caller (scalar mutation) uses `isStdScalar` to decide whether to
 * rename with `mapping.graphqlName` or keep the user's name. The mapping
 * is always useful for metadata like `@specifiedBy`.
 *
 * @param program The TypeSpec program
 * @param scalar The scalar type to map
 * @param encoding Optional encoding to use instead of checking @encode on the scalar
 * @returns The scalar mapping or undefined if no mapping exists
 */
export function getScalarMapping(
  program: Program,
  scalar: Scalar,
  encoding?: string,
): ScalarMapping | undefined {
  const tk = $(program);

  // Walk the extends chain to find a mapped std scalar ancestor.
  // Encoding is checked on the original scalar, not the ancestor.
  const actualEncoding = encoding ?? tk.scalar.getEncoding(scalar)?.encoding;

  let current: Scalar | undefined = scalar;
  while (current) {
    if (isStdScalar(tk, current) && isMappedScalarName(current.name)) {
      const mappingTable = SCALAR_MAPPINGS[current.name];

      if (actualEncoding) {
        const encodingMapping = (mappingTable as Record<string, ScalarMapping>)[actualEncoding];
        if (encodingMapping) {
          return encodingMapping;
        }
      }

      // Fall back to default mapping (not all mapping tables have a default)
      return "default" in mappingTable
        ? (mappingTable as Record<string, ScalarMapping>).default
        : undefined;
    }
    current = current.baseScalar;
  }

  return undefined;
}
