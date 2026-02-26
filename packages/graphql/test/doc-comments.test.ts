import { strictEqual } from "node:assert";
import { describe, it } from "vitest";
import { emitSingleSchema } from "./test-host.js";

describe("doc comments", () => {
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
