import { describe, expect, it } from "vitest";
import { emitSingleSchemaWithDiagnostics } from "./test-host.js";

describe("emitter", () => {
  it("emits multiple types and operations", async () => {
    const code = `
      @schema
      namespace TestNamespace {
        model Book {
          name: string;
          page_count: int32;
          published: boolean;
          price: float64;
        }
        model Author {
          name: string;
          books: Book[];
        }
        @query op getBooks(): Book[];
        @query op getAuthors(): Author[];
      }
    `;

    const result = await emitSingleSchemaWithDiagnostics(code, {});
    const errors = result.diagnostics.filter((d) => d.severity === "error");

    expect(errors).toHaveLength(0);
    expect(result.graphQLOutput).toMatchInlineSnapshot(`
      "type Book {
        name: String!
        page_count: Int!
        published: Boolean!
        price: Float!
      }

      type Author {
        name: String!
        books: [Book!]!
      }

      type Query {
        getBooks: [Book!]!
        getAuthors: [Author!]!
      }

      "
    `);
  });

  it("warns when a schema has no query operations", async () => {
    const code = `
      @schema
      namespace TestNamespace {
        model Book {
          name: string;
        }
      }
    `;

    const result = await emitSingleSchemaWithDiagnostics(code, {});
    const emptySchemaDiagnostics = result.diagnostics.filter(
      (d) => d.code === "@typespec/graphql/empty-schema",
    );

    expect(emptySchemaDiagnostics).toHaveLength(1);
    expect(emptySchemaDiagnostics[0].severity).toBe("warning");
  });

  it("warns when an operation returns void", async () => {
    const code = `
      @schema
      namespace TestNamespace {
        model Book {
          name: string;
        }
        @query op getBooks(): Book[];
        @mutation op doNothing(): void;
      }
    `;

    const result = await emitSingleSchemaWithDiagnostics(code, {});
    const voidDiagnostics = result.diagnostics.filter(
      (d) => d.code === "@typespec/graphql/void-operation-return",
    );

    expect(voidDiagnostics).toHaveLength(1);
    expect(voidDiagnostics[0].severity).toBe("warning");
  });
});
