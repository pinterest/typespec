import { strictEqual } from "node:assert";
import { describe, it } from "vitest";
import { emitSingleSchema } from "./test-host.js";

/**
 * Tests for TypeSpec standard library scalar mapping to GraphQL custom scalars
 * Based on design doc: https://github.com/microsoft/typespec/issues/4933
 */
describe("Scalar Mapping", () => {
  describe("int64 → BigInt", () => {
    it("maps int64 to BigInt scalar", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model Data {
            bigNumber: int64;
          }

          @query
          op getData(): Data;
        }
      `;

      const result = await emitSingleSchema(code, {});

      strictEqual(result.includes("scalar BigInt"), true);
      strictEqual(result.includes("bigNumber: BigInt!"), true);
    });
  });

  describe("numeric → Numeric", () => {
    it("maps numeric to Numeric scalar", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model Data {
            value: numeric;
          }

          @query
          op getData(): Data;
        }
      `;

      const result = await emitSingleSchema(code, {});

      strictEqual(result.includes("scalar Numeric"), true);
      strictEqual(result.includes("value: Numeric!"), true);
    });
  });

  describe("decimal → BigDecimal", () => {
    it("maps decimal to BigDecimal scalar", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model Data {
            amount: decimal;
          }

          @query
          op getData(): Data;
        }
      `;

      const result = await emitSingleSchema(code, {});

      strictEqual(result.includes("scalar BigDecimal"), true);
      strictEqual(result.includes("amount: BigDecimal!"), true);
    });

    it("maps decimal128 to BigDecimal scalar", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model Data {
            amount: decimal128;
          }

          @query
          op getData(): Data;
        }
      `;

      const result = await emitSingleSchema(code, {});

      strictEqual(result.includes("scalar BigDecimal"), true);
      strictEqual(result.includes("amount: BigDecimal!"), true);
    });
  });

  describe("bytes with encodings", () => {
    it("maps bytes with base64 encoding to Bytes scalar with @specifiedBy", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model Data {
            @encode("base64")
            data: bytes;
          }

          @query
          op getData(): Data;
        }
      `;

      const result = await emitSingleSchema(code, {});

      strictEqual(result.includes("scalar Bytes"), true);
      strictEqual(result.includes('@specifiedBy(url: "https://datatracker.ietf.org/doc/html/rfc4648")'), true);
      strictEqual(result.includes("data: Bytes!"), true);
    });

    it("maps bytes with base64url encoding to BytesUrl scalar with @specifiedBy", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model Data {
            @encode("base64url")
            data: bytes;
          }

          @query
          op getData(): Data;
        }
      `;

      const result = await emitSingleSchema(code, {});

      strictEqual(result.includes("scalar BytesUrl"), true);
      strictEqual(result.includes('@specifiedBy(url: "https://datatracker.ietf.org/doc/html/rfc4648")'), true);
      strictEqual(result.includes("data: BytesUrl!"), true);
    });
  });

  describe("utcDateTime with encodings", () => {
    it("maps utcDateTime with rfc3339 encoding to UTCDateTime scalar with @specifiedBy", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model Event {
            @encode("rfc3339")
            timestamp: utcDateTime;
          }

          @query
          op getEvent(): Event;
        }
      `;

      const result = await emitSingleSchema(code, {});

      strictEqual(result.includes("scalar UTCDateTime"), true);
      strictEqual(result.includes('@specifiedBy(url: "https://datatracker.ietf.org/doc/html/rfc3339")'), true);
      strictEqual(result.includes("timestamp: UTCDateTime!"), true);
    });

    it("maps utcDateTime with rfc7231 encoding to UTCDateTimeHuman scalar with @specifiedBy", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model Event {
            @encode("rfc7231")
            timestamp: utcDateTime;
          }

          @query
          op getEvent(): Event;
        }
      `;

      const result = await emitSingleSchema(code, {});

      strictEqual(result.includes("scalar UTCDateTimeHuman"), true);
      strictEqual(result.includes('@specifiedBy(url: "https://datatracker.ietf.org/doc/html/rfc7231")'), true);
      strictEqual(result.includes("timestamp: UTCDateTimeHuman!"), true);
    });

    it("maps utcDateTime with unixTimestamp encoding to UTCDateTimeUnix scalar (Int)", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model Event {
            @encode("unixTimestamp", int32)
            timestamp: utcDateTime;
          }

          @query
          op getEvent(): Event;
        }
      `;

      const result = await emitSingleSchema(code, {});

      strictEqual(result.includes("scalar UTCDateTimeUnix"), true);
      strictEqual(result.includes("timestamp: UTCDateTimeUnix!"), true);
      // No @specifiedBy for unixTimestamp variant
      strictEqual(result.includes('@specifiedBy(url: "https://datatracker.ietf.org/doc/html/rfc3339")'), false);
    });
  });

  describe("offsetDateTime with encodings", () => {
    it("maps offsetDateTime with rfc3339 encoding to OffsetDateTime scalar with @specifiedBy", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model Event {
            @encode("rfc3339")
            timestamp: offsetDateTime;
          }

          @query
          op getEvent(): Event;
        }
      `;

      const result = await emitSingleSchema(code, {});

      strictEqual(result.includes("scalar OffsetDateTime"), true);
      strictEqual(result.includes('@specifiedBy(url: "https://datatracker.ietf.org/doc/html/rfc3339")'), true);
      strictEqual(result.includes("timestamp: OffsetDateTime!"), true);
    });

    it("maps offsetDateTime with rfc7231 encoding to OffsetDateTimeHuman scalar with @specifiedBy", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model Event {
            @encode("rfc7231")
            timestamp: offsetDateTime;
          }

          @query
          op getEvent(): Event;
        }
      `;

      const result = await emitSingleSchema(code, {});

      strictEqual(result.includes("scalar OffsetDateTimeHuman"), true);
      strictEqual(result.includes('@specifiedBy(url: "https://datatracker.ietf.org/doc/html/rfc7231")'), true);
      strictEqual(result.includes("timestamp: OffsetDateTimeHuman!"), true);
    });

    it("maps offsetDateTime with unixTimestamp encoding to OffsetDateTimeUnix scalar", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model Event {
            @encode("unixTimestamp", int32)
            timestamp: utcDateTime;
          }

          @query
          op getEvent(): Event;
        }
      `;

      const result = await emitSingleSchema(code, {});

      strictEqual(result.includes("scalar UTCDateTimeUnix"), true);
      strictEqual(result.includes("timestamp: UTCDateTimeUnix!"), true);
    });
  });

  describe("unixTimestamp32 → OffsetDateTimeUnix", () => {
    it("maps unixTimestamp32 to OffsetDateTimeUnix scalar", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model Event {
            timestamp: unixTimestamp32;
          }

          @query
          op getEvent(): Event;
        }
      `;

      const result = await emitSingleSchema(code, {});

      strictEqual(result.includes("scalar OffsetDateTimeUnix"), true);
      strictEqual(result.includes("timestamp: OffsetDateTimeUnix!"), true);
    });
  });

  describe("duration with encodings", () => {
    it("maps duration with ISO8601 encoding to Duration scalar with @specifiedBy", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model Task {
            @encode("ISO8601")
            duration: duration;
          }

          @query
          op getTask(): Task;
        }
      `;

      const result = await emitSingleSchema(code, {});

      strictEqual(result.includes("scalar Duration"), true);
      strictEqual(result.includes('@specifiedBy(url: "https://www.iso.org/standard/70907.html")'), true);
      strictEqual(result.includes("duration: Duration!"), true);
    });

    it("maps duration with seconds encoding to DurationSeconds scalar", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model Task {
            @encode("seconds", int32)
            duration: duration;
          }

          @query
          op getTask(): Task;
        }
      `;

      const result = await emitSingleSchema(code, {});

      strictEqual(result.includes("scalar DurationSeconds"), true);
      strictEqual(result.includes("duration: DurationSeconds!"), true);
    });
  });

  describe("plainDate → PlainDate", () => {
    it("maps plainDate to PlainDate scalar", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model Event {
            date: plainDate;
          }

          @query
          op getEvent(): Event;
        }
      `;

      const result = await emitSingleSchema(code, {});

      strictEqual(result.includes("scalar PlainDate"), true);
      strictEqual(result.includes("date: PlainDate!"), true);
    });
  });

  describe("plainTime → PlainTime", () => {
    it("maps plainTime to PlainTime scalar", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model Event {
            time: plainTime;
          }

          @query
          op getEvent(): Event;
        }
      `;

      const result = await emitSingleSchema(code, {});

      strictEqual(result.includes("scalar PlainTime"), true);
      strictEqual(result.includes("time: PlainTime!"), true);
    });
  });

  describe("url → URL", () => {
    it("maps url to URL scalar with @specifiedBy", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model Link {
            href: url;
          }

          @query
          op getLink(): Link;
        }
      `;

      const result = await emitSingleSchema(code, {});

      strictEqual(result.includes("scalar URL"), true);
      strictEqual(result.includes('@specifiedBy(url: "https://url.spec.whatwg.org/")'), true);
      strictEqual(result.includes("href: URL!"), true);
    });
  });

  describe("unknown → Unknown", () => {
    it("maps unknown to Unknown scalar", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model Data {
            value: unknown;
          }

          @query
          op getData(): Data;
        }
      `;

      const result = await emitSingleSchema(code, {});

      strictEqual(result.includes("scalar Unknown"), true);
      strictEqual(result.includes("value: Unknown!"), true);
    });
  });

  describe("Custom user-defined scalars", () => {
    it("passes through custom scalars unchanged (sanitized)", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          /** ISO 8601 date-time string */
          scalar DateTime;

          /** Valid JSON value */
          scalar JSON;

          model Event {
            timestamp: DateTime;
            metadata: JSON;
          }

          @query
          op getEvent(): Event;
        }
      `;

      const result = await emitSingleSchema(code, {});

      // Custom scalars should keep their names (sanitized)
      strictEqual(result.includes('"ISO 8601 date-time string"'), true);
      strictEqual(result.includes("scalar DateTime"), true);
      strictEqual(result.includes('"Valid JSON value"'), true);
      strictEqual(result.includes("scalar JSON"), true);

      // Should NOT have @specifiedBy since they're custom
      const dateTimeMatch = result.match(/scalar DateTime[^\n]*/);
      if (dateTimeMatch) {
        strictEqual(dateTimeMatch[0].includes("@specifiedBy"), false);
      }
    });
  });

  describe("Input/output splitting with mapped scalars", () => {
    it("uses mapped scalar names in both input and output types", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model Event {
            id: int64;
            @encode("rfc3339")
            timestamp: utcDateTime;
          }

          @mutation
          op createEvent(event: Event): Event;
        }
      `;

      const result = await emitSingleSchema(code, {});

      // Scalars declared
      strictEqual(result.includes("scalar BigInt"), true);
      strictEqual(result.includes("scalar UTCDateTime"), true);

      // Output type uses mapped names
      strictEqual(result.includes("type Event {"), true);
      const eventTypeMatch = result.match(/type Event \{[^}]+\}/s);
      if (eventTypeMatch) {
        strictEqual(eventTypeMatch[0].includes("id: BigInt!"), true);
        strictEqual(eventTypeMatch[0].includes("timestamp: UTCDateTime!"), true);
      }

      // Input type uses mapped names
      strictEqual(result.includes("input EventInput {"), true);
      const eventInputMatch = result.match(/input EventInput \{[^}]+\}/s);
      if (eventInputMatch) {
        strictEqual(eventInputMatch[0].includes("id: BigInt!"), true);
        strictEqual(eventInputMatch[0].includes("timestamp: UTCDateTime!"), true);
      }
    });
  });

  describe("Multiple scalars with same mapping", () => {
    it("declares scalar only once when multiple fields use same mapped scalar", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model Data {
            value1: int64;
            value2: int64;
            value3: int64;
          }

          @query
          op getData(): Data;
        }
      `;

      const result = await emitSingleSchema(code, {});

      // Should declare BigInt scalar only once
      const scalarMatches = result.match(/scalar BigInt/g);
      strictEqual(scalarMatches !== null, true);
      if (scalarMatches) {
        strictEqual(scalarMatches.length, 1);
      }

      // All fields should use the mapped name
      strictEqual(result.includes("value1: BigInt!"), true);
      strictEqual(result.includes("value2: BigInt!"), true);
      strictEqual(result.includes("value3: BigInt!"), true);
    });
  });
});
