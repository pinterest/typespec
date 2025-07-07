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
    friend: Author;
    age: int32;
  }

  model CreateBook {
    title: string;
    authorId: string;
    price: float32;
    genre: Genre;
  }

  model UpdateAuthor {
    name?: string;
    bio?: string;
    age?: int32;
  }

  enum Genre {
    Fiction,
    NonFiction,
    Mystery,
    Fantasy,
  }

  op Books(): Book[];
  op Authors(): Author[];
  op createBook(request: CreateBook): Book;
  op updateAuthor(id: string, request: UpdateAuthor): Author;
}
