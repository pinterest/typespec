import type { Namespace } from "@typespec/compiler";
import { expectDiagnosticEmpty } from "@typespec/compiler/testing";
import { describe, expect, it } from "vitest";
import { getSchema } from "../src/lib/schema.js";
// UNUSED: Legacy registry class was removed
// import { GraphQLTypeRegistry } from "../src/registry.js";
import { compileAndDiagnose } from "./test-host.js";

describe("@schema", () => {
  it("Creates a schema with no name", async () => {
    const [program, { TestNamespace }, diagnostics] = await compileAndDiagnose<{
      TestNamespace: Namespace;
    }>(`
      @schema
      @test namespace TestNamespace {}
    `);
    expectDiagnosticEmpty(diagnostics);

    const schema = getSchema(program, TestNamespace);

    expect(schema?.type).toBe(TestNamespace);
    expect(schema?.name).toBeUndefined();
  });

  it("Creates a schema with a specified name", async () => {
    const [program, { TestNamespace }, diagnostics] = await compileAndDiagnose<{
      TestNamespace: Namespace;
    }>(`
      @schema(#{name: "MySchema"})
      @test namespace TestNamespace {}
    `);
    expectDiagnosticEmpty(diagnostics);

    const schema = getSchema(program, TestNamespace);

    expect(schema?.type).toBe(TestNamespace);
    expect(schema?.name).toBe("MySchema");
  });
});

// UNUSED: Tests for the legacy GraphQLTypeRegistry class that was removed
// TODO: Add tests for the new GraphQLEmitterRegistry if needed
/*
describe("GraphQLTypeRegistry - Collision Detection", () => {
  // Mock a basic TypeSpec Model for testing
  function createMockModel(name: string): any {
    return {
      kind: "Model",
      name,
      properties: new Map(),
      baseModel: undefined,
      derivedModels: [],
      decorators: [],
      namespace: undefined,
      node: undefined,
      indexer: undefined,
      sourceModel: undefined,
    };
  }

  // Mock a basic TypeSpec Program for testing
  function createMockProgram(): any {
    return {
      checker: {
        getStdType: (name: string) => ({ kind: "Scalar", name }),
      },
    };
  }

  it("should prevent registering models with duplicate names", () => {
    // Reset global registry before test
    GraphQLTypeRegistry.resetGlobalRegistry();
    
    const program = createMockProgram();
    const registry = new GraphQLTypeRegistry(program);

    const model1 = createMockModel("User");
    const model2 = createMockModel("User"); // Same name

    // First registration should succeed
    expect(() => registry.addModel(model1)).not.toThrow();

    // Second registration with same name should fail
    expect(() => registry.addModel(model2)).toThrow(
      "GraphQL type name 'User' is already registered. Type names must be unique across the entire schema.",
    );
  });

  it("should allow registering models with different names", () => {
    // Reset global registry before test  
    GraphQLTypeRegistry.resetGlobalRegistry();
    
    const program = createMockProgram();
    const registry = new GraphQLTypeRegistry(program); // Fresh registry instance

    const user = createMockModel("User");
    const book = createMockModel("Book");

    // Both registrations should succeed
    expect(() => registry.addModel(user)).not.toThrow();
    expect(() => registry.addModel(book)).not.toThrow();
  });
});
*/
