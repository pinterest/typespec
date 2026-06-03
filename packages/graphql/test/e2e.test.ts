import { describe, expect, it } from "vitest";
import { emitSingleSchema, emitSingleSchemaWithDiagnostics } from "./test-host.js";

/**
 * End-to-end integration tests that compile complete TypeSpec schemas and verify
 * the full GraphQL SDL output. These tests exercise the entire pipeline:
 * TypeSpec parsing → mutation → classification → component rendering → SDL output.
 *
 * For focused tests of individual features, see:
 * - arrays.test.ts
 * - circular-references.test.ts
 * - deprecation.test.ts
 * - doc-comments.test.ts
 * - enums.test.ts
 * - input-output-splitting.test.ts
 * - nullability.test.ts
 * - scalars.test.ts
 * - unions.test.ts
 */
describe("End-to-end", () => {
  it("generates valid schema for basic types", async () => {
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

    const result = await emitSingleSchemaWithDiagnostics(code, {});
    const errors = result.diagnostics.filter((d) => d.severity === "error");

    expect(errors).toHaveLength(0);
    expect(result.graphQLOutput).toMatchInlineSnapshot(`
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

  it("generates a complete API schema with queries, mutations, enums, interfaces, and input/output splitting", async () => {
    const code = `
      @schema
      namespace PetStore {
        /** The species of a pet */
        enum Species {
          Dog,
          Cat,
          Bird,
          Fish,
        }

        /** Shared fields for all entities */
        @Interface
        model Entity {
          id: string;
          createdAt: string;
        }

        /** A pet owner */
        @compose(Entity)
        model Owner {
          ...Entity;
          name: string;
          email: string;
        }

        /** A pet in the store */
        @compose(Entity)
        model Pet {
          ...Entity;
          name: string;
          species: Species;
          /** The pet's age in years */
          age: int32;
          owner: Owner;
          vaccinated: boolean;
          nicknames: string[];
          notes?: string;
        }

        /** Statistics about the store */
        model StoreStats {
          totalPets: int32;
          totalOwners: int32;
        }

        @query
        op getPet(id: string): Pet;

        @query
        op listPets(species?: Species, limit?: int32): Pet[];

        @query
        op getStoreStats(): StoreStats;

        @mutation
        op createPet(pet: Pet): Pet;

        @mutation
        op updatePet(id: string, pet: Pet): Pet;

        @mutation
        op deletePet(id: string): boolean;

        @subscription
        op onPetAdded(): Pet;
      }
    `;

    const result = await emitSingleSchema(code, {});

    expect(result).toMatchInlineSnapshot(`
      """"The species of a pet"""
      enum Species {
        Dog
        Cat
        Bird
        Fish
      }

      """Shared fields for all entities"""
      interface Entity {
        id: String!
        createdAt: String!
      }

      """A pet owner"""
      type Owner implements Entity {
        id: String!
        createdAt: String!
        name: String!
        email: String!
      }

      """A pet in the store"""
      type Pet implements Entity {
        id: String!
        createdAt: String!
        name: String!
        species: Species!

        """The pet's age in years"""
        age: Int!
        owner: Owner!
        vaccinated: Boolean!
        nicknames: [String!]!
        notes: String
      }

      """Statistics about the store"""
      type StoreStats {
        totalPets: Int!
        totalOwners: Int!
      }

      """A pet owner"""
      input OwnerInput {
        id: String!
        createdAt: String!
        name: String!
        email: String!
      }

      """A pet in the store"""
      input PetInput {
        id: String!
        createdAt: String!
        name: String!
        species: Species!

        """The pet's age in years"""
        age: Int!
        owner: OwnerInput!
        vaccinated: Boolean!
        nicknames: [String!]!
        notes: String
      }

      type Query {
        getPet(id: String!): Pet!
        listPets(species: Species, limit: Int): [Pet!]!
        getStoreStats: StoreStats!
      }

      type Mutation {
        createPet(pet: PetInput!): Pet!
        updatePet(id: String!, pet: PetInput!): Pet!
        deletePet(id: String!): Boolean!
      }

      type Subscription {
        onPetAdded: Pet!
      }

      "
    `);
  });

  describe("empty schema diagnostics", () => {
    it("emits empty-schema warning when no query operations defined", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model User {
            id: string;
            name: string;
          }
        }
      `;

      const result = await emitSingleSchemaWithDiagnostics(code, {});
      const warnings = result.diagnostics.filter(
        (d) => d.code === "@typespec/graphql/empty-schema",
      );

      expect(warnings).toHaveLength(1);
      expect(warnings[0].severity).toBe("warning");
      expect(result.graphQLOutput).toBeUndefined();
    });

    it("emits empty-schema warning when only mutations exist (no query)", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model User {
            id: string;
            name: string;
          }

          @mutation
          op setUserName(id: string, name: string): User;
        }
      `;

      const result = await emitSingleSchemaWithDiagnostics(code, {});
      const warnings = result.diagnostics.filter(
        (d) => d.code === "@typespec/graphql/empty-schema",
      );

      expect(warnings).toHaveLength(1);
      expect(result.graphQLOutput).toBeUndefined();
    });
  });

  it("handles all GraphQL field types in a single model", async () => {
    const code = `
      @schema
      namespace TestNamespace {
        scalar DateTime;

        enum Role { Admin, User }

        @Interface
        model Node { id: string; }

        model Tag { name: string; }

        @compose(Node)
        model Article {
          ...Node;
          title: string;
          published: DateTime;
          role: Role;
          tags: Tag[];
          viewCount: int32;
          rating?: float32;
        }

        @query
        op getArticle(id: string): Article;
      }
    `;

    const result = await emitSingleSchema(code, {});

    expect(result).toMatchInlineSnapshot(`
      "scalar DateTime

      enum Role {
        Admin
        User
      }

      interface Node {
        id: String!
      }

      type Tag {
        name: String!
      }

      type Article implements Node {
        id: String!
        title: String!
        published: DateTime!
        role: Role!
        tags: [Tag!]!
        viewCount: Int!
        rating: Float
      }

      type Query {
        getArticle(id: String!): Article!
      }

      "
    `);
  });

  it("generates valid SDL for complex e-commerce schema", async () => {
    const code = `
      @schema
      namespace ECommerce {
        enum OrderStatus { Pending, Shipped, Delivered }

        @Interface
        model Timestamped {
          createdAt: string;
          updatedAt: string;
        }

        @compose(Timestamped)
        model Product {
          ...Timestamped;
          id: string;
          name: string;
          price: float32;
        }

        model OrderItem {
          product: Product;
          quantity: int32;
        }

        @compose(Timestamped)
        model Order {
          ...Timestamped;
          id: string;
          items: OrderItem[];
          status: OrderStatus;
        }

        @query op getProduct(id: string): Product;
        @query op getOrder(id: string): Order;
        @mutation op createOrder(order: Order): Order;
        @subscription op onOrderStatusChanged(orderId: string): Order;
      }
    `;

    const result = await emitSingleSchema(code, {});

    expect(result).toMatchInlineSnapshot(`
      "enum OrderStatus {
        Pending
        Shipped
        Delivered
      }

      interface Timestamped {
        createdAt: String!
        updatedAt: String!
      }

      type Product implements Timestamped {
        createdAt: String!
        updatedAt: String!
        id: String!
        name: String!
        price: Float!
      }

      type OrderItem {
        product: Product!
        quantity: Int!
      }

      type Order implements Timestamped {
        createdAt: String!
        updatedAt: String!
        id: String!
        items: [OrderItem!]!
        status: OrderStatus!
      }

      input ProductInput {
        createdAt: String!
        updatedAt: String!
        id: String!
        name: String!
        price: Float!
      }

      input OrderItemInput {
        product: ProductInput!
        quantity: Int!
      }

      input OrderInput {
        createdAt: String!
        updatedAt: String!
        id: String!
        items: [OrderItemInput!]!
        status: OrderStatus!
      }

      type Query {
        getProduct(id: String!): Product!
        getOrder(id: String!): Order!
      }

      type Mutation {
        createOrder(order: OrderInput!): Order!
      }

      type Subscription {
        onOrderStatusChanged(orderId: String!): Order!
      }

      "
    `);
  });
});
