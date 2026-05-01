import { t } from "@typespec/compiler/testing";
import { describe, expect, it, beforeEach } from "vitest";
import { InputType } from "../../src/components/types/index.js";
import { Tester } from "../test-host.js";
import { renderComponentToSDL } from "./component-test-utils.js";

describe("InputType component", () => {
  let tester: Awaited<ReturnType<typeof Tester.createInstance>>;
  beforeEach(async () => {
    tester = await Tester.createInstance();
  });

  it("renders a basic input type with fields", async () => {
    const { CreateUser } = await tester.compile(
      t.code`model ${t.model("CreateUser")} { name: string; email: string; }`,
    );

    const sdl = renderComponentToSDL(tester.program, <InputType type={CreateUser} />);

    expect(sdl).toMatchInlineSnapshot(`
      "input CreateUser {
        name: String!
        email: String!
      }

      type Query {
        _placeholder: Boolean
      }"
    `);
  });

  it("renders with doc comment description", async () => {
    const { LoginInput } = await tester.compile(
      t.code`
        /** Credentials for login */
        model ${t.model("LoginInput")} { username: string; password: string; }
      `,
    );

    const sdl = renderComponentToSDL(tester.program, <InputType type={LoginInput} />);

    expect(sdl).toMatchInlineSnapshot(`
      """"Credentials for login"""
      input LoginInput {
        username: String!
        password: String!
      }

      type Query {
        _placeholder: Boolean
      }"
    `);
  });

  it("renders optional fields as non-null (GraphQL input convention)", async () => {
    // In GraphQL, input fields are always non-null; optionality is expressed
    // via default values, not nullability. Only `| null` makes them nullable.
    const { UpdateUser } = await tester.compile(
      t.code`model ${t.model("UpdateUser")} { name?: string; bio?: string; }`,
    );

    const sdl = renderComponentToSDL(tester.program, <InputType type={UpdateUser} />);

    expect(sdl).toMatchInlineSnapshot(`
      "input UpdateUser {
        name: String!
        bio: String!
      }

      type Query {
        _placeholder: Boolean
      }"
    `);
  });

  it("renders array fields as list types", async () => {
    const { TagInput } = await tester.compile(
      t.code`model ${t.model("TagInput")} { values: string[]; }`,
    );

    const sdl = renderComponentToSDL(tester.program, <InputType type={TagInput} />);

    expect(sdl).toMatchInlineSnapshot(`
      "input TagInput {
        values: [String!]!
      }

      type Query {
        _placeholder: Boolean
      }"
    `);
  });

  it("throws error for empty model (GraphQL requires at least one field)", async () => {
    const { Empty } = await tester.compile(t.code`model ${t.model("Empty")} {}`);

    expect(() => {
      renderComponentToSDL(tester.program, <InputType type={Empty} />);
    }).toThrow(/must define fields/);
  });
});
