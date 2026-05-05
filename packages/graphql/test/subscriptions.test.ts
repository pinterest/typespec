import { describe, expect, it } from "vitest";
import { emitSingleSchema } from "./test-host.js";

describe("subscriptions", () => {
  it("emits basic subscription operation", async () => {
    const code = `
      @schema
      namespace TestNamespace {
        model Message {
          id: string;
          text: string;
          sender: string;
        }

        @query
        op getMessages(): Message[];

        @subscription
        op onNewMessage(): Message;
      }
    `;

    const result = await emitSingleSchema(code, {});

    expect(result).toMatchInlineSnapshot(`
      "type Message {
        id: String!
        text: String!
        sender: String!
      }

      type Query {
        getMessages: [Message!]!
      }

      type Subscription {
        onNewMessage: Message!
      }

      "
    `);
  });

  it("emits subscription with arguments", async () => {
    const code = `
      @schema
      namespace TestNamespace {
        model ChatMessage {
          id: string;
          roomId: string;
          text: string;
        }

        @query
        op getRooms(): string[];

        @subscription
        op onMessageInRoom(roomId: string): ChatMessage;
      }
    `;

    const result = await emitSingleSchema(code, {});

    expect(result).toMatchInlineSnapshot(`
      "type ChatMessage {
        id: String!
        roomId: String!
        text: String!
      }

      type Query {
        getRooms: [String!]!
      }

      type Subscription {
        onMessageInRoom(roomId: String!): ChatMessage!
      }

      "
    `);
  });

  it("emits multiple subscriptions", async () => {
    const code = `
      @schema
      namespace TestNamespace {
        model User {
          id: string;
          name: string;
          status: string;
        }

        model Notification {
          id: string;
          message: string;
        }

        @query
        op getUser(id: string): User;

        @subscription
        op onUserStatusChanged(userId: string): User;

        @subscription
        op onNotification(userId: string): Notification;

        @subscription
        op onUserJoined(): User;
      }
    `;

    const result = await emitSingleSchema(code, {});

    expect(result).toMatchInlineSnapshot(`
      "type User {
        id: String!
        name: String!
        status: String!
      }

      type Notification {
        id: String!
        message: String!
      }

      type Query {
        getUser(id: String!): User!
      }

      type Subscription {
        onUserStatusChanged(userId: String!): User!
        onNotification(userId: String!): Notification!
        onUserJoined: User!
      }

      "
    `);
  });

  it("emits subscription returning array", async () => {
    const code = `
      @schema
      namespace TestNamespace {
        model StockPrice {
          symbol: string;
          price: float64;
        }

        @query
        op getStocks(): StockPrice[];

        @subscription
        op onPriceUpdates(symbols: string[]): StockPrice[];
      }
    `;

    const result = await emitSingleSchema(code, {});

    expect(result).toMatchInlineSnapshot(`
      "type StockPrice {
        symbol: String!
        price: Float!
      }

      type Query {
        getStocks: [StockPrice!]!
      }

      type Subscription {
        onPriceUpdates(symbols: [String!]!): [StockPrice!]!
      }

      "
    `);
  });

  it("emits subscription with complex input type", async () => {
    const code = `
      @schema
      namespace TestNamespace {
        model FilterOptions {
          minPrice: float64;
          maxPrice: float64;
          categories: string[];
        }

        model Product {
          id: string;
          name: string;
          price: float64;
        }

        @query
        op getProducts(): Product[];

        @subscription
        op onProductMatching(filter: FilterOptions): Product;
      }
    `;

    const result = await emitSingleSchema(code, {});

    expect(result).toMatchInlineSnapshot(`
      "type Product {
        id: String!
        name: String!
        price: Float!
      }

      input FilterOptionsInput {
        minPrice: Float!
        maxPrice: Float!
        categories: [String!]!
      }

      type Query {
        getProducts: [Product!]!
      }

      type Subscription {
        onProductMatching(filter: FilterOptionsInput!): Product!
      }

      "
    `);
  });
});
