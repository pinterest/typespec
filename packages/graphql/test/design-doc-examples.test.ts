import { strictEqual } from "node:assert";
import { describe, it } from "vitest";
import { emitSingleSchema } from "./test-host.js";

/**
 * Comprehensive tests based on actual design doc examples
 * Design doc: https://github.com/microsoft/typespec/issues/4933
 * Tests all major GraphQL emitter features from the design document
 */
describe("Design Doc Examples", () => {
  describe("Custom Scalars", () => {
    it("supports custom scalar types", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          /** ISO 8601 date-time string */
          scalar DateTime;

          /** Valid URL string */
          scalar URL;

          /** Arbitrary JSON value */
          scalar JSON;

          model Event {
            id: string;
            timestamp: DateTime;
            website: URL;
            metadata: JSON;
          }

          @query
          op getEvent(id: string): Event;
        }
      `;

      const result = await emitSingleSchema(code, {});

      strictEqual(result.includes('"""ISO 8601 date-time string"""'), true);
      strictEqual(result.includes("scalar DateTime"), true);
      strictEqual(result.includes('"""Valid URL string"""'), true);
      strictEqual(result.includes("scalar URL"), true);
      strictEqual(result.includes('"""Arbitrary JSON value"""'), true);
      strictEqual(result.includes("scalar JSON"), true);
      strictEqual(result.includes("timestamp: DateTime!"), true);
      strictEqual(result.includes("website: URL!"), true);
      strictEqual(result.includes("metadata: JSON!"), true);
    });
  });

  describe("Enums", () => {
    it("supports enums with descriptions", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          /** The status of an order */
          enum OrderStatus {
            /** Order has been placed but not processed */
            Pending,
            /** Order is being prepared */
            Processing,
            /** Order has been shipped */
            Shipped,
            /** Order has been delivered */
            Delivered,
            /** Order was cancelled */
            Cancelled,
          }

          model Order {
            id: string;
            status: OrderStatus;
          }

          @query
          op getOrder(id: string): Order;
        }
      `;

      const result = await emitSingleSchema(code, {});

      strictEqual(result.includes('"""The status of an order"""'), true);
      strictEqual(result.includes("enum OrderStatus {"), true);
      strictEqual(result.includes('"""Order has been placed but not processed"""'), true);
      strictEqual(result.includes("Pending"), true);
      strictEqual(result.includes("Processing"), true);
      strictEqual(result.includes("Cancelled"), true);
    });
  });

  describe("Unions", () => {
    it("supports named union types", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model TextContent {
            text: string;
          }

          model ImageContent {
            url: string;
            alt: string;
          }

          model VideoContent {
            url: string;
            duration: int32;
          }

          /** Content can be text, image, or video */
          union Content {
            text: TextContent,
            image: ImageContent,
            video: VideoContent,
          }

          model Post {
            id: string;
            content: Content;
          }

          @query
          op getPost(id: string): Post;
        }
      `;

      const result = await emitSingleSchema(code, {});

      strictEqual(result.includes('"""Content can be text, image, or video"""'), true);
      strictEqual(result.includes("union Content = TextContent | ImageContent | VideoContent"), true);
      strictEqual(result.includes("type Post {"), true);
      strictEqual(result.includes("content: Content!"), true);
    });

    it("supports anonymous unions in return types", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model User {
            id: string;
            name: string;
          }

          model Error {
            message: string;
          }

          @query
          op findUser(id: string): User | Error;
        }
      `;

      const result = await emitSingleSchema(code, {});

      // Should generate a union for the anonymous union
      strictEqual(
        result.includes("union") &&
        (result.includes("User") && result.includes("Error")),
        true
      );
    });
  });

  describe("Arrays and Lists", () => {
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
  });

  describe("Interfaces", () => {
    it("supports interface definitions and implementations", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          /** Base interface for all nodes with an ID */
          @Interface
          model Node {
            id: string;
          }

          /** Base interface for timestamped entities */
          @Interface
          model Timestamped {
            createdAt: string;
            updatedAt: string;
          }

          @compose(Node, Timestamped)
          model User {
            ...Node;
            ...Timestamped;
            name: string;
            email: string;
          }

          @compose(Node, Timestamped)
          model Post {
            ...Node;
            ...Timestamped;
            title: string;
            content: string;
          }

          @query
          op getUser(id: string): User;

          @query
          op getPost(id: string): Post;
        }
      `;

      const result = await emitSingleSchema(code, {});

      strictEqual(result.includes('"""Base interface for all nodes with an ID"""'), true);
      strictEqual(result.includes("interface Node {"), true);
      strictEqual(result.includes("interface Timestamped {"), true);
      strictEqual(result.includes("type User implements Node & Timestamped {"), true);
      strictEqual(result.includes("type Post implements Node & Timestamped {"), true);
    });
  });

  describe("Operation Types", () => {
    it("supports queries, mutations, and subscriptions", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model User {
            id: string;
            name: string;
          }

          model Message {
            id: string;
            text: string;
            userId: string;
          }

          @query
          op getUser(id: string): User;

          @query
          op listUsers(): User[];

          @mutation
          op createUser(name: string): User;

          @mutation
          op updateUser(id: string, name: string): User;

          @subscription
          op onMessageReceived(userId: string): Message;
        }
      `;

      const result = await emitSingleSchema(code, {});

      strictEqual(result.includes("type Query {"), true);
      strictEqual(result.includes("getUser(id: String!): User"), true);
      strictEqual(result.includes("listUsers: [User!]"), true);

      strictEqual(result.includes("type Mutation {"), true);
      strictEqual(result.includes("createUser(name: String!): User"), true);
      strictEqual(result.includes("updateUser(id: String!, name: String!): User"), true);

      strictEqual(result.includes("type Subscription {"), true);
      strictEqual(result.includes("onMessageReceived(userId: String!): Message"), true);
    });
  });

  describe("Optional Fields and Nullability", () => {
    it("handles optional properties correctly", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model User {
            id: string;
            name: string;
            email?: string;
            phoneNumber?: string;
          }

          @query
          op getUser(id: string): User;

          @mutation
          op updateUser(id: string, email?: string, phoneNumber?: string): User;
        }
      `;

      const result = await emitSingleSchema(code, {});

      // Required fields should have !
      strictEqual(result.includes("id: String!"), true);
      strictEqual(result.includes("name: String!"), true);

      // Optional fields should not have !
      const userTypeMatch = result.match(/type User \{[^}]+\}/s);
      strictEqual(userTypeMatch !== null, true);
      if (userTypeMatch) {
        strictEqual(userTypeMatch[0].includes("email: String\n"), true);
        strictEqual(userTypeMatch[0].includes("phoneNumber: String\n"), true);
      }

      // Optional parameters in mutations — in input context, ? does NOT make nullable
      strictEqual(result.includes("updateUser(id: String!, email: String!, phoneNumber: String!): User"), true);
    });
  });

  describe("Deprecation", () => {
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

  describe("Circular References", () => {
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

  describe("Operation Fields", () => {
    it("supports @operationFields decorator", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model Comment {
            id: string;
            text: string;
          }

          @operationFields(getComments)
          model Post {
            id: string;
            title: string;
          }

          @query
          op getPost(id: string): Post;

          @query
          op getComments(postId: string): Comment[];
        }
      `;

      const result = await emitSingleSchema(code, {});

      // Post should have the getComments field
      const postTypeMatch = result.match(/type Post \{[^}]+\}/s);
      strictEqual(postTypeMatch !== null, true);
      if (postTypeMatch) {
        strictEqual(postTypeMatch[0].includes("getComments(postId: String!): [Comment!]"), true);
      }
    });
  });

  describe("Complex Scenarios", () => {
    it("handles complex nested input/output splitting", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model Address {
            street: string;
            city: string;
            country: string;
          }

          model ContactInfo {
            email: string;
            phone?: string;
            address: Address;
          }

          model User {
            id: string;
            name: string;
            contact: ContactInfo;
            friends: User[];
          }

          @mutation
          op createUser(name: string, contact: ContactInfo): User;

          @query
          op getUser(id: string): User;

          @mutation
          op updateUser(id: string, user: User): User;
        }
      `;

      const result = await emitSingleSchema(code, {});

      // All models used as both input and output should have both variants
      strictEqual(result.includes("type User {"), true);
      strictEqual(result.includes("input UserInput {"), true);
      strictEqual(result.includes("type ContactInfo {"), true);
      strictEqual(result.includes("input ContactInfoInput {"), true);
      strictEqual(result.includes("type Address {"), true);
      strictEqual(result.includes("input AddressInput {"), true);

      // Check correct usage in operations
      strictEqual(result.includes("createUser(name: String!, contact: ContactInfoInput!): User"), true);
      strictEqual(result.includes("updateUser(id: String!, user: UserInput!): User"), true);

      // Check nested references use correct variant
      const userInputMatch = result.match(/input UserInput \{[^}]+\}/s);
      strictEqual(userInputMatch !== null, true);
      if (userInputMatch) {
        strictEqual(userInputMatch[0].includes("contact: ContactInfoInput!"), true);
      }

      const contactInfoInputMatch = result.match(/input ContactInfoInput \{[^}]+\}/s);
      strictEqual(contactInfoInputMatch !== null, true);
      if (contactInfoInputMatch) {
        strictEqual(contactInfoInputMatch[0].includes("address: AddressInput!"), true);
      }
    });

    it("generates valid empty Query type when no operations defined", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model User {
            id: string;
            name: string;
          }
        }
      `;

      const result = await emitSingleSchema(code, {});

      strictEqual(result.includes("type Query {"), true);
      strictEqual(result.includes("Placeholder field"), true);
      strictEqual(result.includes("_: Boolean"), true);
    });

    it("handles models with all GraphQL field types", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          scalar DateTime;

          enum Role {
            Admin,
            User,
            Guest,
          }

          @Interface
          model Node {
            id: string;
          }

          model Tag {
            name: string;
          }

          union Content {
            text: string,
            number: int32,
          }

          @compose(Node)
          model Article {
            ...Node;
            title: string;
            published: DateTime;
            role: Role;
            tags: Tag[];
            categories: string[];
            viewCount: int32;
            rating?: float32;
            content: Content;
          }

          @query
          op getArticle(id: string): Article;
        }
      `;

      const result = await emitSingleSchema(code, {});

      strictEqual(result.includes("scalar DateTime"), true);
      strictEqual(result.includes("enum Role {"), true);
      strictEqual(result.includes("interface Node {"), true);
      strictEqual(result.includes("union Content"), true);
      strictEqual(result.includes("type Article implements Node {"), true);
      strictEqual(result.includes("title: String!"), true);
      strictEqual(result.includes("published: DateTime!"), true);
      strictEqual(result.includes("role: Role!"), true);
      strictEqual(result.includes("tags: [Tag!]!"), true);
      strictEqual(result.includes("categories: [String!]!"), true);
      strictEqual(result.includes("viewCount: Int!"), true);
      strictEqual(result.includes("rating: Float"), true); // optional
      strictEqual(result.includes("content: Content!"), true);
    });

    it("generates Query with placeholder when only mutations exist", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model User {
            id: string;
            name: string;
          }

          @mutation
          op setUserName(id: string, name: string): User;
        }
      `;

      const result = await emitSingleSchema(code, {});

      // Should have placeholder Query
      strictEqual(result.includes("type Query {"), true);
      strictEqual(result.includes("_: Boolean"), true);

      // Should have Mutation
      strictEqual(result.includes("type Mutation {"), true);
      strictEqual(result.includes("setUserName(id: String!, name: String!): User"), true);
    });
  });

  describe("Design Doc Specific Examples", () => {
    describe("Enums with Numeric Values", () => {
      it("converts floating point enum values to GraphQL enum names", async () => {
        const code = `
          @schema
          namespace TestNamespace {
            /** Enum with Values */
            enum Hour {
              Nothing: 0,
              HalfofHalf: 0.25,
              SweetSpot: 0.5,
              AlmostFull: 0.75,
            }

            model Schedule {
              duration: Hour;
            }

            @query
            op getSchedule(): Schedule;
          }
        `;

        const result = await emitSingleSchema(code, {});

        // Design doc specifies conversion: 0 -> _0, 0.25 -> _0_25, etc.
        strictEqual(result.includes("enum Hour {"), true);
        strictEqual(result.includes("_0"), true);
        strictEqual(result.includes("_0_25"), true);
        strictEqual(result.includes("_0_5"), true);
        strictEqual(result.includes("_0_75"), true);
      });

      it("converts negative enum values to GraphQL enum names", async () => {
        const code = `
          @schema
          namespace TestNamespace {
            enum Boundary {
              zero: 0,
              negOne: -1,
              one: 1,
            }

            model Range {
              boundary: Boundary;
            }

            @query
            op getRange(): Range;
          }
        `;

        const result = await emitSingleSchema(code, {});

        // Design doc specifies: -1 -> _NEGATIVE_1
        strictEqual(result.includes("enum Boundary {"), true);
        strictEqual(result.includes("_0"), true);
        strictEqual(result.includes("_NEGATIVE_1"), true);
        strictEqual(result.includes("_1"), true);
      });
    });

    describe("Unions of Scalars", () => {
      it("wraps scalars in union variants", async () => {
        const code = `
          @schema
          namespace TestNamespace {
            /** Named Union of Scalars */
            union TwoScalars {
              text: string,
              numeric: float32,
            }

            model Data {
              value: TwoScalars;
            }

            @query
            op getData(): Data;
          }
        `;

        const result = await emitSingleSchema(code, {});

        // Design doc shows scalars should be wrapped in variant types
        strictEqual(result.includes("union TwoScalars"), true);
        strictEqual(result.includes("TwoScalarsTextUnionVariant"), true);
        strictEqual(result.includes("TwoScalarsNumericUnionVariant"), true);

        // Variant types should have a value field
        strictEqual(result.includes("type TwoScalarsTextUnionVariant"), true);
        strictEqual(result.includes("value: String!"), true);
        strictEqual(result.includes("type TwoScalarsNumericUnionVariant"), true);
        strictEqual(result.includes("value: Float!"), true);
      });

      it("wraps only scalars in mixed unions", async () => {
        const code = `
          @schema
          namespace TestNamespace {
            model FullAddress {
              street: string;
              city: string;
            }

            model BasicAddress {
              city: string;
            }

            union CompositeAddress {
              oneLineAddress: string,
              fullAddress: FullAddress,
              basicAddress: BasicAddress,
            }

            model Location {
              address: CompositeAddress;
            }

            @query
            op getLocation(): Location;
          }
        `;

        const result = await emitSingleSchema(code, {});

        // Only the scalar should be wrapped
        strictEqual(result.includes("union CompositeAddress"), true);
        strictEqual(result.includes("CompositeAddressOneLineAddressUnionVariant"), true);
        strictEqual(result.includes("FullAddress"), true);
        strictEqual(result.includes("BasicAddress"), true);
      });
    });

    describe("Nested Unions", () => {
      it("flattens nested unions into single union", async () => {
        const code = `
          @schema
          namespace TestNamespace {
            model Bear { name: string; }
            model Lion { name: string; }
            model Cat { name: string; }
            model Dog { name: string; }

            /** Named Union */
            union Animal {
              bear: Bear,
              lion: Lion,
            }

            /** Nested Union */
            union Pet {
              cat: Cat,
              dog: Dog,
              animal: Animal,
            }

            model Owner {
              pet: Pet;
            }

            @query
            op getOwner(): Owner;
          }
        `;

        const result = await emitSingleSchema(code, {});

        // Design doc: nested unions should be flattened
        strictEqual(result.includes("union Pet"), true);
        // Should include all variants flattened
        strictEqual(result.includes("Cat"), true);
        strictEqual(result.includes("Dog"), true);
        strictEqual(result.includes("Bear"), true);
        strictEqual(result.includes("Lion"), true);
      });
    });

    describe("Comprehensive Nullability", () => {
      it("handles all combinations of optional and nullable from design doc table", async () => {
        const code = `
          @schema
          namespace TestNamespace {
            model Foo {
              a: string;
              b?: string;
              c: string | null;
              d?: string | null;
            }

            @query
            op getFoo(): Foo;

            @mutation
            op patchFoo(foo: Foo): Foo;
          }
        `;

        const result = await emitSingleSchema(code, {});

        // Output type field nullability (from design doc table)
        const fooTypeMatch = result.match(/type Foo \{[^}]+\}/s);
        strictEqual(fooTypeMatch !== null, true);
        if (fooTypeMatch) {
          const fooType = fooTypeMatch[0];
          // a: string -> a: String!
          strictEqual(fooType.includes("a: String!"), true);
          // b?: string -> b: String
          strictEqual(fooType.includes("b: String\n") || fooType.includes("b: String "), true);
          // c: string | null -> c: String
          strictEqual(fooType.includes("c: String\n") || fooType.includes("c: String "), true);
          // d?: string | null -> d: String
          strictEqual(fooType.includes("d: String\n") || fooType.includes("d: String "), true);
        }

        // Input type field nullability (design doc: ? does NOT make nullable in input)
        const fooInputMatch = result.match(/input FooInput \{[^}]+\}/s);
        strictEqual(fooInputMatch !== null, true);
        if (fooInputMatch) {
          const fooInput = fooInputMatch[0];
          // a: string -> a: String!
          strictEqual(fooInput.includes("a: String!"), true);
          // b?: string -> b: String! (optional ignored in input context)
          strictEqual(fooInput.includes("b: String!"), true);
          // c: string | null -> c: String (| null makes nullable)
          strictEqual(fooInput.includes("c: String!"), false);
          // d?: string | null -> d: String (| null makes nullable)
          strictEqual(fooInput.includes("d: String!"), false);
        }
      });

      it("handles list nullability variations from design doc", async () => {
        const code = `
          @schema
          namespace TestNamespace {
            model Foo {
              a: string[];
              b: Array<string | null>;
              c?: string[];
              d: string[] | null;
            }

            @query
            op getFoo(): Foo;
          }
        `;

        const result = await emitSingleSchema(code, {});

        const fooTypeMatch = result.match(/type Foo \{[^}]+\}/s);
        strictEqual(fooTypeMatch !== null, true);
        if (fooTypeMatch) {
          const fooType = fooTypeMatch[0];
          // a: string[] -> a: [String!]!
          strictEqual(fooType.includes("a: [String!]!"), true);
          // b: Array<string | null> -> b: [String]!
          strictEqual(fooType.includes("b: [String]!"), true);
          // c?: string[] -> c: [String!]
          strictEqual(fooType.includes("c: [String!]\n") || fooType.includes("c: [String!] "), true);
          // d: string[] | null -> d: [String!]
          strictEqual(fooType.includes("d: [String!]\n") || fooType.includes("d: [String!] "), true);
        }
      });
    });
  });
});
