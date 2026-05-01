import { describe, expect, it } from "vitest";
import { emitSingleSchemaWithDiagnostics } from "./test-host.js";

/**
 * End-to-end smoke test: compile a minimal TypeSpec schema and verify that
 * the full pipeline produces GraphQL SDL output. Broader coverage (nullability,
 * input/output splitting, unions, etc.) lives in dedicated test files.
 */
describe("End-to-end", () => {
  it("generates valid schema for basic types", async () => {
    const code = `
      @schema
      namespace TestNamespace {
        model Book {
          id: string;
          title: string;
        }

        @query
        op getBook(id: string): Book;
      }
    `;

    const result = await emitSingleSchemaWithDiagnostics(code, {});
    const errors = result.diagnostics.filter((d) => d.severity === "error");

    expect(errors).toHaveLength(0);
    expect(result.graphQLOutput).toMatchInlineSnapshot(`
      "type Book {
        id: String!
        title: String!
      }

      type Query {
        getBook(id: String!): Book!
      }

      "
    `);
  });
});
