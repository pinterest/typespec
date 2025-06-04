import { strictEqual } from "node:assert";
import { describe, it } from "vitest";
import { emitSingleSchema } from "./test-host.js";

// For now, the expected output contains a placeholder string and model property types as String for scalar types that are not yet supported by the emitter.
// In the future, this should be replaced with the correct GraphQL schema output.
const expectedGraphQLSchema = `type Author {
  name: String
  book: Book
  coauthor: Author
}

type Book {
  name: String
  page_count: Int
  published: Boolean
  price: Float
  author: Author
}

type Query {
  """
  A placeholder field. If you are seeing this, it means no operations were defined that could be emitted.
  """
  _: Boolean
}`;

describe("name", () => {
  it("Emits a schema.graphql file with placeholder text", async () => {
    const code = `
      @schema
      namespace TestNamespace {
        model Book {
          name: string;
          page_count: int32;
          published: boolean;
          price: float64;
          author: Author;
        }
        model Author {
          name: string;
          book: Book;
          coauthor: Author;
        }
        op getBooks(): Book[];
        op getAuthors(): Author[];
      }
    `;
    const results = await emitSingleSchema(code, {});
    strictEqual(results, expectedGraphQLSchema);
  });
});
