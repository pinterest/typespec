import { describe, expect, it } from "vitest";
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
    expect(result).toMatchInlineSnapshot(`
      """"A user in the system"""
      type User {
        id: String!
        name: String!
      }

      type Query {
        getUser(id: String!): User!
      }

      "
    `);
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
    expect(result).toMatchInlineSnapshot(`
      "type User {
        """The unique identifier"""
        id: String!

        """The user's display name"""
        name: String!
      }

      type Query {
        getUser(id: String!): User!
      }

      "
    `);
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
    expect(result).toMatchInlineSnapshot(`
      """"The role of a user"""
      enum Role {
        """Administrator with full access"""
        Admin

        """Regular user"""
        User
      }

      type Person {
        role: Role!
      }

      type Query {
        getPerson: Person!
      }

      "
    `);
  });
});
