import { strictEqual } from "node:assert";
import { describe, it } from "vitest";
import { emitSingleSchema } from "./test-host.js";

// Expected output with models and enums. Note: field types are placeholders (String) until
// type resolution is fully implemented.
const expectedGraphQLSchema = `enum Genre {
  _Fiction_
  NonFiction
  Mystery
  Fantasy
}

type Book {
  name: String
  page_count: String
  published: String
  price: String
}

type Author {
  name: String
  books: String
}

type Query {
  """
  A placeholder field. If you are seeing this, it means no operations were defined that could be emitted.
  """
  _: Boolean
}`;

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
