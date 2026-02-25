import { strictEqual } from "node:assert";
import { describe, it } from "vitest";
import { emitSingleSchema } from "./test-host.js";

// Expected output with proper type resolution, arrays, and nullability
const expectedGraphQLSchema = `enum Genre {
  _Fiction_
  NonFiction
  Mystery
  Fantasy
}

type Book {
  name: String!
  page_count: Int!
  published: Boolean!
  price: Float!
}

type Author {
  name: String!
  books: [Book!]!
}

type Query {
  """
  Placeholder field. No query operations were defined in the TypeSpec schema.
  """
  _: Boolean
}

`;

describe("emitter", () => {
  it("emits models and enums with mutations applied", async () => {
    const code = `
      @schema
      namespace TestNamespace {
        model Book {
          name: string;
          page_count: int32;
          published: boolean;
          price: float64;
        }
        model Author {
          name: string;
          books: Book[];
        }
        enum Genre {
          $Fiction$,
          NonFiction,
          Mystery,
          Fantasy,
        }
        op getBooks(): Book[];
        op getAuthors(): Author[];
      }
    `;
    const results = await emitSingleSchema(code, {});
    strictEqual(results, expectedGraphQLSchema);
  });
});
