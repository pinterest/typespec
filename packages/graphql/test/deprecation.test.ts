import { strictEqual } from "node:assert";
import { describe, it } from "vitest";
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

    strictEqual(result.includes('@deprecated(reason: "Use email instead")'), true);
    strictEqual(result.includes('@deprecated(reason: "Use getUserById instead")'), true);
  });
});
