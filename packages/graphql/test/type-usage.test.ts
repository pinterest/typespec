import { strictEqual } from "node:assert";
import { describe, it } from "vitest";
import { emitSingleSchema } from "./test-host.js";

describe("type-usage", () => {
  it("includes all types by default (omit-unreachable-types = false)", async () => {
    const code = `
      @schema
      namespace TestNamespace {
        model Reachable {
          id: string;
        }

        model Unreferenced {
          value: int32;
        }

        @query
        op getReachable(): Reachable;
      }
    `;

    const result = await emitSingleSchema(code, {});

    // Both types should be present when omit-unreachable-types is false (default)
    strictEqual(result.includes("type Reachable {"), true, "Reachable type should be present");
    strictEqual(result.includes("type Unreferenced {"), true, "Unreferenced type should be present by default");
  });

  it("omits unreferenced types when omit-unreachable-types = true", async () => {
    const code = `
      @schema
      namespace TestNamespace {
        model Reachable {
          id: string;
        }

        model Unreferenced {
          value: int32;
        }

        @query
        op getReachable(): Reachable;
      }
    `;

    const result = await emitSingleSchema(code, { "omit-unreachable-types": true });

    strictEqual(result.includes("type Reachable {"), true, "Reachable type should be present");
    strictEqual(result.includes("type Unreferenced {"), false, "Unreferenced type should be omitted");
  });

  it("includes types referenced from operations", async () => {
    const code = `
      @schema
      namespace TestNamespace {
        model Address {
          street: string;
          city: string;
        }

        model User {
          id: string;
          address: Address;
        }

        @query
        op getUser(id: string): User;
      }
    `;

    const result = await emitSingleSchema(code, {});

    // Both User and Address should be present since Address is nested in User
    strictEqual(result.includes("type User {"), true, "User type should be present");
    strictEqual(result.includes("type Address {"), true, "Address type should be present (nested reference)");
  });

  it("handles circular type references without infinite loops", async () => {
    const code = `
      @schema
      namespace TestNamespace {
        model Node {
          id: string;
          children: Node[];
        }

        @query
        op getNode(id: string): Node;
      }
    `;

    // Should not hang or throw — circular references should be handled
    const result = await emitSingleSchema(code, {});

    strictEqual(result.includes("type Node {"), true, "Node type should be present");
  });
});
