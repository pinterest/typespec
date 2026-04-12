import { emitSingleSchema } from './test-host.js';

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
      \`$Fiction$\`,
      NonFiction,
      Mystery,
      Fantasy,
    }
    op getBooks(): Book[];
    op getAuthors(): Author[];
  }
`;

const result = await emitSingleSchema(code, {});
console.log('=== GraphQL Schema Output ===');
console.log(result);
