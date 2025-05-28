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
    book: Book;
    friend: Author;
    publisher: Publisher;
  }

  model Publisher {
    id: string;
    name: string;
    book: Book;
    author: Author;
  }

  enum Genre {
    Fiction,
    NonFiction,
    Mystery,
    Fantasy,
  }
}
