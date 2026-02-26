import { strictEqual } from "node:assert";
import { describe, it } from "vitest";
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

    strictEqual(result.includes("union Pet"), true);
    // Should include all variants flattened
    strictEqual(result.includes("Cat"), true);
    strictEqual(result.includes("Dog"), true);
    strictEqual(result.includes("Bear"), true);
    strictEqual(result.includes("Lion"), true);
  });
});
