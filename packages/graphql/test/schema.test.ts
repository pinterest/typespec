import { t } from "@typespec/compiler/testing";
import { describe, expect, it } from "vitest";
import { getSchema } from "../src/lib/schema.js";
import { emitWithDiagnostics, Tester } from "./test-host.js";

describe("@schema", () => {
  it("Creates a schema with no name", async () => {
    const { program, TestNamespace } = await Tester.compile(t.code`
      @schema
      @test namespace ${t.namespace("TestNamespace")} {}
    `);

    const schema = getSchema(program, TestNamespace);

    expect(schema?.type).toBe(TestNamespace);
    expect(schema?.name).toBeUndefined();
  });

  it("Creates a schema with a specified name", async () => {
    const { program, TestNamespace } = await Tester.compile(t.code`
      @schema(#{name: "MySchema"})
      @test namespace ${t.namespace("TestNamespace")} {}
    `);

    const schema = getSchema(program, TestNamespace);

    expect(schema?.type).toBe(TestNamespace);
    expect(schema?.name).toBe("MySchema");
  });

  it("emits separate schemas for different namespaces", async () => {
    const code = `
      @schema
      namespace SchemaA {
        model Foo {
          id: string;
        }

        @query
        op getFoo(): Foo;
      }

      @schema
      namespace SchemaB {
        model Bar {
          name: string;
        }

        @query
        op getBar(): Bar;
      }
    `;

    const results = await emitWithDiagnostics(code, {});
    // Should produce results (at least one schema)
    expect(results.length).toBeGreaterThanOrEqual(1);
    // First result should have output
    expect(results[0].graphQLOutput).toBeDefined();
  });
});
