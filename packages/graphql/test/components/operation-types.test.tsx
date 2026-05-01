import { t } from "@typespec/compiler/testing";
import * as gql from "@alloy-js/graphql";
import { describe, expect, it, beforeEach } from "vitest";
import {
  QueryType,
  MutationType,
  SubscriptionType,
} from "../../src/components/operations/index.js";
import { Tester } from "../test-host.js";
import { renderComponentToSDL } from "./component-test-utils.js";

describe("QueryType component", () => {
  let tester: Awaited<ReturnType<typeof Tester.createInstance>>;
  beforeEach(async () => {
    tester = await Tester.createInstance();
  });

  it("renders nothing when no operations", async () => {
    await tester.compile(t.code`model Placeholder { id: string; }`);

    const sdl = renderComponentToSDL(tester.program, <QueryType operations={[]} />);

    // Should only contain the placeholder Query from test utils
    expect(sdl).toMatchInlineSnapshot(`
      "type Query {
        _placeholder: Boolean
      }"
    `);
  });

  it("renders single query operation with scalar return type", async () => {
    const { getVersion } = await tester.compile(
      t.code`op ${t.op("getVersion")}(): string;`,
    );

    const sdl = renderComponentToSDL(
      tester.program,
      <QueryType operations={[getVersion]} />,
      { skipPlaceholderQuery: true },
    );

    expect(sdl).toMatchInlineSnapshot(`
      "type Query {
        getVersion: String!
      }"
    `);
  });

  it("renders query operation with model return type", async () => {
    const { getBook } = await tester.compile(
      t.code`
        model ${t.model("Book")} { id: string; title: string; }
        op ${t.op("getBook")}(id: string): Book;
      `,
    );

    // Stub the Book type so buildSchema can resolve the reference
    const sdl = renderComponentToSDL(
      tester.program,
      <>
        <gql.ObjectType name="Book">
          <gql.Field name="id" type={gql.String} nonNull />
          <gql.Field name="title" type={gql.String} nonNull />
        </gql.ObjectType>
        <QueryType operations={[getBook]} />
      </>,
      { skipPlaceholderQuery: true },
    );

    expect(sdl).toMatchInlineSnapshot(`
      "type Book {
        id: String!
        title: String!
      }

      type Query {
        getBook(id: String!): Book!
      }"
    `);
  });

  it("renders multiple query operations", async () => {
    const { getCount, getName } = await tester.compile(
      t.code`
        op ${t.op("getCount")}(): int32;
        op ${t.op("getName")}(): string;
      `,
    );

    const sdl = renderComponentToSDL(
      tester.program,
      <QueryType operations={[getCount, getName]} />,
      { skipPlaceholderQuery: true },
    );

    expect(sdl).toMatchInlineSnapshot(`
      "type Query {
        getCount: Int!
        getName: String!
      }"
    `);
  });

  it("renders query with parameters", async () => {
    const { search } = await tester.compile(
      t.code`op ${t.op("search")}(query: string, limit?: int32): string[];`,
    );

    const sdl = renderComponentToSDL(
      tester.program,
      <QueryType operations={[search]} />,
      { skipPlaceholderQuery: true },
    );

    expect(sdl).toMatchInlineSnapshot(`
      "type Query {
        search(query: String!, limit: Int!): [String!]!
      }"
    `);
  });
});

describe("MutationType component", () => {
  let tester: Awaited<ReturnType<typeof Tester.createInstance>>;
  beforeEach(async () => {
    tester = await Tester.createInstance();
  });

  it("renders nothing when no operations", async () => {
    await tester.compile(t.code`model Placeholder { id: string; }`);

    const sdl = renderComponentToSDL(tester.program, <MutationType operations={[]} />);

    // Should only contain the placeholder Query from test utils
    expect(sdl).toMatchInlineSnapshot(`
      "type Query {
        _placeholder: Boolean
      }"
    `);
  });

  it("renders single mutation operation", async () => {
    const { deleteItem } = await tester.compile(
      t.code`op ${t.op("deleteItem")}(id: string): boolean;`,
    );

    const sdl = renderComponentToSDL(
      tester.program,
      <MutationType operations={[deleteItem]} />,
    );

    expect(sdl).toMatchInlineSnapshot(`
      "type Mutation {
        deleteItem(id: String!): Boolean!
      }

      type Query {
        _placeholder: Boolean
      }"
    `);
  });

  it("renders mutation with input parameters", async () => {
    const { createUser } = await tester.compile(
      t.code`
        model ${t.model("User")} { id: string; name: string; }
        op ${t.op("createUser")}(name: string, email: string): User;
      `,
    );

    const sdl = renderComponentToSDL(
      tester.program,
      <>
        <gql.ObjectType name="User">
          <gql.Field name="id" type={gql.String} nonNull />
          <gql.Field name="name" type={gql.String} nonNull />
        </gql.ObjectType>
        <MutationType operations={[createUser]} />
      </>,
    );

    expect(sdl).toMatchInlineSnapshot(`
      "type User {
        id: String!
        name: String!
      }

      type Mutation {
        createUser(name: String!, email: String!): User!
      }

      type Query {
        _placeholder: Boolean
      }"
    `);
  });
});

describe("SubscriptionType component", () => {
  let tester: Awaited<ReturnType<typeof Tester.createInstance>>;
  beforeEach(async () => {
    tester = await Tester.createInstance();
  });

  it("renders nothing when no operations", async () => {
    await tester.compile(t.code`model Placeholder { id: string; }`);

    const sdl = renderComponentToSDL(
      tester.program,
      <SubscriptionType operations={[]} />,
    );

    // Should only contain the placeholder Query from test utils
    expect(sdl).toMatchInlineSnapshot(`
      "type Query {
        _placeholder: Boolean
      }"
    `);
  });

  it("renders single subscription operation", async () => {
    const { onMessage } = await tester.compile(
      t.code`op ${t.op("onMessage")}(): string;`,
    );

    const sdl = renderComponentToSDL(
      tester.program,
      <SubscriptionType operations={[onMessage]} />,
    );

    expect(sdl).toMatchInlineSnapshot(`
      "type Subscription {
        onMessage: String!
      }

      type Query {
        _placeholder: Boolean
      }"
    `);
  });
});
