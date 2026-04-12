import { t } from "@typespec/compiler/testing";
import * as gql from "@alloy-js/graphql";
import { describe, expect, it, beforeEach } from "vitest";
import { ObjectType } from "../../src/components/types/index.js";
import { Tester } from "../test-host.js";
import { renderComponentToSDL } from "./component-test-utils.js";

describe("ObjectType component", () => {
  let tester: Awaited<ReturnType<typeof Tester.createInstance>>;
  beforeEach(async () => {
    tester = await Tester.createInstance();
  });

  it("renders a basic object type with fields", async () => {
    const { User } = await tester.compile(
      t.code`model ${t.model("User")} { name: string; age: int32; }`,
    );

    const sdl = renderComponentToSDL(tester.program, <ObjectType type={User} />);

    expect(sdl).toContain("type User {");
    expect(sdl).toContain("name: String!");
    expect(sdl).toContain("age: Int!");
  });

  it("renders with doc comment description", async () => {
    const { Item } = await tester.compile(
      t.code`
        /** A store item */
        model ${t.model("Item")} { title: string; }
      `,
    );

    const sdl = renderComponentToSDL(tester.program, <ObjectType type={Item} />);

    expect(sdl).toContain("A store item");
    expect(sdl).toContain("type Item {");
  });

  it("renders optional fields as nullable", async () => {
    const { Profile } = await tester.compile(
      t.code`model ${t.model("Profile")} { bio?: string; }`,
    );

    const sdl = renderComponentToSDL(tester.program, <ObjectType type={Profile} />);

    expect(sdl).toContain("bio: String");
    expect(sdl).not.toContain("bio: String!");
  });

  it("renders array fields as list types", async () => {
    const { Post } = await tester.compile(
      t.code`model ${t.model("Post")} { tags: string[]; }`,
    );

    const sdl = renderComponentToSDL(tester.program, <ObjectType type={Post} />);

    expect(sdl).toContain("tags: [String!]!");
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

    const sdl = renderComponentToSDL(tester.program, <ObjectType type={Thing} />);

    expect(sdl).toContain("The display name");
    expect(sdl).toContain("name: String!");
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

    const sdl = renderComponentToSDL(tester.program, <ObjectType type={Entry} />);

    expect(sdl).toContain("current: String!");
    expect(sdl).toContain("old: String!");
    expect(sdl).toContain("@deprecated");
    expect(sdl).toContain("use current instead");
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
    const sdl = renderComponentToSDL(
      tester.program,
      <>
        <gql.InterfaceType name="Node">
          <gql.Field name="id" type={gql.String} nonNull />
        </gql.InterfaceType>
        <ObjectType type={Pet} />
      </>,
    );

    expect(sdl).toContain("type Pet implements Node {");
    expect(sdl).toContain("id: String!");
    expect(sdl).toContain("name: String!");
  });
});
