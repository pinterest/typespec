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

    expect(sdl).toContain("input CreateUser {");
    expect(sdl).toContain("name: String!");
    expect(sdl).toContain("email: String!");
  });

  it("renders with doc comment description", async () => {
    const { LoginInput } = await tester.compile(
      t.code`
        /** Credentials for login */
        model ${t.model("LoginInput")} { username: string; password: string; }
      `,
    );

    const sdl = renderComponentToSDL(tester.program, <InputType type={LoginInput} />);

    expect(sdl).toContain("Credentials for login");
    expect(sdl).toContain("input LoginInput {");
  });

  it("renders optional fields as non-null (GraphQL input convention)", async () => {
    // In GraphQL, input fields are always non-null; optionality is expressed
    // via default values, not nullability. Only `| null` makes them nullable.
    const { UpdateUser } = await tester.compile(
      t.code`model ${t.model("UpdateUser")} { name?: string; bio?: string; }`,
    );

    const sdl = renderComponentToSDL(tester.program, <InputType type={UpdateUser} />);

    expect(sdl).toContain("name: String!");
    expect(sdl).toContain("bio: String!");
  });

  it("renders mutated input model with Input suffix from mutation engine", async () => {
    // The mutation engine adds the Input suffix when a model is used as input.
    // This test simulates that by using a model already named with Input suffix.
    const { PetInput } = await tester.compile(
      t.code`model ${t.model("PetInput")} { name: string; }`,
    );

    const sdl = renderComponentToSDL(tester.program, <InputType type={PetInput} />);

    expect(sdl).toContain("input PetInput {");
  });

  it("renders input-only model without suffix", async () => {
    // Models used only as inputs (never as outputs) don't need the Input suffix.
    // The mutation engine handles this - it only adds suffix when needed.
    const { CreatePet } = await tester.compile(
      t.code`model ${t.model("CreatePet")} { name: string; }`,
    );

    const sdl = renderComponentToSDL(tester.program, <InputType type={CreatePet} />);

    expect(sdl).toContain("input CreatePet {");
    expect(sdl).not.toContain("CreatePetInput");
  });

  it("renders array fields as list types", async () => {
    const { TagInput } = await tester.compile(
      t.code`model ${t.model("TagInput")} { values: string[]; }`,
    );

    const sdl = renderComponentToSDL(tester.program, <InputType type={TagInput} />);

    expect(sdl).toContain("values: [String!]!");
  });

  it("throws error for empty model (GraphQL requires at least one field)", async () => {
    const { Empty } = await tester.compile(t.code`model ${t.model("Empty")} {}`);

    expect(() => {
      renderComponentToSDL(tester.program, <InputType type={Empty} />);
    }).toThrow(/must define fields/);
  });
});
