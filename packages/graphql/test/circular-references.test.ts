import { describe, expect, it } from "vitest";
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

    expect(result).toMatchInlineSnapshot(`
      "type User {
        id: String!
        name: String!
        posts: [Post!]!
      }

      type Post {
        id: String!
        title: String!
        author: User!
        comments: [Comment!]!
      }

      type Comment {
        id: String!
        text: String!
        author: User!
        post: Post!
      }

      type Query {
        getUser(id: String!): User!
        getPost(id: String!): Post!
      }

      "
    `);
  });
});
