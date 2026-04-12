import { type Model } from "@typespec/compiler";
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

    expect(sdl).toContain("interface Node {");
    expect(sdl).toContain("id: String!");
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

    expect(sdl).toContain("A base entity");
    expect(sdl).toContain("interface Entity {");
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

    expect(sdl).toContain("interface Timestamped {");
    expect(sdl).toContain("createdAt: String!");
    expect(sdl).toContain("updatedAt: String!");
    expect(sdl).toContain("version: Int!");
  });

  it("renders optional fields as nullable", async () => {
    const { Described } = await tester.compile(
      t.code`
        @Interface
        model ${t.model("Described")} { description?: string; }
      `,
    );

    const sdl = renderComponentToSDL(tester.program, <InterfaceType type={Described} />);

    expect(sdl).toContain("description: String");
    expect(sdl).not.toContain("description: String!");
  });
});
