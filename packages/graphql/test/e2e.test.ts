import { strictEqual, ok } from "node:assert";
import { describe, it } from "vitest";
import { emitSingleSchema } from "./test-host.js";

/**
 * End-to-end tests that compile complete TypeSpec schemas and verify
 * the full GraphQL SDL output. These tests exercise the entire pipeline:
 * TypeSpec parsing → mutation → classification → component rendering → SDL output.
 */
describe("End-to-end", () => {
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

    // --- Enum ---
    ok(result.includes("enum Species {"), "Should emit Species enum");
    ok(result.includes("Dog"), "Should emit enum member Dog");
    ok(result.includes("Cat"), "Should emit enum member Cat");
    ok(result.includes("Bird"), "Should emit enum member Bird");
    ok(result.includes("Fish"), "Should emit enum member Fish");

    // --- Interface ---
    ok(result.includes("interface Entity {"), "Should emit Entity as a GraphQL interface");
    ok(result.includes("id: String!"), "Interface should have id field");
    ok(result.includes("createdAt: String!"), "Interface should have createdAt field");

    // --- Output types with implements ---
    ok(result.includes("type Pet implements Entity {"), "Pet should implement Entity interface");
    ok(result.includes("type Owner implements Entity {"), "Owner should implement Entity interface");
    ok(result.includes("type StoreStats {"), "Should emit StoreStats output type");

    // --- Input types (Pet and Owner are used as both input and output) ---
    ok(result.includes("input PetInput {"), "Should emit PetInput for mutation parameters");
    ok(result.includes("input OwnerInput {"), "Should emit OwnerInput (nested in PetInput)");

    // --- StoreStats should NOT have an input variant (only used as output) ---
    strictEqual(result.includes("input StoreStatsInput"), false, "StoreStats should not have input variant");

    // --- Field types in Pet output ---
    const petTypeBlock = result.match(/type Pet implements Entity \{[^}]+\}/s)?.[0];
    ok(petTypeBlock, "Should find Pet type block");
    if (petTypeBlock) {
      ok(petTypeBlock.includes("name: String!"), "Pet.name should be non-null String");
      ok(petTypeBlock.includes("species: Species!"), "Pet.species should reference Species enum");
      ok(petTypeBlock.includes("age: Int!"), "Pet.age (int32) should map to Int");
      ok(petTypeBlock.includes("owner: Owner!"), "Pet.owner should reference Owner type");
      ok(petTypeBlock.includes("vaccinated: Boolean!"), "Pet.vaccinated should be non-null Boolean");
      ok(petTypeBlock.includes("nicknames: [String!]!"), "Pet.nicknames (string[]) should be non-null list of non-null String");
      ok(petTypeBlock.includes("notes: String"), "Pet.notes (optional) should be nullable String");
      // notes should NOT have ! since it's optional
      strictEqual(petTypeBlock.includes("notes: String!"), false, "Pet.notes should be nullable (no !)");
    }

    // --- Field types in PetInput ---
    const petInputBlock = result.match(/input PetInput \{[^}]+\}/s)?.[0];
    ok(petInputBlock, "Should find PetInput block");
    if (petInputBlock) {
      ok(petInputBlock.includes("owner: OwnerInput!"), "PetInput.owner should reference OwnerInput");
      ok(petInputBlock.includes("species: Species!"), "PetInput.species should reference same Species enum");
    }

    // --- Query type ---
    ok(result.includes("type Query {"), "Should emit Query type");
    ok(result.includes("getPet(id: String!): Pet!"), "Should emit getPet query");
    ok(result.includes("listPets("), "Should emit listPets query");
    ok(result.includes("getStoreStats: StoreStats!"), "Should emit getStoreStats query");

    // listPets parameters — optional params are non-null in input context
    const queryBlock = result.match(/type Query \{[^}]+\}/s)?.[0];
    ok(queryBlock, "Should find Query block");
    if (queryBlock) {
      ok(queryBlock.includes("species: Species!"), "listPets species param should be non-null (? ignored in input)");
      ok(queryBlock.includes("limit: Int!"), "listPets limit param should be non-null (? ignored in input)");
      ok(queryBlock.includes("[Pet!]!"), "listPets should return non-null list of non-null Pet");
    }

    // --- Mutation type ---
    ok(result.includes("type Mutation {"), "Should emit Mutation type");
    ok(result.includes("createPet(pet: PetInput!): Pet!"), "createPet should take PetInput and return Pet");
    ok(result.includes("deletePet(id: String!): Boolean!"), "deletePet should take String and return Boolean");

    // --- Subscription type ---
    ok(result.includes("type Subscription {"), "Should emit Subscription type");
    ok(result.includes("onPetAdded: Pet!"), "onPetAdded should return Pet");

    // --- Descriptions (doc comments) ---
    ok(result.includes("The species of a pet"), "Should propagate enum description");
    ok(result.includes("A pet in the store"), "Should propagate model description");
    ok(result.includes("The pet's age in years"), "Should propagate field description");
  });

  it("generates schema with nullable unions, custom scalars, and encoded types", async () => {
    const code = `
      @schema
      namespace Analytics {
        /** A custom date-time scalar */
        scalar DateTime;

        model Event {
          id: string;
          timestamp: DateTime;
          payload: string | null;
          tags: string[];
        }

        @query
        op getEvent(id: string): Event;

        @query
        op getEvents(from?: DateTime, limit?: int32): Event[];
      }
    `;

    const result = await emitSingleSchema(code, {});

    // Custom scalar
    ok(result.includes("scalar DateTime"), "Should emit custom DateTime scalar");

    // Nullable union (string | null) should produce nullable field
    const eventBlock = result.match(/type Event \{[^}]+\}/s)?.[0];
    ok(eventBlock, "Should find Event type block");
    if (eventBlock) {
      ok(eventBlock.includes("timestamp: DateTime!"), "timestamp should be non-null DateTime");
      // payload is string | null, so it should be nullable
      ok(eventBlock.includes("payload: String"), "payload should be nullable String");
      strictEqual(eventBlock.includes("payload: String!"), false, "payload should NOT be non-null");
      ok(eventBlock.includes("tags: [String!]!"), "tags should be non-null list of non-null String");
    }

    // Query parameters
    ok(result.includes("getEvents("), "Should emit getEvents query");
    const queryBlock = result.match(/type Query \{[^}]+\}/s)?.[0];
    if (queryBlock) {
      ok(queryBlock.includes("from: DateTime!"), "from param should be non-null DateTime (? ignored in input)");
    }
  });

  it("generates schema with named unions as GraphQL union types", async () => {
    const code = `
      @schema
      namespace Search {
        model User {
          id: string;
          name: string;
        }

        model Post {
          id: string;
          title: string;
          author: User;
        }

        union SearchResult {
          user: User,
          post: Post,
        }

        @query
        op search(query: string): SearchResult[];
      }
    `;

    const result = await emitSingleSchema(code, {});

    ok(result.includes("union SearchResult ="), "Should emit SearchResult as GraphQL union");
    ok(result.includes("User"), "SearchResult should include User");
    ok(result.includes("Post"), "SearchResult should include Post");
    ok(result.includes("type User {"), "Should emit User type");
    ok(result.includes("type Post {"), "Should emit Post type");
    ok(result.includes("search(query: String!): [SearchResult!]!"), "search should return list of SearchResult");
  });

  it("handles models used only as input without suffix", async () => {
    const code = `
      @schema
      namespace Forms {
        model User {
          id: string;
          name: string;
        }

        /** Input for creating a user - only used as input */
        model CreateUserInput {
          name: string;
          email: string;
        }

        @query
        op getUser(id: string): User;

        @mutation
        op createUser(input: CreateUserInput): User;
      }
    `;

    const result = await emitSingleSchema(code, {});

    // User is only used as output, no UserInput needed
    ok(result.includes("type User {"), "Should emit User type");
    strictEqual(result.includes("input UserInput"), false, "Should NOT create UserInput (only used as output)");

    // CreateUserInput is only used as input
    ok(result.includes("input CreateUserInput {"), "CreateUserInput should be input type");
    strictEqual(result.includes("type CreateUserInput"), false, "CreateUserInput should NOT be output type");
  });

  it("generates valid SDL that graphql-js can parse for complex schema", async () => {
    // This test verifies the SDL is syntactically valid by relying on
    // emitSingleSchema which internally parses through buildSchema.
    // If the SDL were invalid, buildSchema would throw.
    const code = `
      @schema
      namespace ECommerce {
        enum OrderStatus {
          Pending,
          Processing,
          Shipped,
          Delivered,
          Cancelled,
        }

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
          inStock: boolean;
          tags: string[];
          description?: string;
        }

        model OrderItem {
          product: Product;
          quantity: int32;
          unitPrice: float32;
        }

        @compose(Timestamped)
        model Order {
          ...Timestamped;
          id: string;
          items: OrderItem[];
          status: OrderStatus;
          total: float32;
          notes?: string;
        }

        @compose(Timestamped)
        model Customer {
          ...Timestamped;
          id: string;
          name: string;
          email: string;
          orders: Order[];
        }

        @query
        op getProduct(id: string): Product;

        @query
        op listProducts(inStock?: boolean, limit?: int32): Product[];

        @query
        op getOrder(id: string): Order;

        @query
        op getCustomer(id: string): Customer;

        @mutation
        op createOrder(order: Order): Order;

        @mutation
        op updateOrderStatus(id: string, status: OrderStatus): Order;

        @mutation
        op createCustomer(customer: Customer): Customer;

        @subscription
        op onOrderStatusChanged(orderId: string): Order;
      }
    `;

    const result = await emitSingleSchema(code, {});

    // Verify the schema has all expected sections
    ok(result.includes("type Query {"), "Should have Query type");
    ok(result.includes("type Mutation {"), "Should have Mutation type");
    ok(result.includes("type Subscription {"), "Should have Subscription type");
    ok(result.includes("interface Timestamped {"), "Should have Timestamped interface");
    ok(result.includes("enum OrderStatus {"), "Should have OrderStatus enum");

    // Verify input/output splitting for models used in both contexts
    ok(result.includes("type Order implements Timestamped {"), "Order should implement Timestamped");
    ok(result.includes("input OrderInput {"), "Should create OrderInput");
    ok(result.includes("type Customer implements Timestamped {"), "Customer should implement Timestamped");
    ok(result.includes("input CustomerInput {"), "Should create CustomerInput");
    ok(result.includes("input OrderItemInput {"), "Should create OrderItemInput (nested in Order)");

    // Product is only used as output (through OrderItem), not directly as mutation input
    ok(result.includes("type Product implements Timestamped {"), "Product should implement Timestamped");

    // Verify operations reference correct types
    ok(result.includes("createOrder(order: OrderInput!): Order!"), "createOrder should use OrderInput");
    ok(result.includes("createCustomer(customer: CustomerInput!): Customer!"), "createCustomer should use CustomerInput");
    ok(result.includes("updateOrderStatus(id: String!, status: OrderStatus!): Order!"), "updateOrderStatus should use OrderStatus enum");
    ok(result.includes("onOrderStatusChanged(orderId: String!): Order!"), "subscription should have args");

    // Verify float32 maps to Float
    const productBlock = result.match(/type Product implements Timestamped \{[^}]+\}/s)?.[0];
    ok(productBlock, "Should find Product type block");
    if (productBlock) {
      ok(productBlock.includes("price: Float!"), "Product.price (float32) should map to Float");
      ok(productBlock.includes("inStock: Boolean!"), "Product.inStock should be Boolean");
      ok(productBlock.includes("tags: [String!]!"), "Product.tags should be list of String");
      ok(productBlock.includes("description: String"), "Product.description (optional) should be nullable");
    }
  });
});
