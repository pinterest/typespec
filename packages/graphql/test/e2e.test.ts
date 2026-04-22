import { strictEqual } from "node:assert";
import { describe, it } from "vitest";
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
    strictEqual(errors.length, 0, "Should have no errors for valid schema");
    strictEqual(result.graphQLOutput?.includes("type Book {"), true, "Should contain Book type");
    strictEqual(result.graphQLOutput?.includes("type Query {"), true, "Should contain Query type");
  });
});
