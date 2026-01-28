import { describe, expect, it } from "vitest";
import { validateSchema } from "graphql";
import { emitSingleSchema, emitSingleSchemaWithDiagnostics } from "./test-host.js";

describe("Intrinsic Type Mapping", () => {
  describe("String type", () => {
    it("maps string to GraphQL String", async () => {
      const output = await emitSingleSchema(`
        @schema
        namespace Test {
          model Book {
            title: string;
          }
        }
      `);

      expect(output).toContain("title: String");
    });
  });

  describe("Integer types", () => {
    it("maps int8 to GraphQL Int", async () => {
      const output = await emitSingleSchema(`
        @schema
        namespace Test {
          model Stats {
            level: int8;
          }
        }
      `);

      expect(output).toContain("level: Int");
    });

    it("maps int16 to GraphQL Int", async () => {
      const output = await emitSingleSchema(`
        @schema
        namespace Test {
          model Stats {
            port: int16;
          }
        }
      `);

      expect(output).toContain("port: Int");
    });

    it("maps int32 to GraphQL Int", async () => {
      const output = await emitSingleSchema(`
        @schema
        namespace Test {
          model Stats {
            count: int32;
          }
        }
      `);

      expect(output).toContain("count: Int");
    });

    it("maps int64 to GraphQL Int", async () => {
      const output = await emitSingleSchema(`
        @schema
        namespace Test {
          model Stats {
            bigNumber: int64;
          }
        }
      `);

      expect(output).toContain("bigNumber: Int");
    });

    it("maps uint8 to GraphQL Int", async () => {
      const output = await emitSingleSchema(`
        @schema
        namespace Test {
          model Stats {
            byte: uint8;
          }
        }
      `);

      expect(output).toContain("byte: Int");
    });

    it("maps uint32 to GraphQL Int", async () => {
      const output = await emitSingleSchema(`
        @schema
        namespace Test {
          model Stats {
            unsignedCount: uint32;
          }
        }
      `);

      expect(output).toContain("unsignedCount: Int");
    });

    it("maps safeint to GraphQL Int", async () => {
      const output = await emitSingleSchema(`
        @schema
        namespace Test {
          model Stats {
            safeNumber: safeint;
          }
        }
      `);

      expect(output).toContain("safeNumber: Int");
    });

    it("maps integer to GraphQL Int", async () => {
      const output = await emitSingleSchema(`
        @schema
        namespace Test {
          model Stats {
            anyInt: integer;
          }
        }
      `);

      expect(output).toContain("anyInt: Int");
    });
  });

  describe("Float types", () => {
    it("maps float32 to GraphQL Float", async () => {
      const output = await emitSingleSchema(`
        @schema
        namespace Test {
          model Measurement {
            temperature: float32;
          }
        }
      `);

      expect(output).toContain("temperature: Float");
    });

    it("maps float64 to GraphQL Float", async () => {
      const output = await emitSingleSchema(`
        @schema
        namespace Test {
          model Measurement {
            precision: float64;
          }
        }
      `);

      expect(output).toContain("precision: Float");
    });

    it("maps float to GraphQL Float", async () => {
      const output = await emitSingleSchema(`
        @schema
        namespace Test {
          model Measurement {
            value: float;
          }
        }
      `);

      expect(output).toContain("value: Float");
    });

    it("maps decimal to GraphQL Float", async () => {
      const output = await emitSingleSchema(`
        @schema
        namespace Test {
          model Financial {
            price: decimal;
          }
        }
      `);

      expect(output).toContain("price: Float");
    });

    it("maps decimal128 to GraphQL Float", async () => {
      const output = await emitSingleSchema(`
        @schema
        namespace Test {
          model Financial {
            precisePrice: decimal128;
          }
        }
      `);

      expect(output).toContain("precisePrice: Float");
    });

    it("maps numeric to GraphQL Float", async () => {
      const output = await emitSingleSchema(`
        @schema
        namespace Test {
          model Stats {
            number: numeric;
          }
        }
      `);

      expect(output).toContain("number: Float");
    });
  });

  describe("Boolean type", () => {
    it("maps boolean to GraphQL Boolean", async () => {
      const output = await emitSingleSchema(`
        @schema
        namespace Test {
          model Feature {
            enabled: boolean;
          }
        }
      `);

      expect(output).toContain("enabled: Boolean");
    });
  });

  describe("Mixed intrinsic types", () => {
    it("handles model with multiple intrinsic types", async () => {
      const output = await emitSingleSchema(`
        @schema
        namespace Test {
          model Product {
            id: int32;
            name: string;
            price: float64;
            inStock: boolean;
            quantity: int64;
          }
        }
      `);

      expect(output).toContain("id: Int");
      expect(output).toContain("name: String");
      expect(output).toContain("price: Float");
      expect(output).toContain("inStock: Boolean");
      expect(output).toContain("quantity: Int");
    });

    it("handles input and output types with intrinsics", async () => {
      const output = await emitSingleSchema(`
        @schema
        namespace Test {
          model Book {
            id: int32;
            title: string;
            price: float32;
          }

          model CreateBookInput {
            title: string;
            price: float32;
          }
        }
      `);

      // Output type
      expect(output).toContain("type Book");
      expect(output).toContain("id: Int");
      expect(output).toContain("title: String");
      expect(output).toContain("price: Float");

      // Input type (if used as input)
      expect(output).toContain("type CreateBookInput");
    });
  });

  describe("Schema validation", () => {
    it("generates valid GraphQL schema for intrinsic types", async () => {
      const result = await emitSingleSchemaWithDiagnostics(`
        @schema
        namespace Test {
          model CompleteExample {
            stringField: string;
            intField: int32;
            floatField: float64;
            boolField: boolean;
            bigIntField: int64;
            smallIntField: int8;
            decimalField: decimal;
          }
        }
      `);

      // Check no diagnostics
      expect(result.diagnostics).toHaveLength(0);

      // Validate schema with GraphQL
      const schema = result.graphQLSchema;
      expect(schema).toBeDefined();

      if (schema) {
        const errors = validateSchema(schema);
        expect(errors).toHaveLength(0);
      }
    });


    it("handles model with only intrinsic scalars", async () => {
      const result = await emitSingleSchemaWithDiagnostics(`
        @schema
        namespace Test {
          model AllIntrinsics {
            stringField: string;
            intField: int32;
            floatField: float64;
            boolField: boolean;
          }
        }
      `);

      expect(result.diagnostics).toHaveLength(0);
      const schema = result.graphQLSchema;
      expect(schema).toBeDefined();

      if (schema) {
        const errors = validateSchema(schema);
        expect(errors).toHaveLength(0);

        // Verify all fields mapped to GraphQL scalars
        const output = result.graphQLOutput!;
        expect(output).toContain("stringField: String");
        expect(output).toContain("intField: Int");
        expect(output).toContain("floatField: Float");
        expect(output).toContain("boolField: Boolean");
      }
    });
  });

  describe("Snapshot tests", () => {
    it("snapshot: basic intrinsic types schema", async () => {
      const output = await emitSingleSchema(`
        @schema
        namespace Library {
          model Book {
            id: int32;
            title: string;
            pages: int32;
            rating: float64;
            available: boolean;
          }

          model Author {
            id: int32;
            name: string;
            booksWritten: int32;
          }
        }
      `);

      expect(output).toMatchSnapshot();
    });
  });
});
