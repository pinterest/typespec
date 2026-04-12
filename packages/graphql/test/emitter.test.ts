import { strictEqual } from "node:assert";
import { describe, it } from "vitest";
import { emitSingleSchemaWithDiagnostics } from "./test-host.js";

describe("emitter", () => {
  it("runs the data pipeline without errors", async () => {
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
    strictEqual(errors.length, 0, "Should have no errors");

    // No SDL output yet — component-based rendering is added in follow-up PRs.
    strictEqual(result.graphQLOutput, undefined, "Should not produce output yet");
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
    strictEqual(emptySchemaDiagnostics.length, 1, "Should emit empty-schema warning");
    strictEqual(emptySchemaDiagnostics[0].severity, "warning");
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
    strictEqual(voidDiagnostics.length, 1, "Should emit void-operation-return warning");
    strictEqual(voidDiagnostics[0].severity, "warning");
  });
});
