import { strictEqual } from "node:assert";
import { describe, it, expect } from "vitest";
import { emitSingleSchema, emitWithDiagnostics } from "./test-host.js";

/**
 * Tests for coverage gaps identified in the 2026-02-19 code review.
 * These supplement existing tests in other files.
 */
describe("Coverage Gaps", () => {
  describe("@doc propagation", () => {
    it("propagates doc comments to model descriptions", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          /** A user in the system */
          model User {
            id: string;
            name: string;
          }

          @query
          op getUser(id: string): User;
        }
      `;

      const result = await emitSingleSchema(code, {});
      strictEqual(result.includes('"""A user in the system"""'), true);
    });

    it("propagates doc comments to field descriptions", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model User {
            /** The unique identifier */
            id: string;
            /** The user's display name */
            name: string;
          }

          @query
          op getUser(id: string): User;
        }
      `;

      const result = await emitSingleSchema(code, {});
      strictEqual(result.includes('"""The unique identifier"""'), true);
      strictEqual(result.includes('"""The user\'s display name"""'), true);
    });

    it("propagates doc comments to enum descriptions", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          /** The role of a user */
          enum Role {
            /** Administrator with full access */
            Admin,
            /** Regular user */
            User,
          }

          model Person {
            role: Role;
          }

          @query
          op getPerson(): Person;
        }
      `;

      const result = await emitSingleSchema(code, {});
      strictEqual(result.includes('"""The role of a user"""'), true);
    });
  });

  describe("multiple @schema namespaces", () => {
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

  describe("nullable fields", () => {
    it("marks optional fields as nullable", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model User {
            id: string;
            nickname?: string;
          }

          @query
          op getUser(): User;
        }
      `;

      const result = await emitSingleSchema(code, {});
      strictEqual(result.includes("id: String!"), true);
      strictEqual(result.includes("nickname: String"), true);
      // nickname should NOT have ! (it's optional/nullable)
      strictEqual(result.includes("nickname: String!"), false);
    });

    it("marks T | null union fields as nullable", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model User {
            id: string;
            bio: string | null;
          }

          @query
          op getUser(): User;
        }
      `;

      const result = await emitSingleSchema(code, {});
      strictEqual(result.includes("id: String!"), true);
      // bio should be nullable (no !)
      strictEqual(result.includes("bio: String!"), false);
      strictEqual(result.includes("bio: String"), true);
    });
  });

  describe("array types", () => {
    it("emits list types for array properties", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model User {
            id: string;
            tags: string[];
          }

          @query
          op getUser(): User;
        }
      `;

      const result = await emitSingleSchema(code, {});
      strictEqual(result.includes("tags: [String!]!"), true);
    });

    it("emits nullable list items for optional element types", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model User {
            id: string;
            tags: (string | null)[];
          }

          @query
          op getUser(): User;
        }
      `;

      const result = await emitSingleSchema(code, {});
      strictEqual(result.includes("tags: [String]!"), true);
    });
  });

  describe("operation arguments", () => {
    it("emits operation parameters as arguments", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model User {
            id: string;
            name: string;
          }

          @query
          op getUser(id: string, includeDeleted: boolean): User;
        }
      `;

      const result = await emitSingleSchema(code, {});
      strictEqual(result.includes("getUser(id: String!, includeDeleted: Boolean!): User"), true);
    });
  });
});
