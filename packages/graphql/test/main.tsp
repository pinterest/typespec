import "@typespec/graphql";
using GraphQL;

@schema(#{ name: "library-schema" })
namespace MyLibrary {
  model Book {
    id: string;
    title: string;
    publicationDate: string;
    author: Author;
    prequel: Book;
    genre: Genre;
  }

  model Author {
    id: string;
    name: string;
    bio?: string;
    books: Book[];
    friends: Author[];
    publishers: Publisher[];
  }

  model Publisher {
    id: string;
    name: string;
    books: Book[];
    authors: Author[];
  }

  enum Genre {
    Fiction,
    NonFiction,
    Mystery,
    Fantasy,
  }
}
