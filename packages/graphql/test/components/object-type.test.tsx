import { t } from "@typespec/compiler/testing";
import * as gql from "@alloy-js/graphql";
import { describe, expect, it, beforeEach } from "vitest";
import { ObjectType } from "../../src/components/types/index.js";
import { Tester } from "../test-host.js";
import { renderToSDL } from "./test-utils.js";

describe("ObjectType component", () => {
  let tester: Awaited<ReturnType<typeof Tester.createInstance>>;
  beforeEach(async () => {
    tester = await Tester.createInstance();
  });

  it("renders a basic object type with fields", async () => {
    const { User } = await tester.compile(
      t.code`model ${t.model("User")} { name: string; age: int32; }`,
    );

    const sdl = renderToSDL(tester.program, <ObjectType type={User} />);

    expect(sdl).toMatchInlineSnapshot(`
      "type User {
        name: String!
        age: Int!
      }

      type Query {
        _placeholder: Boolean
      }"
    `);
  });

  it("renders with doc comment description", async () => {
    const { Item } = await tester.compile(
      t.code`
        /** A store item */
        model ${t.model("Item")} { title: string; }
      `,
    );

    const sdl = renderToSDL(tester.program, <ObjectType type={Item} />);

    expect(sdl).toMatchInlineSnapshot(`
      """"A store item"""
      type Item {
        title: String!
      }

      type Query {
        _placeholder: Boolean
      }"
    `);
  });

  it("renders optional fields as nullable", async () => {
    const { Profile } = await tester.compile(
      t.code`model ${t.model("Profile")} { bio?: string; }`,
    );

    const sdl = renderToSDL(tester.program, <ObjectType type={Profile} />);

    expect(sdl).toMatchInlineSnapshot(`
      "type Profile {
        bio: String
      }

      type Query {
        _placeholder: Boolean
      }"
    `);
  });

  it("renders array fields as list types", async () => {
    const { Post } = await tester.compile(
      t.code`model ${t.model("Post")} { tags: string[]; }`,
    );

    const sdl = renderToSDL(tester.program, <ObjectType type={Post} />);

    expect(sdl).toMatchInlineSnapshot(`
      "type Post {
        tags: [String!]!
      }

      type Query {
        _placeholder: Boolean
      }"
    `);
  });

  it("renders field with doc comment description", async () => {
    const { Thing } = await tester.compile(
      t.code`
        model ${t.model("Thing")} {
          /** The display name */
          name: string;
        }
      `,
    );

    const sdl = renderToSDL(tester.program, <ObjectType type={Thing} />);

    expect(sdl).toMatchInlineSnapshot(`
      "type Thing {
        """The display name"""
        name: String!
      }

      type Query {
        _placeholder: Boolean
      }"
    `);
  });

  it("renders deprecated fields", async () => {
    const { Entry } = await tester.compile(
      t.code`
        model ${t.model("Entry")} {
          current: string;
          #deprecated "use current instead"
          old: string;
        }
      `,
    );

    const sdl = renderToSDL(tester.program, <ObjectType type={Entry} />);

    expect(sdl).toMatchInlineSnapshot(`
      "type Entry {
        current: String!
        old: String! @deprecated(reason: "use current instead")
      }

      type Query {
        _placeholder: Boolean
      }"
    `);
  });

  it("renders with interface implementation via @compose", async () => {
    const { Pet } = await tester.compile(
      t.code`
        @Interface
        model ${t.model("Node")} { id: string; }

        @compose(Node)
        model ${t.model("Pet")} { ...Node; name: string; }
      `,
    );

    // Register the Node interface in the schema so buildSchema can resolve it
    const sdl = renderToSDL(
      tester.program,
      <>
        <gql.InterfaceType name="Node">
          <gql.Field name="id" type={gql.String} nonNull />
        </gql.InterfaceType>
        <ObjectType type={Pet} />
      </>,
    );

    expect(sdl).toMatchInlineSnapshot(`
      "interface Node {
        id: String!
      }

      type Pet implements Node {
        id: String!
        name: String!
      }

      type Query {
        _placeholder: Boolean
      }"
    `);
  });

  it("renders operation fields via @operationFields", async () => {
    const { Book } = await tester.compile(
      t.code`
        @operationFields(getRelated)
        model ${t.model("Book")} { title: string; }

        op getRelated(limit: int32): Book[];
      `,
    );

    const sdl = renderToSDL(tester.program, <ObjectType type={Book} />);

    expect(sdl).toMatchInlineSnapshot(`
      "type Book {
        title: String!
        getRelated(limit: Int!): [Book!]!
      }

      type Query {
        _placeholder: Boolean
      }"
    `);
  });

  it("renders fields that reference other models", async () => {
    const { Author } = await tester.compile(
      t.code`
        model ${t.model("Book")} { title: string; }
        model ${t.model("Author")} { name: string; favoriteBook: Book; }
      `,
    );

    const sdl = renderToSDL(
      tester.program,
      <>
        <gql.ObjectType name="Book">
          <gql.Field name="title" type={gql.String} nonNull />
        </gql.ObjectType>
        <ObjectType type={Author} />
      </>,
    );

    expect(sdl).toMatchInlineSnapshot(`
      "type Book {
        title: String!
      }

      type Author {
        name: String!
        favoriteBook: Book!
      }

      type Query {
        _placeholder: Boolean
      }"
    `);
  });

  it("throws error for empty model (GraphQL requires at least one field)", async () => {
    const { Empty } = await tester.compile(t.code`model ${t.model("Empty")} {}`);

    expect(() => {
      renderToSDL(tester.program, <ObjectType type={Empty} />);
    }).toThrow(/must define fields/);
  });
});
