import { describe, expect, it } from "vitest";
import { emitSingleSchema } from "./test-host.js";

describe("arrays", () => {
  it("supports array types", async () => {
    const code = `
      @schema
      namespace TestNamespace {
        model Tag {
          name: string;
          color: string;
        }

        model Article {
          id: string;
          title: string;
          tags: Tag[];
          categories: string[];
        }

        @query
        op getArticle(id: string): Article;

        @query
        op listArticles(): Article[];
      }
    `;

    const result = await emitSingleSchema(code, {});

    expect(result).toMatchInlineSnapshot(`
      "type Tag {
        name: String!
        color: String!
      }

      type Article {
        id: String!
        title: String!
        tags: [Tag!]!
        categories: [String!]!
      }

      type Query {
        getArticle(id: String!): Article!
        listArticles: [Article!]!
      }

      "
    `);
  });

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
    expect(result).toMatchInlineSnapshot(`
      "type User {
        id: String!
        tags: [String!]!
      }

      type Query {
        getUser: User!
      }

      "
    `);
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
    expect(result).toMatchInlineSnapshot(`
      "type User {
        id: String!
        tags: [String]!
      }

      type Query {
        getUser: User!
      }

      "
    `);
  });
});
