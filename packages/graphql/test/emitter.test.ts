import { strictEqual } from "node:assert";
import { describe, it } from "vitest";
import { emitSingleSchema } from "./test-host.js";

// For now, the expected output is a placeholder string.
// In the future, this should be replaced with the actual GraphQL schema output.
const expectedGraphQLSchema = `type Book {
  name: String
  page_count: Int
  published: Boolean
  price: Float
}

type Author {
  name: String
  books: [Book]
}

input BookInput {
  name: String
  page_count: Int
  published: Boolean
  price: Float
}

input AuthorInput {
  name: String
  books: [BookInput]
}

type Query {
  Books: [Book]
  Authors: [Author]
  CreateBook(book: BookInput): Book
  CreateAuthor(author: AuthorInput): Author
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
        }
        model Author {
          name: string;
          books: Book[];
        }
        op Books(): Book[];
        op Authors(): Author[];
        op CreateBook(book: Book): Book;
        op CreateAuthor(author: Author): Author;
      }
    `;
    const results = await emitSingleSchema(code, {});
    strictEqual(results, expectedGraphQLSchema);
  });
});
