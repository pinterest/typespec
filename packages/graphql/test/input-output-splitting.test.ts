import { describe, expect, it } from "vitest";
import { emitSingleSchema } from "./test-host.js";

describe("input/output type splitting", () => {
  it("generates both type and input when model used as both input and output", async () => {
    const code = `
      @schema
      namespace TestNamespace {
        model User {
          id: string;
          name: string;
          email: string;
        }

        @mutation
        op createUser(user: User): User;

        @query
        op getUser(id: string): User;
      }
    `;

    const result = await emitSingleSchema(code, {});

    expect(result).toMatchInlineSnapshot(`
      "type User {
        id: String!
        name: String!
        email: String!
      }

      input UserInput {
        id: String!
        name: String!
        email: String!
      }

      type Query {
        getUser(id: String!): User!
      }

      type Mutation {
        createUser(user: UserInput!): User!
      }

      "
    `);
  });

  it("generates only output type when model used only as output", async () => {
    const code = `
      @schema
      namespace TestNamespace {
        model Book {
          id: string;
          title: string;
        }

        @query
        op getBook(id: string): Book;
      }
    `;

    const result = await emitSingleSchema(code, {});

    expect(result).toMatchInlineSnapshot(`
      "type Book {
        id: String!
        title: String!
      }

      type Query {
        getBook(id: String!): Book!
      }

      "
    `);
  });

  it("generates only input type when model used only as input", async () => {
    const code = `
      @schema
      namespace TestNamespace {
        model CreateBookInput {
          title: string;
          authorId: string;
        }

        @query
        op getBooks(): string[];

        @mutation
        op createBook(input: CreateBookInput): string;
      }
    `;

    const result = await emitSingleSchema(code, {});

    expect(result).toMatchInlineSnapshot(`
      "input CreateBookInput {
        title: String!
        authorId: String!
      }

      type Query {
        getBooks: [String!]!
      }

      type Mutation {
        createBook(input: CreateBookInput!): String!
      }

      "
    `);
  });

  it("handles nested models with input/output splitting", async () => {
    const code = `
      @schema
      namespace TestNamespace {
        model Address {
          street: string;
          city: string;
        }

        model User {
          id: string;
          name: string;
          address: Address;
        }

        @mutation
        op createUser(user: User): User;

        @query
        op getUser(id: string): User;
      }
    `;

    const result = await emitSingleSchema(code, {});

    expect(result).toMatchInlineSnapshot(`
      "type Address {
        street: String!
        city: String!
      }

      type User {
        id: String!
        name: String!
        address: Address!
      }

      input AddressInput {
        street: String!
        city: String!
      }

      input UserInput {
        id: String!
        name: String!
        address: AddressInput!
      }

      type Query {
        getUser(id: String!): User!
      }

      type Mutation {
        createUser(user: UserInput!): User!
      }

      "
    `);
  });

  it("handles arrays with input/output splitting", async () => {
    const code = `
      @schema
      namespace TestNamespace {
        model User {
          id: string;
          name: string;
          friends: User[];
        }

        @mutation
        op createUser(user: User): User;

        @query
        op getUser(id: string): User;
      }
    `;

    const result = await emitSingleSchema(code, {});

    expect(result).toMatchInlineSnapshot(`
      "type User {
        id: String!
        name: String!
        friends: [User!]!
      }

      input UserInput {
        id: String!
        name: String!
        friends: [UserInput!]!
      }

      type Query {
        getUser(id: String!): User!
      }

      type Mutation {
        createUser(user: UserInput!): User!
      }

      "
    `);
  });

  it("handles complex scenario with multiple models and operations", async () => {
    const code = `
      @schema
      namespace TestNamespace {
        model Author {
          id: string;
          name: string;
          bio?: string;
        }

        model Book {
          id: string;
          title: string;
          author: Author;
        }

        model CreateBookInput {
          title: string;
          authorId: string;
        }

        // Author used as both input and output
        @mutation
        op createAuthor(author: Author): Author;

        @query
        op getAuthor(id: string): Author;

        // Book used only as output
        @query
        op getBook(id: string): Book;

        // CreateBookInput used only as input, Book as output
        @mutation
        op createBook(input: CreateBookInput): Book;
      }
    `;

    const result = await emitSingleSchema(code, {});

    expect(result).toMatchInlineSnapshot(`
      "type Author {
        id: String!
        name: String!
        bio: String
      }

      type Book {
        id: String!
        title: String!
        author: Author!
      }

      input AuthorInput {
        id: String!
        name: String!
        bio: String
      }

      input CreateBookInput {
        title: String!
        authorId: String!
      }

      type Query {
        getAuthor(id: String!): Author!
        getBook(id: String!): Book!
      }

      type Mutation {
        createAuthor(author: AuthorInput!): Author!
        createBook(input: CreateBookInput!): Book!
      }

      "
    `);
  });

  it("handles models with optional fields in input/output splitting", async () => {
    const code = `
      @schema
      namespace TestNamespace {
        model User {
          id: string;
          name: string;
          bio?: string;
          age?: int32;
        }

        @query
        op getUser(id: string): User;

        @mutation
        op updateUser(id: string, user: User): User;
      }
    `;

    const result = await emitSingleSchema(code, {});

    expect(result).toMatchInlineSnapshot(`
      "type User {
        id: String!
        name: String!
        bio: String
        age: Int
      }

      input UserInput {
        id: String!
        name: String!
        bio: String
        age: Int
      }

      type Query {
        getUser(id: String!): User!
      }

      type Mutation {
        updateUser(id: String!, user: UserInput!): User!
      }

      "
    `);
  });

  it("handles complex nested input/output splitting with correct variant references", async () => {
    const code = `
      @schema
      namespace TestNamespace {
        model Address {
          street: string;
          city: string;
          country: string;
        }

        model ContactInfo {
          email: string;
          phone?: string;
          address: Address;
        }

        model User {
          id: string;
          name: string;
          contact: ContactInfo;
          friends: User[];
        }

        @mutation
        op createUser(name: string, contact: ContactInfo): User;

        @query
        op getUser(id: string): User;

        @mutation
        op updateUser(id: string, user: User): User;
      }
    `;

    const result = await emitSingleSchema(code, {});

    expect(result).toMatchInlineSnapshot(`
      "type Address {
        street: String!
        city: String!
        country: String!
      }

      type ContactInfo {
        email: String!
        phone: String
        address: Address!
      }

      type User {
        id: String!
        name: String!
        contact: ContactInfo!
        friends: [User!]!
      }

      input AddressInput {
        street: String!
        city: String!
        country: String!
      }

      input ContactInfoInput {
        email: String!
        phone: String
        address: AddressInput!
      }

      input UserInput {
        id: String!
        name: String!
        contact: ContactInfoInput!
        friends: [UserInput!]!
      }

      type Query {
        getUser(id: String!): User!
      }

      type Mutation {
        createUser(name: String!, contact: ContactInfoInput!): User!
        updateUser(id: String!, user: UserInput!): User!
      }

      "
    `);
  });

  it("handles deeply nested models with input/output splitting", async () => {
    const code = `
      @schema
      namespace TestNamespace {
        model Country {
          code: string;
          name: string;
        }

        model City {
          name: string;
          country: Country;
        }

        model Address {
          street: string;
          city: City;
        }

        model User {
          id: string;
          address: Address;
        }

        @query
        op getUser(id: string): User;

        @mutation
        op createUser(user: User): User;
      }
    `;

    const result = await emitSingleSchema(code, {});

    expect(result).toMatchInlineSnapshot(`
      "type Country {
        code: String!
        name: String!
      }

      type City {
        name: String!
        country: Country!
      }

      type Address {
        street: String!
        city: City!
      }

      type User {
        id: String!
        address: Address!
      }

      input CountryInput {
        code: String!
        name: String!
      }

      input CityInput {
        name: String!
        country: CountryInput!
      }

      input AddressInput {
        street: String!
        city: CityInput!
      }

      input UserInput {
        id: String!
        address: AddressInput!
      }

      type Query {
        getUser(id: String!): User!
      }

      type Mutation {
        createUser(user: UserInput!): User!
      }

      "
    `);
  });
});
