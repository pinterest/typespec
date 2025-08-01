import { render } from "@alloy-js/core";
import { Output } from "@alloy-js/core/stc";
import type { Model, Program, Scalar } from "@typespec/compiler";
import { getEncode, getProperty } from "@typespec/compiler";
import { expectDiagnostics } from "@typespec/compiler/testing";
import { TspContext } from "@typespec/emitter-framework";
import { strictEqual } from "assert";
import {
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLInt,
  GraphQLScalarType,
  GraphQLString,
} from "graphql";
import { describe, it } from "vitest";
import {
  BigDecimalScalar,
  BigIntScalar,
  BytesScalar,
  BytesUrlScalar,
  DurationScalar,
  DurationSecondsScalar,
  getGraphQLScalarType,
  NumericScalar,
  OffsetDateTimeScalar,
  PlainDateScalar,
  PlainTimeScalar,
  UnknownScalar,
  URLScalar,
  UTCDateTimeHumanScalar,
  UTCDateTimeScalar,
  UTCDateTimeUnixScalar,
} from "../src/lib/scalars.js";
import { compileAndDiagnose } from "./test-host.js";

/**
 * Helper function to run code with proper TSP context using emitter framework pattern
 */
function withTspContext<T>(program: Program, fn: () => T): T {
  let result: T;

  render(
    Output().children(
      <TspContext.Provider value={{ program }}>
        {() => {
          result = fn();
          return null;
        }}
      </TspContext.Provider>,
    ),
  );

  return result!;
}

async function testScalarMapping(scalarType: string, expectedGraphQLScalar: GraphQLScalarType) {
  const [program, { Test }] = await compileAndDiagnose(`
    @test model Test {
      prop: ${scalarType};
    }
  `);

  const result = withTspContext(program, () => {
    const model = Test as Model;
    const property = getProperty(model, "prop");

    if (!property) {
      throw new Error("Property 'prop' not found on test model");
    }

    return getGraphQLScalarType(property.type as Scalar);
  });

  strictEqual(result, expectedGraphQLScalar);
}

