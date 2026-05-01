import { t } from "@typespec/compiler/testing";
import { describe, expect, it, beforeEach } from "vitest";
import { InterfaceType } from "../../src/components/types/index.js";
import { Tester } from "../test-host.js";
import { renderComponentToSDL } from "./component-test-utils.js";

describe("InterfaceType component", () => {
  let tester: Awaited<ReturnType<typeof Tester.createInstance>>;
  beforeEach(async () => {
    tester = await Tester.createInstance();
  });

  it("renders a basic interface with fields", async () => {
    const { Node } = await tester.compile(
      t.code`
        @Interface
        model ${t.model("Node")} { id: string; }
      `,
    );

    const sdl = renderComponentToSDL(tester.program, <InterfaceType type={Node} />);

    expect(sdl).toMatchInlineSnapshot(`
      "interface Node {
        id: String!
      }

      type Query {
        _placeholder: Boolean
      }"
    `);
  });

  it("renders with doc comment description", async () => {
    const { Entity } = await tester.compile(
      t.code`
        /** A base entity */
        @Interface
        model ${t.model("Entity")} { id: string; }
      `,
    );

    const sdl = renderComponentToSDL(tester.program, <InterfaceType type={Entity} />);

    expect(sdl).toMatchInlineSnapshot(`
      """"A base entity"""
      interface Entity {
        id: String!
      }

      type Query {
        _placeholder: Boolean
      }"
    `);
  });

  it("renders multiple fields with correct types", async () => {
    const { Timestamped } = await tester.compile(
      t.code`
        @Interface
        model ${t.model("Timestamped")} {
          createdAt: string;
          updatedAt: string;
          version: int32;
        }
      `,
    );

    const sdl = renderComponentToSDL(tester.program, <InterfaceType type={Timestamped} />);

    expect(sdl).toMatchInlineSnapshot(`
      "interface Timestamped {
        createdAt: String!
        updatedAt: String!
        version: Int!
      }

      type Query {
        _placeholder: Boolean
      }"
    `);
  });

  it("renders optional fields as nullable", async () => {
    const { Described } = await tester.compile(
      t.code`
        @Interface
        model ${t.model("Described")} { description?: string; }
      `,
    );

    const sdl = renderComponentToSDL(tester.program, <InterfaceType type={Described} />);

    expect(sdl).toMatchInlineSnapshot(`
      "interface Described {
        description: String
      }

      type Query {
        _placeholder: Boolean
      }"
    `);
  });

  it("throws error for empty interface (GraphQL requires at least one field)", async () => {
    const { Empty } = await tester.compile(
      t.code`
        @Interface
        model ${t.model("Empty")} {}
      `,
    );

    expect(() => {
      renderComponentToSDL(tester.program, <InterfaceType type={Empty} />);
    }).toThrow(/must define fields/);
  });
});
