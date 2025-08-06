import "@typespec/graphql";
using GraphQL;

@schema(#{name: "library-schema"})
namespace MyLibrary {
  model Book {
    id: string;
    title: string;
    publicationDate: string;
    author: Author;
    price: float32;
  }

  model Author {
    id: string;
    name: string;
    bio?: string;
    books: Book[];
    friend: Author;
    age: int32;
  }
  
  enum Genre {
    Fiction,
    NonFiction,
    Mystery,
    Fantasy
  }
}