describe("GraphQL Scalar Mapping", () => {
  describe("Built-in GraphQL Scalars", () => {
    const builtInScalars = [
      ["string", GraphQLString],
      ["boolean", GraphQLBoolean],
    ] as const;

    it.each(builtInScalars)(
      "should map TypeSpec %s to GraphQL %s",
      async (tspType, expectedGraphQLScalar) => {
        await testScalarMapping(tspType, expectedGraphQLScalar);
      },
    );
  });

  describe("Integer Types", () => {
    const integerTypes = ["int8", "int16", "int32", "uint8", "uint16", "uint32", "safeint"];

    it.each(integerTypes)("should map TypeSpec %s to GraphQL Int", async (tspType) => {
      await testScalarMapping(tspType, GraphQLInt);
    });
  });

  describe("Float Types", () => {
    const floatTypes = ["float", "float32", "float64"];

    it.each(floatTypes)("should map TypeSpec %s to GraphQL Float", async (tspType) => {
      await testScalarMapping(tspType, GraphQLFloat);
    });
  });

  describe("Custom Scalars - BigInt Types", () => {
    const bigIntTypes = ["integer", "int64", "uint64"];

    it.each(bigIntTypes)("should map TypeSpec %s to BigInt custom scalar", async (tspType) => {
      await testScalarMapping(tspType, BigIntScalar);
    });
  });

  describe("Custom Scalars - Decimal Types", () => {
    const decimalMappings = [
      ["numeric", NumericScalar],
      ["decimal", BigDecimalScalar],
      ["decimal128", BigDecimalScalar],
    ] as const;

    it.each(decimalMappings)(
      "should map TypeSpec %s to custom scalar",
      async (tspType, expectedGraphQLScalar) => {
        await testScalarMapping(tspType, expectedGraphQLScalar);
      },
    );
  });

  describe("Custom Scalars - Date/Time Types", () => {
    const dateTimeTypes = [
      ["utcDateTime", UTCDateTimeScalar],
      ["offsetDateTime", OffsetDateTimeScalar],
      ["duration", DurationScalar],
      ["plainDate", PlainDateScalar],
      ["plainTime", PlainTimeScalar],
    ] as const;

    it.each(dateTimeTypes)(
      "should map TypeSpec %s to custom scalar",
      async (tspType, expectedGraphQLScalar) => {
        await testScalarMapping(tspType, expectedGraphQLScalar);
      },
    );
  });

  describe("Custom Scalars - Other Types", () => {
    const otherTypes = [
      ["bytes", BytesScalar],
      ["url", URLScalar],
    ] as const;

    it.each(otherTypes)(
      "should map TypeSpec %s to custom scalar",
      async (tspType, expectedGraphQLScalar) => {
        await testScalarMapping(tspType, expectedGraphQLScalar);
      },
    );
  });

  describe("Encoding-Specific Mappings", () => {
    const encodingTests = [
      {
        tspScalar: "bytes",
        encodeDirective: "@encode(BytesKnownEncoding.base64)",
        expectedGraphQLScalar: BytesScalar,
      },
      {
        tspScalar: "bytes",
        encodeDirective: "@encode(BytesKnownEncoding.base64url)",
        expectedGraphQLScalar: BytesUrlScalar,
      },
      {
        tspScalar: "utcDateTime",
        encodeDirective: "@encode(DateTimeKnownEncoding.rfc3339)",
        expectedGraphQLScalar: UTCDateTimeScalar,
      },
      {
        tspScalar: "utcDateTime",
        encodeDirective: "@encode(DateTimeKnownEncoding.rfc7231)",
        expectedGraphQLScalar: UTCDateTimeHumanScalar,
      },
      {
        tspScalar: "utcDateTime",
        encodeDirective: "@encode(DateTimeKnownEncoding.unixTimestamp)",
        expectedGraphQLScalar: UTCDateTimeUnixScalar,
      },
      {
        tspScalar: "duration",
        encodeDirective: "@encode(DurationKnownEncoding.ISO8601)",
        expectedGraphQLScalar: DurationScalar,
      },
      {
        tspScalar: "duration",
        encodeDirective: "@encode(DurationKnownEncoding.seconds)",
        expectedGraphQLScalar: DurationSecondsScalar,
      },
    ];

    it.each(encodingTests)(
      "should map $tspScalar with $encodeDirective to custom scalar",
      async ({ tspScalar, encodeDirective, expectedGraphQLScalar }) => {
        const [program, { Test }] = await compileAndDiagnose(`
          @test model Test {
            ${encodeDirective}
            prop: ${tspScalar};
          }
        `);

        const result = withTspContext(program, () => {
          const scalarProperty = getProperty(Test as Model, "prop");
          if (!scalarProperty) {
            throw new Error("Property 'prop' not found on test model");
          }
          // Extract the encoding data from the compiled @encode decorator
          const encodeData = getEncode(program, scalarProperty);
          return getGraphQLScalarType(scalarProperty.type as Scalar, encodeData);
        });

        strictEqual(result, expectedGraphQLScalar);
      },
    );

    describe("Duration with seconds encoding and target type", () => {
      const durationSecondsTests = [
        {
          encodeDirective: "@encode(DurationKnownEncoding.seconds, int32)",
        },
        {
          encodeDirective: "@encode(DurationKnownEncoding.seconds, float32)",
        },
        {
          encodeDirective: "@encode(DurationKnownEncoding.seconds, float64)",
        },
      ];

      it.each(durationSecondsTests)(
        "should map $encodeDirective duration to DurationSeconds scalar",
        async ({ encodeDirective }) => {
          const [program, { Test }] = await compileAndDiagnose(`
            @test model Test {
              ${encodeDirective}
              prop: duration;
            }
            
          `);

          const result = withTspContext(program, () => {
            const scalarProperty = getProperty(Test as Model, "prop");
            if (!scalarProperty) {
              throw new Error("Property 'prop' not found on test model");
            }

            // Extract the actual encoding data from the compiled @encode decorator
            const encodeData = getEncode(program, scalarProperty);
            return getGraphQLScalarType(scalarProperty.type as Scalar, encodeData);
          });

          // All duration+seconds should return DurationSecondsScalar regardless of target type
          strictEqual(result, DurationSecondsScalar);
        },
      );
    });
  });

  describe("Scalar Inheritance", () => {
    const inheritanceTests = [
      { source: "MyUrl extends url", customScalar: "MyUrl", expectedGraphQLScalar: URLScalar },
      { source: "MyInt extends int32", customScalar: "MyInt", expectedGraphQLScalar: GraphQLInt },
      {
        source: "MyString extends string",
        customScalar: "MyString",
        expectedGraphQLScalar: GraphQLString,
      },
      {
        source: "MyBigInt extends int64",
        customScalar: "MyBigInt",
        expectedGraphQLScalar: BigIntScalar,
      },
    ];

    it.each(inheritanceTests)(
      "should map custom scalar $source correctly",
      async ({ source, customScalar, expectedGraphQLScalar }) => {
        const [program, { Test }] = await compileAndDiagnose(`
          scalar ${source};
          
          @test model Test {
            prop: ${customScalar};
          }
        `);

        const result = withTspContext(program, () => {
          const scalarProperty = getProperty(Test as Model, "prop");
          if (!scalarProperty) {
            throw new Error("Property 'prop' not found on test model");
          }
          return getGraphQLScalarType(scalarProperty.type as Scalar);
        });

        strictEqual(result, expectedGraphQLScalar);
      },
    );
  });

  describe("Diagnostic Reporting", () => {
    it("should report diagnostic for unknown encoding and fall back gracefully", async () => {
      const [program, { Test }, diagnostics] = await compileAndDiagnose(`
        @test model Test {
          @encode("custom-unsupported-encoding")
          prop: utcDateTime;
        }
      `);

      const result = withTspContext(program, () => {
        const scalarProperty = getProperty(Test as Model, "prop");
        if (!scalarProperty) {
          throw new Error("Property 'prop' not found on test model");
        }
        // Extract the encoding data from the compiled @encode decorator
        const encodeData = getEncode(program, scalarProperty);
        return getGraphQLScalarType(scalarProperty.type as Scalar, encodeData);
      });

      // Should fall back to base mapping for utcDateTime (UTCDateTime scalar)
      strictEqual(result.name, "UTCDateTime");

      // Should report unknown encoding diagnostic (filter for our specific diagnostic)
      const ourDiagnostics = diagnostics.filter(
        (d) => d.code === "@typespec/graphql/unknown-scalar-encoding",
      );
      expectDiagnostics(ourDiagnostics, {
        code: "@typespec/graphql/unknown-scalar-encoding",
        message:
          "Encoding 'custom-unsupported-encoding' is not supported for scalar type 'utcDateTime'. Falling back to default mapping.",
      });
    });

    it("should report diagnostic for unknown scalar type and fall back gracefully", async () => {
      const [program, { Test }, diagnostics] = await compileAndDiagnose(`
        scalar UnknownScalar;
        
        @test model Test {
          prop: UnknownScalar;
        }
      `);

      const result = withTspContext(program, () => {
        const scalarProperty = getProperty(Test as Model, "prop");
        if (!scalarProperty) {
          throw new Error("Property 'prop' not found on test model");
        }
        return getGraphQLScalarType(scalarProperty.type as Scalar);
      });

      // Should fall back to Unknown scalar
      strictEqual(result.name, "Unknown");

      // Should report unknown scalar type diagnostic (filter for our specific diagnostic)
      const ourDiagnostics = diagnostics.filter(
        (d) => d.code === "@typespec/graphql/unknown-scalar-type",
      );
      expectDiagnostics(ourDiagnostics, {
        code: "@typespec/graphql/unknown-scalar-type",
        message: "Unknown scalar type 'UnknownScalar'. Using 'Unknown' scalar as fallback.",
      });
    });
  });

  describe("Edge Cases", () => {
    it("should map unknown type to Unknown scalar", async () => {
      await testScalarMapping("unknown", UnknownScalar);
    });
  });
});
