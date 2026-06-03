import { describe, expect, it } from "vitest";
import { emitSingleSchema } from "./test-host.js";

describe("scalars", () => {
  describe("custom scalars", () => {
    it("emits user-defined scalars", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          /** An ISO-8601 date-time string */
          scalar DateTime;

          /** Arbitrary JSON blob */
          scalar JSON;

          model Event {
            id: string;
            timestamp: DateTime;
            metadata: JSON;
          }

          @query
          op getEvent(id: string): Event;
        }
      `;

      const result = await emitSingleSchema(code, {});

      expect(result).toMatchInlineSnapshot(`
        """"An ISO-8601 date-time string"""
        scalar DateTime

        """Arbitrary JSON blob"""
        scalar JSON

        type Event {
          id: String!
          timestamp: DateTime!
          metadata: JSON!
        }

        type Query {
          getEvent(id: String!): Event!
        }

        "
      `);
    });
  });

  describe("built-in scalar mappings", () => {
    it("maps int64 to Long scalar", async () => {
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

      expect(result).toMatchInlineSnapshot(`
        "scalar Long @specifiedBy(url: "http://scalars.graphql.org/jakobmerrild/long.html")

        type Data {
          bigNumber: Long!
        }

        type Query {
          getData: Data!
        }

        "
      `);
    });

    it("maps numeric to Numeric scalar", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model Data {
            preciseValue: numeric;
          }

          @query
          op getData(): Data;
        }
      `;

      const result = await emitSingleSchema(code, {});

      expect(result).toMatchInlineSnapshot(`
        "scalar Numeric

        type Data {
          preciseValue: Numeric!
        }

        type Query {
          getData: Data!
        }

        "
      `);
    });

    it("maps decimal and decimal128 to BigDecimal scalar", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model Data {
            amount: decimal;
            amount128: decimal128;
          }

          @query
          op getData(): Data;
        }
      `;

      const result = await emitSingleSchema(code, {});

      expect(result).toMatchInlineSnapshot(`
        "scalar BigDecimal @specifiedBy(url: "https://scalars.graphql.org/chillicream/decimal.html")

        type Data {
          amount: BigDecimal!
          amount128: BigDecimal!
        }

        type Query {
          getData: Data!
        }

        "
      `);
    });

    it("maps url to URL scalar with @specifiedBy directive", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model Website {
            homepage: url;
          }

          @query
          op getWebsite(): Website;
        }
      `;

      const result = await emitSingleSchema(code, {});

      expect(result).toMatchInlineSnapshot(`
        "scalar URL @specifiedBy(url: "https://url.spec.whatwg.org/")

        type Website {
          homepage: URL!
        }

        type Query {
          getWebsite: Website!
        }

        "
      `);
    });

    it("maps plainDate to PlainDate scalar", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model Person {
            birthday: plainDate;
          }

          @query
          op getPerson(): Person;
        }
      `;

      const result = await emitSingleSchema(code, {});

      expect(result).toMatchInlineSnapshot(`
        "scalar PlainDate @specifiedBy(url: "https://scalars.graphql.org/andimarek/local-date.html")

        type Person {
          birthday: PlainDate!
        }

        type Query {
          getPerson: Person!
        }

        "
      `);
    });

    it("maps plainTime to PlainTime scalar", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model Alarm {
            time: plainTime;
          }

          @query
          op getAlarm(): Alarm;
        }
      `;

      const result = await emitSingleSchema(code, {});

      expect(result).toMatchInlineSnapshot(`
        "scalar PlainTime @specifiedBy(url: "https://scalars.graphql.org/apollographql/localtime-v0.1.html")

        type Alarm {
          time: PlainTime!
        }

        type Query {
          getAlarm: Alarm!
        }

        "
      `);
    });

    it("deduplicates scalar declarations when same scalar used multiple times", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model Financial {
            price: decimal;
            cost: decimal;
            tax: decimal128;
          }

          @query
          op getFinancial(): Financial;
        }
      `;

      const result = await emitSingleSchema(code, {});

      expect(result).toMatchInlineSnapshot(`
        "scalar BigDecimal @specifiedBy(url: "https://scalars.graphql.org/chillicream/decimal.html")

        type Financial {
          price: BigDecimal!
          cost: BigDecimal!
          tax: BigDecimal!
        }

        type Query {
          getFinancial: Financial!
        }

        "
      `);
    });
  });

  describe("primitive scalar mappings", () => {
    it("maps TypeSpec primitives to GraphQL scalars", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model Primitives {
            str: string;
            int: int32;
            bigInt: int64;
            float: float32;
            double: float64;
            bool: boolean;
          }

          @query
          op getPrimitives(): Primitives;
        }
      `;

      const result = await emitSingleSchema(code, {});

      expect(result).toMatchInlineSnapshot(`
        "scalar Long @specifiedBy(url: "http://scalars.graphql.org/jakobmerrild/long.html")

        type Primitives {
          str: String!
          int: Int!
          bigInt: Long!
          float: Float!
          double: Float!
          bool: Boolean!
        }

        type Query {
          getPrimitives: Primitives!
        }

        "
      `);
    });
  });
});
