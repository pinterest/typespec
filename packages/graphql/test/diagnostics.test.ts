import { strictEqual } from "node:assert";
import { describe, it } from "vitest";
import { emitSingleSchemaWithDiagnostics } from "./test-host.js";

describe("diagnostics", () => {
  it("does not error on empty schema (placeholder Query is generated)", async () => {
    const code = `
      @schema
      namespace EmptySchema {
      }
    `;

    const result = await emitSingleSchemaWithDiagnostics(code, {});
    // An empty namespace still produces SDL because a placeholder Query type is always emitted.
    // Verify no errors are produced.
    const errors = result.diagnostics.filter((d) => d.severity === "error");
    strictEqual(errors.length, 0, "Should have no errors for empty schema");
  });

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

    // No errors should be produced for valid types
    const errors = result.diagnostics.filter((d) => d.severity === "error");
    strictEqual(errors.length, 0, "Should have no errors for valid schema");

    // Output should contain the expected types
    strictEqual(result.graphQLOutput?.includes("type Book {"), true, "Should contain Book type");
    strictEqual(result.graphQLOutput?.includes("type Query {"), true, "Should contain Query type");
  });
});
