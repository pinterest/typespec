import { describe, expect, it } from "vitest";
import { emitSingleSchemaWithDiagnostics } from "./test-host.js";

/**
 * Integration tests for GraphQL emitter diagnostics.
 * Tests that appropriate warnings and errors are reported.
 */
describe("diagnostics", () => {
  describe("empty-schema", () => {
    it("warns when schema has no operations", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model User {
            id: string;
            name: string;
          }
        }
      `;

      const result = await emitSingleSchemaWithDiagnostics(code, {});
      const diagnostics = result.diagnostics.filter(
        (d) => d.code === "@typespec/graphql/empty-schema",
      );

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].severity).toBe("warning");
      expect(diagnostics[0].message).toContain("at least one query operation");
    });

    it("warns when schema has only mutations (no query)", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model User {
            id: string;
          }

          @mutation
          op createUser(name: string): User;
        }
      `;

      const result = await emitSingleSchemaWithDiagnostics(code, {});
      const diagnostics = result.diagnostics.filter(
        (d) => d.code === "@typespec/graphql/empty-schema",
      );

      expect(diagnostics).toHaveLength(1);
    });

    it("warns when schema has only subscriptions (no query)", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model Event {
            id: string;
          }

          @subscription
          op onEvent(): Event;
        }
      `;

      const result = await emitSingleSchemaWithDiagnostics(code, {});
      const diagnostics = result.diagnostics.filter(
        (d) => d.code === "@typespec/graphql/empty-schema",
      );

      expect(diagnostics).toHaveLength(1);
    });
  });

  describe("void-operation-return", () => {
    it("warns when operation returns void", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model User {
            id: string;
          }

          @query
          op getUsers(): User[];

          @mutation
          op doSomething(): void;
        }
      `;

      const result = await emitSingleSchemaWithDiagnostics(code, {});
      const diagnostics = result.diagnostics.filter(
        (d) => d.code === "@typespec/graphql/void-operation-return",
      );

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].severity).toBe("warning");
      expect(diagnostics[0].message).toContain("doSomething");
    });

    it("warns for multiple void operations", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model User {
            id: string;
          }

          @query
          op getUsers(): User[];

          @mutation
          op doFirst(): void;

          @mutation
          op doSecond(): void;
        }
      `;

      const result = await emitSingleSchemaWithDiagnostics(code, {});
      const diagnostics = result.diagnostics.filter(
        (d) => d.code === "@typespec/graphql/void-operation-return",
      );

      expect(diagnostics).toHaveLength(2);
    });
  });

  describe("union diagnostics", () => {
    it("warns on duplicate union variants after flattening", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model A { a: string; }
          model B { b: string; }

          union Inner {
            a: A,
            b: B,
          }

          // Outer includes A directly and via Inner (which contains A)
          union Outer {
            a: A,
            inner: Inner,
          }

          model Container {
            value: Outer;
          }

          @query
          op get(): Container;
        }
      `;

      const result = await emitSingleSchemaWithDiagnostics(code, {});
      const diagnostics = result.diagnostics.filter(
        (d) => d.code === "@typespec/graphql/duplicate-union-variant",
      );

      // A appears twice after flattening Inner into Outer
      expect(diagnostics.length).toBeGreaterThanOrEqual(1);
      expect(diagnostics[0].severity).toBe("warning");
    });

  });

  describe("interface diagnostics", () => {
    it("errors when @compose used with non-interface", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model NotAnInterface {
            id: string;
          }

          @compose(NotAnInterface)
          model User {
            id: string;
            name: string;
          }

          @query
          op getUser(): User;
        }
      `;

      const result = await emitSingleSchemaWithDiagnostics(code, {});
      const diagnostics = result.diagnostics.filter(
        (d) => d.code === "@typespec/graphql/invalid-interface",
      );

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].severity).toBe("error");
    });

    it("errors when interface property is missing", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          @Interface
          model Node {
            id: string;
          }

          @compose(Node)
          model User {
            // Missing 'id' property!
            name: string;
          }

          @query
          op getUser(): User;
        }
      `;

      const result = await emitSingleSchemaWithDiagnostics(code, {});
      const diagnostics = result.diagnostics.filter(
        (d) => d.code === "@typespec/graphql/missing-interface-property",
      );

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].severity).toBe("error");
    });

    it("errors when interface property type is incompatible", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          @Interface
          model Node {
            id: string;
          }

          @compose(Node)
          model User {
            id: int32;  // Wrong type!
            name: string;
          }

          @query
          op getUser(): User;
        }
      `;

      const result = await emitSingleSchemaWithDiagnostics(code, {});
      const diagnostics = result.diagnostics.filter(
        (d) => d.code === "@typespec/graphql/incompatible-interface-property",
      );

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].severity).toBe("error");
    });

    it("errors on circular interface implementation", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          @compose(SelfRef)
          @Interface
          model SelfRef {
            id: string;
          }

          @compose(SelfRef)
          model User {
            id: string;
          }

          @query
          op getUser(): User;
        }
      `;

      const result = await emitSingleSchemaWithDiagnostics(code, {});
      const diagnostics = result.diagnostics.filter(
        (d) => d.code === "@typespec/graphql/circular-interface",
      );

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].severity).toBe("error");
    });
  });

  describe("operation-kind diagnostics", () => {
    it("errors when multiple operation kinds applied", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model User {
            id: string;
          }

          @query
          op getUsers(): User[];

          @query
          @mutation
          op conflicting(): User;
        }
      `;

      const result = await emitSingleSchemaWithDiagnostics(code, {});
      const diagnostics = result.diagnostics.filter(
        (d) => d.code === "@typespec/graphql/graphql-operation-kind-duplicate",
      );

      expect(diagnostics.length).toBeGreaterThanOrEqual(1);
      expect(diagnostics[0].severity).toBe("error");
    });
  });

  describe("no errors for valid schemas", () => {
    it("produces no errors for well-formed schema", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          @Interface
          model Node {
            id: string;
          }

          @compose(Node)
          model User {
            id: string;
            name: string;
          }

          @query
          op getUser(id: string): User;

          @mutation
          op createUser(name: string): User;

          @subscription
          op onUserCreated(): User;
        }
      `;

      const result = await emitSingleSchemaWithDiagnostics(code, {});
      const errors = result.diagnostics.filter((d) => d.severity === "error");

      expect(errors).toHaveLength(0);
      expect(result.graphQLOutput).toBeDefined();
    });
  });
});
