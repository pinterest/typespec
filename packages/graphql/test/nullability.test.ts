import { describe, expect, it } from "vitest";
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
      expect(result).toMatchInlineSnapshot(`
        "type Foo {
          a: String!
        }

        type Query {
          get: Foo!
        }

        "
      `);
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
      expect(result).toMatchInlineSnapshot(`
        "type Foo {
          b: String
        }

        type Query {
          get: Foo!
        }

        "
      `);
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
      expect(result).toMatchInlineSnapshot(`
        "type Foo {
          c: String
        }

        type Query {
          get: Foo!
        }

        "
      `);
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
      expect(result).toMatchInlineSnapshot(`
        "type Foo {
          d: String
        }

        type Query {
          get: Foo!
        }

        "
      `);
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
      expect(result).toMatchInlineSnapshot(`
        "type Foo {
          a: String!
        }

        input FooInput {
          a: String!
        }

        type Query {
          get: Foo!
        }

        type Mutation {
          set(foo: FooInput!): Foo!
        }

        "
      `);
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
      expect(result).toMatchInlineSnapshot(`
        "type Foo {
          b: String
        }

        input FooInput {
          b: String!
        }

        type Query {
          get: Foo!
        }

        type Mutation {
          set(foo: FooInput!): Foo!
        }

        "
      `);
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
      expect(result).toMatchInlineSnapshot(`
        "type Foo {
          c: String
        }

        input FooInput {
          c: String
        }

        type Query {
          get: Foo!
        }

        type Mutation {
          set(foo: FooInput!): Foo!
        }

        "
      `);
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
      expect(result).toMatchInlineSnapshot(`
        "type Foo {
          d: String
        }

        input FooInput {
          d: String
        }

        type Query {
          get: Foo!
        }

        type Mutation {
          set(foo: FooInput!): Foo!
        }

        "
      `);
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
      expect(result).toMatchInlineSnapshot(`
        "type Foo {
          a: String!
          b: String
          c: String
          d: String
        }

        input FooInput {
          a: String!
          b: String!
          c: String
          d: String
        }

        type Query {
          getFoo: Foo!
        }

        type Mutation {
          setFoo(foo: FooInput!): Foo!
        }

        "
      `);
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
      expect(result).toMatchInlineSnapshot(`
        "type Pet {
          name: String!
          species: String!
        }

        type User {
          id: Int!
          name: String!
          pronouns: String
          birthYear: Int
          pet: Pet
        }

        input PetInput {
          name: String!
          species: String!
        }

        input UserInput {
          id: Int!
          name: String!
          pronouns: String!
          birthYear: Int
          pet: PetInput
        }

        type Query {
          getUser(id: Int!): User!
        }

        type Mutation {
          createUser(user: UserInput!): User!
        }

        "
      `);
    });
  });

  describe("Operation parameters", () => {
    it("required params are non-null", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model User { id: string; name: string; }
          @query op getUser(id: string): User;
          @mutation op createUser(user: User): User;
        }
      `;
      const result = await emitSingleSchema(code, {});
      expect(result).toMatchInlineSnapshot(`
        "type User {
          id: String!
          name: String!
        }

        input UserInput {
          id: String!
          name: String!
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

    it("optional params are NON-NULL in input context", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model User { id: string; name: string; }
          @query op getUser(id: string): User;
          @mutation op patchUser(user?: User): User;
        }
      `;
      const result = await emitSingleSchema(code, {});
      expect(result).toMatchInlineSnapshot(`
        "type User {
          id: String!
          name: String!
        }

        input UserInput {
          id: String!
          name: String!
        }

        type Query {
          getUser(id: String!): User!
        }

        type Mutation {
          patchUser(user: UserInput!): User!
        }

        "
      `);
    });

    it("nullable params remain nullable", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model User { id: string; name: string; }
          @query op getUser(id: string): User;
          @mutation op patchUser(user: User | null): User;
        }
      `;
      const result = await emitSingleSchema(code, {});
      expect(result).toMatchInlineSnapshot(`
        "type User {
          id: String!
          name: String!
        }

        input UserInput {
          id: String!
          name: String!
        }

        type Query {
          getUser(id: String!): User!
        }

        type Mutation {
          patchUser(user: UserInput): User!
        }

        "
      `);
    });

    it("optional nullable params remain nullable", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model User { id: string; name: string; }
          @query op getUser(id: string): User;
          @mutation op patchUser(user?: User | null): User;
        }
      `;
      const result = await emitSingleSchema(code, {});
      expect(result).toMatchInlineSnapshot(`
        "type User {
          id: String!
          name: String!
        }

        input UserInput {
          id: String!
          name: String!
        }

        type Query {
          getUser(id: String!): User!
        }

        type Mutation {
          patchUser(user: UserInput): User!
        }

        "
      `);
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
      expect(result).toMatchInlineSnapshot(`
        "type User {
          id: String!
        }

        type Query {
          getUser(id: String!): User!
        }

        type Mutation {
          updateUser(id: String!, email: String!, phone: String!): User!
        }

        "
      `);
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
      expect(result).toMatchInlineSnapshot(`
        "type User {
          id: String!
        }

        type Query {
          getUser(id: String!): User!
        }

        type Mutation {
          updateUser(id: String!, email: String): User!
        }

        "
      `);
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
      expect(result).toMatchInlineSnapshot(`
        "type Foo {
          tags: [String!]!
        }

        input FooInput {
          tags: [String!]!
        }

        type Query {
          get: Foo!
        }

        type Mutation {
          set(foo: FooInput!): Foo!
        }

        "
      `);
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
      expect(result).toMatchInlineSnapshot(`
        "type Foo {
          tags: [String!]
        }

        input FooInput {
          tags: [String!]!
        }

        type Query {
          get: Foo!
        }

        type Mutation {
          set(foo: FooInput!): Foo!
        }

        "
      `);
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
      expect(result).toMatchInlineSnapshot(`
        "type Foo {
          tags: [String!]
        }

        input FooInput {
          tags: [String!]
        }

        type Query {
          get: Foo!
        }

        type Mutation {
          set(foo: FooInput!): Foo!
        }

        "
      `);
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
      expect(result).toMatchInlineSnapshot(`
        "type Address {
          street: String!
          city: String!
        }

        type User {
          name: String!
          address: Address
        }

        input AddressInput {
          street: String!
          city: String!
        }

        input UserInput {
          name: String!
          address: AddressInput!
        }

        type Query {
          get(id: String!): User!
        }

        type Mutation {
          create(user: UserInput!): User!
        }

        "
      `);
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
      expect(result).toMatchInlineSnapshot(`
        "type Address {
          street: String!
          city: String!
        }

        type User {
          name: String!
          address: Address
        }

        input AddressInput {
          street: String!
          city: String!
        }

        input UserInput {
          name: String!
          address: AddressInput
        }

        type Query {
          get(id: String!): User!
        }

        type Mutation {
          create(user: UserInput!): User!
        }

        "
      `);
    });
  });

  describe("Output field nullability", () => {
    it("marks optional fields as nullable", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model User {
            id: string;
            nickname?: string;
          }

          @query
          op getUser(): User;
        }
      `;

      const result = await emitSingleSchema(code, {});
      expect(result).toMatchInlineSnapshot(`
        "type User {
          id: String!
          nickname: String
        }

        type Query {
          getUser: User!
        }

        "
      `);
    });

    it("marks T | null union fields as nullable", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model User {
            id: string;
            bio: string | null;
          }

          @query
          op getUser(): User;
        }
      `;

      const result = await emitSingleSchema(code, {});
      expect(result).toMatchInlineSnapshot(`
        "type User {
          id: String!
          bio: String
        }

        type Query {
          getUser: User!
        }

        "
      `);
    });

    it("handles optional properties correctly in both output and input", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model User {
            id: string;
            name: string;
            email?: string;
            phoneNumber?: string;
          }

          @query
          op getUser(id: string): User;

          @mutation
          op updateUser(id: string, email?: string, phoneNumber?: string): User;
        }
      `;

      const result = await emitSingleSchema(code, {});
      expect(result).toMatchInlineSnapshot(`
        "type User {
          id: String!
          name: String!
          email: String
          phoneNumber: String
        }

        type Query {
          getUser(id: String!): User!
        }

        type Mutation {
          updateUser(id: String!, email: String!, phoneNumber: String!): User!
        }

        "
      `);
    });
  });

  describe("Comprehensive nullability combinations", () => {
    it("handles all combinations of optional and nullable from design doc table", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model Foo {
            a: string;
            b?: string;
            c: string | null;
            d?: string | null;
          }

          @query
          op getFoo(): Foo;

          @mutation
          op patchFoo(foo: Foo): Foo;
        }
      `;

      const result = await emitSingleSchema(code, {});
      expect(result).toMatchInlineSnapshot(`
        "type Foo {
          a: String!
          b: String
          c: String
          d: String
        }

        input FooInput {
          a: String!
          b: String!
          c: String
          d: String
        }

        type Query {
          getFoo: Foo!
        }

        type Mutation {
          patchFoo(foo: FooInput!): Foo!
        }

        "
      `);
    });

    it("handles list nullability variations", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model Foo {
            a: string[];
            b: Array<string | null>;
            c?: string[];
            d: string[] | null;
          }

          @query
          op getFoo(): Foo;
        }
      `;

      const result = await emitSingleSchema(code, {});
      expect(result).toMatchInlineSnapshot(`
        "type Foo {
          a: [String!]!
          b: [String]!
          c: [String!]
          d: [String!]
        }

        type Query {
          getFoo: Foo!
        }

        "
      `);
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
      expect(result).toMatchInlineSnapshot(`
        "type User {
          id: String!
          name: String!
        }

        type Query {
          listUsers(limit: Int!, offset: Int!): [User!]!
        }

        "
      `);
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
      expect(result).toMatchInlineSnapshot(`
        "type User {
          id: String!
          name: String!
        }

        type Query {
          listUsers(limit: Int): [User!]!
        }

        "
      `);
    });
  });
});
