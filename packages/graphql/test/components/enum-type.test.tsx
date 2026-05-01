import { t } from "@typespec/compiler/testing";
import { describe, expect, it, beforeEach } from "vitest";
import { EnumType } from "../../src/components/types/index.js";
import { createGraphQLMutationEngine } from "../../src/mutation-engine/index.js";
import { Tester } from "../test-host.js";
import { renderComponentToSDL } from "./component-test-utils.js";

describe("EnumType component", () => {
  let tester: Awaited<ReturnType<typeof Tester.createInstance>>;
  beforeEach(async () => {
    tester = await Tester.createInstance();
  });

  it("renders a basic enum", async () => {
    const { Color } = await tester.compile(
      t.code`enum ${t.enum("Color")} { Red, Green, Blue }`,
    );

    const engine = createGraphQLMutationEngine(tester.program);
    const mutated = engine.mutateEnum(Color).mutatedType;

    const sdl = renderComponentToSDL(tester.program, <EnumType type={mutated} />);

    expect(sdl).toMatchInlineSnapshot(`
      "enum Color {
        Red
        Green
        Blue
      }

      type Query {
        _placeholder: Boolean
      }"
    `);
  });

  it("renders enum with doc comment description", async () => {
    const { Role } = await tester.compile(
      t.code`
        /** The role a user can have */
        enum ${t.enum("Role")} { Admin, User }
      `,
    );

    const engine = createGraphQLMutationEngine(tester.program);
    const mutated = engine.mutateEnum(Role).mutatedType;

    const sdl = renderComponentToSDL(tester.program, <EnumType type={mutated} />);

    expect(sdl).toMatchInlineSnapshot(`
      """"The role a user can have"""
      enum Role {
        Admin
        User
      }

      type Query {
        _placeholder: Boolean
      }"
    `);
  });

  it("renders enum with member descriptions", async () => {
    const { Status } = await tester.compile(
      t.code`
        enum ${t.enum("Status")} {
          /** Currently active */
          Active,
          /** No longer active */
          Inactive,
        }
      `,
    );

    const engine = createGraphQLMutationEngine(tester.program);
    const mutated = engine.mutateEnum(Status).mutatedType;

    const sdl = renderComponentToSDL(tester.program, <EnumType type={mutated} />);

    expect(sdl).toMatchInlineSnapshot(`
      "enum Status {
        """Currently active"""
        Active

        """No longer active"""
        Inactive
      }

      type Query {
        _placeholder: Boolean
      }"
    `);
  });

  it("renders enum with deprecated members", async () => {
    const { Status } = await tester.compile(
      t.code`
        enum ${t.enum("Status")} {
          Active,
          #deprecated "use Active instead"
          Legacy,
        }
      `,
    );

    const engine = createGraphQLMutationEngine(tester.program);
    const mutated = engine.mutateEnum(Status).mutatedType;

    const sdl = renderComponentToSDL(tester.program, <EnumType type={mutated} />);

    expect(sdl).toMatchInlineSnapshot(`
      "enum Status {
        Active
        Legacy @deprecated(reason: "use Active instead")
      }

      type Query {
        _placeholder: Boolean
      }"
    `);
  });

  it("renders enum with sanitized member names", async () => {
    const { E } = await tester.compile(
      t.code`enum ${t.enum("E")} { \`$val1$\`, \`val-2\` }`,
    );

    const engine = createGraphQLMutationEngine(tester.program);
    const mutated = engine.mutateEnum(E).mutatedType;

    const sdl = renderComponentToSDL(tester.program, <EnumType type={mutated} />);

    expect(sdl).toMatchInlineSnapshot(`
      "enum E {
        _val1_
        val_2
      }

      type Query {
        _placeholder: Boolean
      }"
    `);
  });
});
