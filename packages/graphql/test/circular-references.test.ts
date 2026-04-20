import { strictEqual } from "node:assert";
import { describe, it } from "vitest";
import { emitSingleSchema } from "./test-host.js";

describe("circular references", () => {
  it("handles circular references between models", async () => {
    const code = `
      @schema
      namespace TestNamespace {
        model User {
          id: string;
          name: string;
          posts: Post[];
        }

        model Post {
          id: string;
          title: string;
          author: User;
          comments: Comment[];
        }

        model Comment {
          id: string;
          text: string;
          author: User;
          post: Post;
        }

        @query
        op getUser(id: string): User;

        @query
        op getPost(id: string): Post;
      }
    `;

    const result = await emitSingleSchema(code, {});

    strictEqual(result.includes("type User {"), true);
    strictEqual(result.includes("posts: [Post!]!"), true);
    strictEqual(result.includes("type Post {"), true);
    strictEqual(result.includes("author: User!"), true);
    strictEqual(result.includes("comments: [Comment!]!"), true);
    strictEqual(result.includes("type Comment {"), true);
  });
});
