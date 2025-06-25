import "@typespec/graphql";
using GraphQL;

@schema(#{ name: "library-schema" })
namespace MyLibrary {
  model Book {
    id: string;
    title: string;
    publicationDate: string;
    author: Author;
    price: float32;
    genre: Genre;
  }

  model Author {
    id: string;
    name: string;
    bio?: string;
    books: Book[];
    booksGeneric: Array<Book>; // Explicit generic array
    friend: Author;
    age: int32;
  }

  enum Genre {
    Fiction,
    NonFiction,
    Mystery,
    Fantasy,
  }

  op Books(): Book[];
  op BooksGeneric(): Array<Book>; // Explicit generic array
  op Authors(): Author[];
  op SetAuthor(author: Author): void;
}
