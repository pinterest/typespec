import { describe, expect, it } from "vitest";
import { emitSingleSchema } from "./test-host.js";

/**
 * Integration tests for GraphQL interface SDL output.
 * For decorator behavior tests, see interface.test.ts.
 */
describe("interfaces SDL output", () => {
  it("emits interface type declaration", async () => {
    const code = `
      @schema
      namespace TestNamespace {
        /** A node with a unique identifier */
        @Interface
        model Node {
          id: string;
        }

        @compose(Node)
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
      """"A node with a unique identifier"""
      interface Node {
        id: String!
      }

      type User implements Node {
        id: String!
        name: String!
      }

      type Query {
        getUser(id: String!): User!
      }

      "
    `);
  });

  it("emits model implementing multiple interfaces", async () => {
    const code = `
      @schema
      namespace TestNamespace {
        @Interface
        model Node {
          id: string;
        }

        @Interface
        model Timestamped {
          createdAt: string;
          updatedAt: string;
        }

        @compose(Node, Timestamped)
        model Article {
          id: string;
          createdAt: string;
          updatedAt: string;
          title: string;
          body: string;
        }

        @query
        op getArticle(id: string): Article;
      }
    `;

    const result = await emitSingleSchema(code, {});

    expect(result).toMatchInlineSnapshot(`
      "interface Node {
        id: String!
      }

      interface Timestamped {
        createdAt: String!
        updatedAt: String!
      }

      type Article implements Node & Timestamped {
        id: String!
        createdAt: String!
        updatedAt: String!
        title: String!
        body: String!
      }

      type Query {
        getArticle(id: String!): Article!
      }

      "
    `);
  });

  it("emits interface implementing another interface", async () => {
    const code = `
      @schema
      namespace TestNamespace {
        @Interface
        model Node {
          id: string;
        }

        @Interface
        @compose(Node)
        model Authored {
          id: string;
          authorId: string;
        }

        @compose(Authored)
        model Post {
          id: string;
          authorId: string;
          title: string;
        }

        @query
        op getPost(id: string): Post;
      }
    `;

    const result = await emitSingleSchema(code, {});

    expect(result).toMatchInlineSnapshot(`
      "interface Node {
        id: String!
      }

      interface Authored {
        id: String!
        authorId: String!
      }

      type Post implements Authored {
        id: String!
        authorId: String!
        title: String!
      }

      type Query {
        getPost(id: String!): Post!
      }

      "
    `);
  });

  it("emits multiple models implementing same interface", async () => {
    const code = `
      @schema
      namespace TestNamespace {
        /** A searchable entity */
        @Interface
        model Searchable {
          searchText: string;
        }

        @compose(Searchable)
        model Product {
          id: string;
          searchText: string;
          name: string;
          price: float64;
        }

        @compose(Searchable)
        model Article {
          id: string;
          searchText: string;
          title: string;
          body: string;
        }

        @query
        op getProduct(id: string): Product;

        @query
        op getArticle(id: string): Article;
      }
    `;

    const result = await emitSingleSchema(code, {});

    expect(result).toMatchInlineSnapshot(`
      """"A searchable entity"""
      interface Searchable {
        searchText: String!
      }

      type Product implements Searchable {
        searchText: String!
        id: String!
        name: String!
        price: Float!
      }

      type Article implements Searchable {
        searchText: String!
        id: String!
        title: String!
        body: String!
      }

      type Query {
        getProduct(id: String!): Product!
        getArticle(id: String!): Article!
      }

      "
    `);
  });

  it("emits interface with complex field types", async () => {
    const code = `
      @schema
      namespace TestNamespace {
        model Tag {
          name: string;
        }

        @Interface
        model Taggable {
          tags: Tag[];
        }

        @compose(Taggable)
        model Post {
          id: string;
          tags: Tag[];
          title: string;
        }

        @query
        op getPost(id: string): Post;
      }
    `;

    const result = await emitSingleSchema(code, {});

    expect(result).toMatchInlineSnapshot(`
      "interface Taggable {
        tags: [Tag!]!
      }

      type Tag {
        name: String!
      }

      type Post implements Taggable {
        tags: [Tag!]!
        id: String!
        title: String!
      }

      type Query {
        getPost(id: String!): Post!
      }

      "
    `);
  });

  it("handles interface with optional fields", async () => {
    const code = `
      @schema
      namespace TestNamespace {
        @Interface
        model Auditable {
          createdBy: string;
          modifiedBy?: string;
        }

        @compose(Auditable)
        model Document {
          id: string;
          createdBy: string;
          modifiedBy?: string;
          content: string;
        }

        @query
        op getDocument(id: string): Document;
      }
    `;

    const result = await emitSingleSchema(code, {});

    expect(result).toMatchInlineSnapshot(`
      "interface Auditable {
        createdBy: String!
        modifiedBy: String
      }

      type Document implements Auditable {
        createdBy: String!
        modifiedBy: String
        id: String!
        content: String!
      }

      type Query {
        getDocument(id: String!): Document!
      }

      "
    `);
  });
});
