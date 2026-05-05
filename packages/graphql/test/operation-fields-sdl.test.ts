import { describe, expect, it } from "vitest";
import { emitSingleSchema } from "./test-host.js";

/**
 * Integration tests for @operationFields SDL output.
 * For decorator behavior tests, see operation-fields.test.ts.
 */
describe("@operationFields SDL output", () => {
  it("emits object type with field arguments from operation", async () => {
    const code = `
      @schema
      namespace TestNamespace {
        model Post {
          id: string;
          title: string;
        }

        /** Get posts with pagination */
        op posts(first: int32, after: string | null): Post[];

        @operationFields(posts)
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
      "type Post {
        id: String!
        title: String!
      }

      type User {
        id: String!
        name: String!

        """Get posts with pagination"""
        posts(first: Int!, after: String): [Post!]!
      }

      type Query {
        getUser(id: String!): User!
      }

      "
    `);
  });

  it("emits object type with multiple operation fields", async () => {
    const code = `
      @schema
      namespace TestNamespace {
        model User {
          id: string;
          name: string;
        }

        model Post {
          id: string;
          title: string;
        }

        op followers(limit: int32): User[];
        op posts(status: string | null): Post[];
        op followersCount(): int32;

        @operationFields(followers, posts, followersCount)
        model UserProfile {
          id: string;
          username: string;
          bio?: string;
        }

        @query
        op getUserProfile(id: string): UserProfile;
      }
    `;

    const result = await emitSingleSchema(code, {});

    expect(result).toMatchInlineSnapshot(`
      "type User {
        id: String!
        name: String!
      }

      type Post {
        id: String!
        title: String!
      }

      type UserProfile {
        id: String!
        username: String!
        bio: String
        followers(limit: Int!): [User!]!
        posts(status: String): [Post!]!
        followersCount: Int!
      }

      type Query {
        getUserProfile(id: String!): UserProfile!
      }

      "
    `);
  });

  it("emits operation fields from interface operations", async () => {
    const code = `
      @schema
      namespace TestNamespace {
        model Comment {
          id: string;
          text: string;
        }

        interface Commentable {
          op comments(limit: int32, offset: int32): Comment[];
        }

        @operationFields(Commentable)
        model Article {
          id: string;
          title: string;
        }

        @query
        op getArticle(id: string): Article;
      }
    `;

    const result = await emitSingleSchema(code, {});

    expect(result).toMatchInlineSnapshot(`
      "type Comment {
        id: String!
        text: String!
      }

      type Article {
        id: String!
        title: String!
        comments(limit: Int!, offset: Int!): [Comment!]!
      }

      type Query {
        getArticle(id: String!): Article!
      }

      "
    `);
  });

  it("emits operation field with multiple arguments", async () => {
    const code = `
      @schema
      namespace TestNamespace {
        model Activity {
          id: string;
          type: string;
          timestamp: string;
        }

        op activities(minDate: string | null, maxDate: string | null, limit: int32): Activity[];

        @operationFields(activities)
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
      "type Activity {
        id: String!
        type: String!
        timestamp: String!
      }

      type User {
        id: String!
        name: String!
        activities(minDate: String, maxDate: String, limit: Int!): [Activity!]!
      }

      type Query {
        getUser(id: String!): User!
      }

      "
    `);
  });

  it("emits operation field returning scalar", async () => {
    const code = `
      @schema
      namespace TestNamespace {
        op connectionCount(): int32;
        op isVerified(): boolean;
        op rating(): float64;

        @operationFields(connectionCount, isVerified, rating)
        model Profile {
          id: string;
          name: string;
        }

        @query
        op getProfile(id: string): Profile;
      }
    `;

    const result = await emitSingleSchema(code, {});

    expect(result).toMatchInlineSnapshot(`
      "type Profile {
        id: String!
        name: String!
        connectionCount: Int!
        isVerified: Boolean!
        rating: Float!
      }

      type Query {
        getProfile(id: String!): Profile!
      }

      "
    `);
  });
});
