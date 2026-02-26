import { strictEqual } from "node:assert";
import { describe, it } from "vitest";
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

    // Should have both type User and input UserInput
    strictEqual(result.includes("type User {"), true, "Should generate output type User");
    strictEqual(result.includes("input UserInput {"), true, "Should generate input type UserInput");

    // Mutation should use UserInput for parameter
    strictEqual(result.includes("createUser(user: UserInput!): User"), true, "Should use UserInput in mutation parameter");

    // Query should use User for return type
    strictEqual(result.includes("getUser(id: String!): User"), true, "Should use User in query return type");
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

    // Should only have type Book, not input BookInput
    strictEqual(result.includes("type Book {"), true, "Should generate output type Book");
    strictEqual(result.includes("input BookInput {"), false, "Should NOT generate input type BookInput");
  });

  it("generates only input type when model used only as input", async () => {
    const code = `
      @schema
      namespace TestNamespace {
        model CreateBookInput {
          title: string;
          authorId: string;
        }

        @mutation
        op createBook(input: CreateBookInput): string;
      }
    `;

    const result = await emitSingleSchema(code, {});

    // Should only have input CreateBookInput, not type CreateBookInput
    strictEqual(result.includes("input CreateBookInput {"), true, "Should generate input type CreateBookInput");
    strictEqual(result.includes("type CreateBookInput {"), false, "Should NOT generate output type CreateBookInput");
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

    // Both User and Address should have input and output variants
    strictEqual(result.includes("type User {"), true, "Should generate output type User");
    strictEqual(result.includes("input UserInput {"), true, "Should generate input type UserInput");
    strictEqual(result.includes("type Address {"), true, "Should generate output type Address");
    strictEqual(result.includes("input AddressInput {"), true, "Should generate input type AddressInput");

    // UserInput should reference AddressInput (not Address)
    const userInputMatch = result.match(/input UserInput \{[^}]+\}/s);
    strictEqual(userInputMatch !== null, true, "Should find UserInput definition");
    if (userInputMatch) {
      strictEqual(userInputMatch[0].includes("address: AddressInput!"), true, "UserInput should reference AddressInput");
    }
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

    // Should have both types
    strictEqual(result.includes("type User {"), true, "Should generate output type User");
    strictEqual(result.includes("input UserInput {"), true, "Should generate input type UserInput");

    // Output type should have friends: [User!]!
    const userTypeMatch = result.match(/type User \{[^}]+\}/s);
    strictEqual(userTypeMatch !== null, true, "Should find User type definition");
    if (userTypeMatch) {
      strictEqual(userTypeMatch[0].includes("friends: [User!]!"), true, "User type should reference User array");
    }

    // Input type should have friends: [UserInput!]!
    const userInputMatch = result.match(/input UserInput \{[^}]+\}/s);
    strictEqual(userInputMatch !== null, true, "Should find UserInput definition");
    if (userInputMatch) {
      strictEqual(userInputMatch[0].includes("friends: [UserInput!]!"), true, "UserInput should reference UserInput array");
    }
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

    // Author: should have both type and input (used as both)
    strictEqual(result.includes("type Author {"), true, "Should generate output type Author");
    strictEqual(result.includes("input AuthorInput {"), true, "Should generate input type AuthorInput");

    // Book: should have only type (used only as output)
    strictEqual(result.includes("type Book {"), true, "Should generate output type Book");
    strictEqual(result.includes("input BookInput {"), false, "Should NOT generate input type BookInput");

    // CreateBookInput: should have only input (used only as input)
    strictEqual(result.includes("input CreateBookInput {"), true, "Should generate input type CreateBookInput");
    strictEqual(result.includes("type CreateBookInput {"), false, "Should NOT generate output type CreateBookInput");

    // Book should reference Author (not AuthorInput) in output context
    const bookTypeMatch = result.match(/type Book \{[^}]+\}/s);
    strictEqual(bookTypeMatch !== null, true, "Should find Book type definition");
    if (bookTypeMatch) {
      strictEqual(bookTypeMatch[0].includes("author: Author!"), true, "Book type should reference Author");
    }

    // Operations should use correct variants
    strictEqual(result.includes("createAuthor(author: AuthorInput!): Author"), true, "createAuthor should use AuthorInput for parameter");
    strictEqual(result.includes("createBook(input: CreateBookInput!): Book"), true, "createBook should use CreateBookInput");
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

        @mutation
        op updateUser(id: string, user: User): User;
      }
    `;

    const result = await emitSingleSchema(code, {});

    // Both types should exist
    strictEqual(result.includes("type User {"), true, "Should generate output type User");
    strictEqual(result.includes("input UserInput {"), true, "Should generate input type UserInput");

    // Both should have optional fields rendered correctly (without !)
    const userTypeMatch = result.match(/type User \{[^}]+\}/s);
    if (userTypeMatch) {
      strictEqual(userTypeMatch[0].includes("bio: String"), true, "User type should have optional bio");
      strictEqual(userTypeMatch[0].includes("age: Int"), true, "User type should have optional age");
      strictEqual(userTypeMatch[0].includes("bio: String!"), false, "User type bio should not be required");
    }

    const userInputMatch = result.match(/input UserInput \{[^}]+\}/s);
    if (userInputMatch) {
      // In input context, optional (?) does NOT make fields nullable — only | null does
      strictEqual(userInputMatch[0].includes("bio: String!"), true, "UserInput bio should be required (? ignored in input)");
      strictEqual(userInputMatch[0].includes("age: Int!"), true, "UserInput age should be required (? ignored in input)");
    }
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

    // All models used as both input and output should have both variants
    strictEqual(result.includes("type User {"), true);
    strictEqual(result.includes("input UserInput {"), true);
    strictEqual(result.includes("type ContactInfo {"), true);
    strictEqual(result.includes("input ContactInfoInput {"), true);
    strictEqual(result.includes("type Address {"), true);
    strictEqual(result.includes("input AddressInput {"), true);

    // Check correct usage in operations
    strictEqual(result.includes("createUser(name: String!, contact: ContactInfoInput!): User"), true);
    strictEqual(result.includes("updateUser(id: String!, user: UserInput!): User"), true);

    // Check nested references use correct variant
    const userInputMatch = result.match(/input UserInput \{[^}]+\}/s);
    strictEqual(userInputMatch !== null, true);
    if (userInputMatch) {
      strictEqual(userInputMatch[0].includes("contact: ContactInfoInput!"), true);
    }

    const contactInfoInputMatch = result.match(/input ContactInfoInput \{[^}]+\}/s);
    strictEqual(contactInfoInputMatch !== null, true);
    if (contactInfoInputMatch) {
      strictEqual(contactInfoInputMatch[0].includes("address: AddressInput!"), true);
    }
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

        @mutation
        op createUser(user: User): User;
      }
    `;

    const result = await emitSingleSchema(code, {});

    // All models should have both type and input variants
    strictEqual(result.includes("type User {"), true);
    strictEqual(result.includes("input UserInput {"), true);
    strictEqual(result.includes("type Address {"), true);
    strictEqual(result.includes("input AddressInput {"), true);
    strictEqual(result.includes("type City {"), true);
    strictEqual(result.includes("input CityInput {"), true);
    strictEqual(result.includes("type Country {"), true);
    strictEqual(result.includes("input CountryInput {"), true);

    // Verify correct references in input context
    const userInputMatch = result.match(/input UserInput \{[^}]+\}/s);
    if (userInputMatch) {
      strictEqual(userInputMatch[0].includes("address: AddressInput!"), true, "UserInput should reference AddressInput");
    }

    const addressInputMatch = result.match(/input AddressInput \{[^}]+\}/s);
    if (addressInputMatch) {
      strictEqual(addressInputMatch[0].includes("city: CityInput!"), true, "AddressInput should reference CityInput");
    }

    const cityInputMatch = result.match(/input CityInput \{[^}]+\}/s);
    if (cityInputMatch) {
      strictEqual(cityInputMatch[0].includes("country: CountryInput!"), true, "CityInput should reference CountryInput");
    }
  });
});
