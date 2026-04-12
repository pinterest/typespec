import { strictEqual } from "node:assert";
import { expectDiagnosticEmpty, expectDiagnostics, t } from "@typespec/compiler/testing";
import { describe, expect, it } from "vitest";
import { getOperationFields } from "../src/lib/operation-fields.js";
import { emitSingleSchema, Tester } from "./test-host.js";

describe("@operationFields", () => {
  it("can add an operation to the model", async () => {
    const { program, TestModel, testOperation } = await Tester.compile(t.code`
      @test op ${t.op("testOperation")}(): void;

      @operationFields(testOperation)
      @test model ${t.model("TestModel")} {}
    `);

    expect(getOperationFields(program, TestModel)).toContain(testOperation);
  });

  it("can add an interface to the model", async () => {
    const { program, TestModel, testOperation } = await Tester.compile(t.code`
      interface TestInterface {
        @test op ${t.op("testOperation")}(): void;
      }

      @operationFields(TestInterface)
      @test model ${t.model("TestModel")} {}
    `);

    expect(getOperationFields(program, TestModel)).toContain(testOperation);
  });

  it("can add an multiple operations to the model", async () => {
    const { program, TestModel, testOperation1, testOperation2, testOperation3 } =
      await Tester.compile(t.code`
      interface TestInterface {
        @test op ${t.op("testOperation1")}(): void;
        @test op ${t.op("testOperation2")}(): void;
      }

      @test op ${t.op("testOperation3")}(): void;

      @operationFields(TestInterface, testOperation3)
      @test model ${t.model("TestModel")} {}
    `);

    expect(getOperationFields(program, TestModel)).toContain(testOperation1);
    expect(getOperationFields(program, TestModel)).toContain(testOperation2);
    expect(getOperationFields(program, TestModel)).toContain(testOperation3);
  });

  it("will add duplicate operations with a warning", async () => {
    const [{ program, TestModel, testOperation }, diagnostics] =
      await Tester.compileAndDiagnose(t.code`
      interface TestInterface {
        @test op ${t.op("testOperation")}(): void;
      }

      @operationFields(TestInterface, TestInterface.testOperation)
      @test model ${t.model("TestModel")} {}
    `);
    expectDiagnostics(diagnostics, {
      code: "@typespec/graphql/operation-field-duplicate",
      message: "Operation `testOperation` is defined multiple times on `TestModel`.",
    });

    expect(getOperationFields(program, TestModel)).toContain(testOperation);
  });

  describe("conflicts", () => {
    it("does not allow adding operations that conflict with a field", async () => {
      const diagnostics = await Tester.diagnose(`
        op foo(): void;
  
        @operationFields(foo)
        model TestModel {
          foo: string;
        }
      `);
      expectDiagnostics(diagnostics, {
        code: "@typespec/graphql/operation-field-conflict",
        message: "Operation `foo` conflicts with an existing property on model `TestModel`.",
      });
    });

    it("does not allow adding operations that conflict with another operation in return type", async () => {
      const diagnostics = await Tester.diagnose(`
        op testOperation(): string;
  
        interface TestInterface {
          op testOperation(): void;
        }
  
        @operationFields(testOperation, TestInterface.testOperation)
        model TestModel {}
      `);
      expectDiagnostics(diagnostics, {
        code: "@typespec/graphql/operation-field-conflict",
        message:
          "Operation `testOperation` conflicts with an existing operation on model `TestModel`.",
      });
    });

    it("does not allow adding operations that conflict with another operation in number of arguments", async () => {
      const diagnostics = await Tester.diagnose(`
        op testOperation(a: string, b: integer): void;
  
        interface TestInterface {
          op testOperation(a: string): void;
        }
  
        @operationFields(testOperation, TestInterface.testOperation)
        model TestModel {}
      `);
      expectDiagnostics(diagnostics, {
        code: "@typespec/graphql/operation-field-conflict",
        message:
          "Operation `testOperation` conflicts with an existing operation on model `TestModel`.",
      });
    });

    it("does not allow adding operations that conflict with another operation in argument type", async () => {
      const diagnostics = await Tester.diagnose(`
        op testOperation(a: string): void;
  
        interface TestInterface {
          op testOperation(a: integer): void;
        }
  
        @operationFields(testOperation, TestInterface.testOperation)
        model TestModel {}
      `);
      expectDiagnostics(diagnostics, {
        code: "@typespec/graphql/operation-field-conflict",
        message:
          "Operation `testOperation` conflicts with an existing operation on model `TestModel`.",
      });
    });

    it("does not allow adding operations that conflict with another operation in argument name", async () => {
      const diagnostics = await Tester.diagnose(`
        op testOperation(a: string): void;
  
        interface TestInterface {
          op testOperation(b: string): void;
        }
  
        @operationFields(testOperation, TestInterface.testOperation)
        model TestModel {}
      `);
      expectDiagnostics(diagnostics, {
        code: "@typespec/graphql/operation-field-conflict",
        message:
          "Operation `testOperation` conflicts with an existing operation on model `TestModel`.",
      });
    });

    it("allows adding operations with a different argument order", async () => {
      const diagnostics = await Tester.diagnose(`
        op testOperation(a: string, b: integer): void;

        interface TestInterface {
          op testOperation(b: integer, a: string): void;
        }

        @operationFields(testOperation, TestInterface.testOperation)
        model TestModel {}
      `);
      expectDiagnosticEmpty(diagnostics);
    });
  });

  describe("SDL output", () => {
    it("emits operation fields on types", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model Comment {
            id: string;
            text: string;
          }

          @operationFields(getComments)
          model Post {
            id: string;
            title: string;
          }

          @query
          op getPost(id: string): Post;

          @query
          op getComments(postId: string): Comment[];
        }
      `;

      const result = await emitSingleSchema(code, {});

      // Post should have the getComments field
      const postTypeMatch = result.match(/type Post \{[^}]+\}/s);
      strictEqual(postTypeMatch !== null, true);
      if (postTypeMatch) {
        strictEqual(postTypeMatch[0].includes("getComments(postId: String!): [Comment!]"), true);
      }
    });
  });
});
