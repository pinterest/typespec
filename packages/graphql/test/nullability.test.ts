import { strictEqual, ok } from "node:assert";
import { describe, it } from "vitest";
import { emitSingleSchema } from "./test-host.js";

/**
 * Tests for Nullability & Optionality
 *
 * Design doc rule: In input context, `?` (optional) does NOT make a field nullable.
 * Only `| null` makes a field nullable in inputs. In output context, `?` means nullable
 * (existing behavior, unchanged).
 *
 * Design doc table:
 * | TypeSpec           | Output   | Input    |
 * |--------------------|----------|----------|
 * | a: string          | String!  | String!  |
 * | b?: string         | String   | String!  |  <-- key difference
 * | c: string | null   | String   | String   |
 * | d?: string | null  | String   | String   |
 */
describe("Nullability vs. Optionality", () => {
  describe("Output type nullability (unchanged behavior)", () => {
    it("required field is non-null", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model Foo { a: string; }
          @query op get(): Foo;
        }
      `;
      const result = await emitSingleSchema(code, {});
      const fooType = result.match(/type Foo \{[^}]+\}/s)?.[0];
      ok(fooType);
      ok(fooType!.includes("a: String!"), "a: string → String!");
    });

    it("optional field is nullable", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model Foo { b?: string; }
          @query op get(): Foo;
        }
      `;
      const result = await emitSingleSchema(code, {});
      const fooType = result.match(/type Foo \{[^}]+\}/s)?.[0];
      ok(fooType);
      ok(
        fooType!.includes("b: String\n") || fooType!.includes("b: String ") || fooType!.endsWith("b: String}"),
        "b?: string → String (nullable)",
      );
      strictEqual(fooType!.includes("b: String!"), false, "b should NOT be non-null");
    });

    it("nullable union is nullable", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model Foo { c: string | null; }
          @query op get(): Foo;
        }
      `;
      const result = await emitSingleSchema(code, {});
      const fooType = result.match(/type Foo \{[^}]+\}/s)?.[0];
      ok(fooType);
      strictEqual(fooType!.includes("c: String!"), false, "c should be nullable");
    });

    it("optional nullable union is nullable", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model Foo { d?: string | null; }
          @query op get(): Foo;
        }
      `;
      const result = await emitSingleSchema(code, {});
      const fooType = result.match(/type Foo \{[^}]+\}/s)?.[0];
      ok(fooType);
      strictEqual(fooType!.includes("d: String!"), false, "d should be nullable");
    });
  });

  describe("Input type nullability (new behavior)", () => {
    it("required field is non-null in input", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model Foo { a: string; }
          @query op get(): Foo;
          @mutation op set(foo: Foo): Foo;
        }
      `;
      const result = await emitSingleSchema(code, {});
      const fooInput = result.match(/input FooInput \{[^}]+\}/s)?.[0];
      ok(fooInput, "Should have FooInput");
      ok(fooInput!.includes("a: String!"), "a: string → String! in input");
    });

    it("optional field is NON-NULL in input (key design doc rule)", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model Foo { b?: string; }
          @query op get(): Foo;
          @mutation op set(foo: Foo): Foo;
        }
      `;
      const result = await emitSingleSchema(code, {});
      const fooInput = result.match(/input FooInput \{[^}]+\}/s)?.[0];
      ok(fooInput, "Should have FooInput");
      ok(fooInput!.includes("b: String!"), "b?: string → String! in input (optional ignored)");
    });

    it("nullable union is nullable in input", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model Foo { c: string | null; }
          @query op get(): Foo;
          @mutation op set(foo: Foo): Foo;
        }
      `;
      const result = await emitSingleSchema(code, {});
      const fooInput = result.match(/input FooInput \{[^}]+\}/s)?.[0];
      ok(fooInput, "Should have FooInput");
      strictEqual(fooInput!.includes("c: String!"), false, "c: string | null → String (nullable in input)");
    });

    it("optional nullable union is nullable in input", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model Foo { d?: string | null; }
          @query op get(): Foo;
          @mutation op set(foo: Foo): Foo;
        }
      `;
      const result = await emitSingleSchema(code, {});
      const fooInput = result.match(/input FooInput \{[^}]+\}/s)?.[0];
      ok(fooInput, "Should have FooInput");
      strictEqual(fooInput!.includes("d: String!"), false, "d?: string | null → String (nullable in input)");
    });
  });

  describe("Design doc full example", () => {
    it("handles all four nullability combinations in both input and output", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model Foo {
            a: string;
            b?: string;
            c: string | null;
            d?: string | null;
          }
          @query op getFoo(): Foo;
          @mutation op setFoo(foo: Foo): Foo;
        }
      `;
      const result = await emitSingleSchema(code, {});

      // Output type
      const fooType = result.match(/type Foo \{[^}]+\}/s)?.[0];
      ok(fooType, "Should emit Foo output type");
      ok(fooType!.includes("a: String!"), "Output a: String!");
      strictEqual(fooType!.includes("b: String!"), false, "Output b: String (nullable)");
      strictEqual(fooType!.includes("c: String!"), false, "Output c: String (nullable)");
      strictEqual(fooType!.includes("d: String!"), false, "Output d: String (nullable)");

      // Input type
      const fooInput = result.match(/input FooInput \{[^}]+\}/s)?.[0];
      ok(fooInput, "Should emit FooInput");
      ok(fooInput!.includes("a: String!"), "Input a: String!");
      ok(fooInput!.includes("b: String!"), "Input b: String! (optional ignored in input)");
      strictEqual(fooInput!.includes("c: String!"), false, "Input c: String (| null → nullable)");
      strictEqual(fooInput!.includes("d: String!"), false, "Input d: String (| null → nullable)");
    });

    it("handles design doc User model example", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model Pet {
            name: string;
            species: string;
          }

          model User {
            id: int32;
            name: string;
            pronouns?: string;
            birthYear: int32 | null;
            pet: Pet | null;
          }

          @query op getUser(id: int32): User;
          @mutation op createUser(user: User): User;
        }
      `;
      const result = await emitSingleSchema(code, {});

      // Output type: id: Int!, name: String!, pronouns: String, birthYear: Int, pet: Pet
      const userType = result.match(/type User \{[^}]+\}/s)?.[0];
      ok(userType, "Should emit User type");
      ok(userType!.includes("id: Int!"), "Output id: Int!");
      ok(userType!.includes("name: String!"), "Output name: String!");
      strictEqual(userType!.includes("pronouns: String!"), false, "Output pronouns: String (optional)");
      strictEqual(userType!.includes("birthYear: Int!"), false, "Output birthYear: Int (nullable)");
      strictEqual(userType!.includes("pet: Pet!"), false, "Output pet: Pet (nullable)");

      // Input type: id: Int!, name: String!, pronouns: String!, birthYear: Int, pet: PetInput
      const userInput = result.match(/input UserInput \{[^}]+\}/s)?.[0];
      ok(userInput, "Should emit UserInput");
      ok(userInput!.includes("id: Int!"), "Input id: Int!");
      ok(userInput!.includes("name: String!"), "Input name: String!");
      ok(userInput!.includes("pronouns: String!"), "Input pronouns: String! (optional ignored)");
      strictEqual(userInput!.includes("birthYear: Int!"), false, "Input birthYear: Int (| null → nullable)");
      // pet is Pet | null so nullable in input too
      strictEqual(
        userInput!.includes("pet: PetInput!"),
        false,
        "Input pet: PetInput (| null → nullable)",
      );
    });
  });

  describe("Operation parameters", () => {
    it("required params are non-null", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model User { id: string; name: string; }
          @mutation op createUser(user: User): User;
        }
      `;
      const result = await emitSingleSchema(code, {});
      ok(result.includes("createUser(user: UserInput!): User!"), "Required param → non-null");
    });

    it("optional params are NON-NULL in input context", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model User { id: string; name: string; }
          @mutation op patchUser(user?: User): User;
        }
      `;
      const result = await emitSingleSchema(code, {});
      ok(
        result.includes("patchUser(user: UserInput!): User!"),
        "Optional param → non-null in input (? ignored)",
      );
    });

    it("nullable params remain nullable", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model User { id: string; name: string; }
          @mutation op patchUser(user: User | null): User;
        }
      `;
      const result = await emitSingleSchema(code, {});
      const mutationBlock = result.match(/type Mutation \{[^}]+\}/s)?.[0];
      ok(mutationBlock, "Should have Mutation type");
      ok(mutationBlock!.includes("patchUser(user: UserInput)"), "Nullable param → nullable");
      strictEqual(
        mutationBlock!.includes("patchUser(user: UserInput!)"),
        false,
        "Should NOT be non-null",
      );
    });

    it("optional nullable params remain nullable", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model User { id: string; name: string; }
          @mutation op patchUser(user?: User | null): User;
        }
      `;
      const result = await emitSingleSchema(code, {});
      const mutationBlock = result.match(/type Mutation \{[^}]+\}/s)?.[0];
      ok(mutationBlock, "Should have Mutation type");
      strictEqual(
        mutationBlock!.includes("patchUser(user: UserInput!)"),
        false,
        "Optional nullable param → nullable",
      );
    });

    it("optional scalar params are non-null in input context", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model User { id: string; }
          @query op getUser(id: string): User;
          @mutation op updateUser(id: string, email?: string, phone?: string): User;
        }
      `;
      const result = await emitSingleSchema(code, {});
      ok(
        result.includes("updateUser(id: String!, email: String!, phone: String!): User!"),
        "Optional scalar params → non-null in mutation input",
      );
    });

    it("nullable scalar params remain nullable in input context", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model User { id: string; }
          @query op getUser(id: string): User;
          @mutation op updateUser(id: string, email: string | null): User;
        }
      `;
      const result = await emitSingleSchema(code, {});
      const mutationBlock = result.match(/type Mutation \{[^}]+\}/s)?.[0];
      ok(mutationBlock, "Should have Mutation type");
      ok(mutationBlock!.includes("email: String)"), "Nullable scalar param → nullable");
      strictEqual(mutationBlock!.includes("email: String!)"), false, "Should NOT be non-null");
    });
  });

  describe("Array fields in input context", () => {
    it("required array is non-null list in input", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model Foo { tags: string[]; }
          @query op get(): Foo;
          @mutation op set(foo: Foo): Foo;
        }
      `;
      const result = await emitSingleSchema(code, {});
      const fooInput = result.match(/input FooInput \{[^}]+\}/s)?.[0];
      ok(fooInput, "Should have FooInput");
      ok(fooInput!.includes("tags: [String!]!"), "tags: string[] → [String!]! in input");
    });

    it("optional array is still non-null list in input", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model Foo { tags?: string[]; }
          @query op get(): Foo;
          @mutation op set(foo: Foo): Foo;
        }
      `;
      const result = await emitSingleSchema(code, {});

      // Output: optional array → nullable list
      const fooType = result.match(/type Foo \{[^}]+\}/s)?.[0];
      ok(fooType, "Should have Foo type");
      strictEqual(fooType!.includes("tags: [String!]!"), false, "Output: tags?: → [String!] (nullable)");

      // Input: optional array → non-null list (? ignored in input)
      const fooInput = result.match(/input FooInput \{[^}]+\}/s)?.[0];
      ok(fooInput, "Should have FooInput");
      ok(fooInput!.includes("tags: [String!]!"), "Input: tags?: string[] → [String!]! (? ignored)");
    });

    it("nullable array remains nullable in input", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model Foo { tags: string[] | null; }
          @query op get(): Foo;
          @mutation op set(foo: Foo): Foo;
        }
      `;
      const result = await emitSingleSchema(code, {});
      const fooInput = result.match(/input FooInput \{[^}]+\}/s)?.[0];
      ok(fooInput, "Should have FooInput");
      strictEqual(
        fooInput!.includes("tags: [String!]!"),
        false,
        "tags: string[] | null → [String!] (nullable in input)",
      );
    });
  });

  describe("Nested model input references", () => {
    it("nested optional models become non-null in input", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model Address {
            street: string;
            city: string;
          }
          model User {
            name: string;
            address?: Address;
          }
          @query op get(id: string): User;
          @mutation op create(user: User): User;
        }
      `;
      const result = await emitSingleSchema(code, {});

      // Output: address is optional → nullable
      const userType = result.match(/type User \{[^}]+\}/s)?.[0];
      ok(userType, "Should have User type");
      strictEqual(userType!.includes("address: Address!"), false, "Output: address? → Address (nullable)");

      // Input: address is optional but → non-null in input
      const userInput = result.match(/input UserInput \{[^}]+\}/s)?.[0];
      ok(userInput, "Should have UserInput");
      ok(
        userInput!.includes("address: AddressInput!"),
        "Input: address? → AddressInput! (? ignored in input)",
      );
    });

    it("nested nullable models stay nullable in input", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model Address {
            street: string;
            city: string;
          }
          model User {
            name: string;
            address: Address | null;
          }
          @query op get(id: string): User;
          @mutation op create(user: User): User;
        }
      `;
      const result = await emitSingleSchema(code, {});
      const userInput = result.match(/input UserInput \{[^}]+\}/s)?.[0];
      ok(userInput, "Should have UserInput");
      strictEqual(
        userInput!.includes("address: AddressInput!"),
        false,
        "Input: Address | null → AddressInput (nullable)",
      );
    });
  });

  describe("Query parameter nullability", () => {
    it("optional query params are non-null (input context)", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model User { id: string; name: string; }
          @query op listUsers(limit?: int32, offset?: int32): User[];
        }
      `;
      const result = await emitSingleSchema(code, {});
      const queryBlock = result.match(/type Query \{[^}]+\}/s)?.[0];
      ok(queryBlock, "Should have Query type");
      ok(queryBlock!.includes("limit: Int!"), "limit?: int32 → Int! in query input");
      ok(queryBlock!.includes("offset: Int!"), "offset?: int32 → Int! in query input");
    });

    it("nullable query params stay nullable", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model User { id: string; name: string; }
          @query op listUsers(limit: int32 | null): User[];
        }
      `;
      const result = await emitSingleSchema(code, {});
      const queryBlock = result.match(/type Query \{[^}]+\}/s)?.[0];
      ok(queryBlock, "Should have Query type");
      strictEqual(queryBlock!.includes("limit: Int!"), false, "limit: int32 | null → Int (nullable)");
    });
  });
});
