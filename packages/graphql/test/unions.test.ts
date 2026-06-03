import { describe, expect, it } from "vitest";
import { emitSingleSchema } from "./test-host.js";

describe("unions", () => {
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

    expect(result).toMatchInlineSnapshot(`
      """"Content can be text, image, or video"""
      union Content = TextContent | ImageContent | VideoContent

      type TextContent {
        text: String!
      }

      type ImageContent {
        url: String!
        alt: String!
      }

      type VideoContent {
        url: String!
        duration: Int!
      }

      type Post {
        id: String!
        content: Content!
      }

      type Query {
        getPost(id: String!): Post!
      }

      "
    `);
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

    expect(result).toMatchInlineSnapshot(`
      "union FindUserUnion = User | Error

      type User {
        id: String!
        name: String!
      }

      type Error {
        message: String!
      }

      type Query {
        findUser(id: String!): FindUserUnion!
      }

      "
    `);
  });

  describe("scalar wrapping", () => {
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

      expect(result).toMatchInlineSnapshot(`
        """"Named Union of Scalars"""
        union TwoScalars = TwoScalarsTextUnionVariant | TwoScalarsNumericUnionVariant

        type Data {
          value: TwoScalars!
        }

        type TwoScalarsTextUnionVariant {
          value: String!
        }

        type TwoScalarsNumericUnionVariant {
          value: Float!
        }

        type Query {
          getData: Data!
        }

        "
      `);
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

      expect(result).toMatchInlineSnapshot(`
        "union CompositeAddress = CompositeAddressOneLineAddressUnionVariant | FullAddress | BasicAddress

        type FullAddress {
          street: String!
          city: String!
        }

        type BasicAddress {
          city: String!
        }

        type Location {
          address: CompositeAddress!
        }

        type CompositeAddressOneLineAddressUnionVariant {
          value: String!
        }

        type Query {
          getLocation: Location!
        }

        "
      `);
    });
  });

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

    expect(result).toMatchInlineSnapshot(`
      "union Pet = Cat | Dog | Bear | Lion

      """Named Union"""
      union Animal = Bear | Lion

      type Bear {
        name: String!
      }

      type Lion {
        name: String!
      }

      type Cat {
        name: String!
      }

      type Dog {
        name: String!
      }

      type Owner {
        pet: Pet!
      }

      type Query {
        getOwner: Owner!
      }

      "
    `);
  });
});
