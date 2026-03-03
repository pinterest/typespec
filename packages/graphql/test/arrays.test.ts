import { strictEqual } from "node:assert";
import { describe, it } from "vitest";
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

    strictEqual(result.includes("tags: [Tag!]!"), true);
    strictEqual(result.includes("categories: [String!]!"), true);
    strictEqual(result.includes("listArticles: [Article!]"), true);
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
