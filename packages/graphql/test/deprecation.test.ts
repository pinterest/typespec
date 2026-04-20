import { describe, expect, it } from "vitest";
import { emitSingleSchema } from "./test-host.js";

describe("deprecation", () => {
  it("supports @deprecated directive", async () => {
    const code = `
      @schema
      namespace TestNamespace {
        model User {
          id: string;
          name: string;
          #deprecated "Use email instead"
          username: string;
        }

        @query
        op getUser(id: string): User;

        #deprecated "Use getUserById instead"
        @query
        op findUser(id: string): User;
      }
    `;

    const result = await emitSingleSchema(code, {});

    expect(result).toMatchInlineSnapshot(`
      "type User {
        id: String!
        name: String!
        username: String! @deprecated(reason: "Use email instead")
      }

      type Query {
        getUser(id: String!): User!
        findUser(id: String!): User! @deprecated(reason: "Use getUserById instead")
      }

      "
    `);
  });
});
