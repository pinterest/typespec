import { type Model } from "@typespec/compiler";
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

  it("appends Input suffix when model has an output variant", async () => {
    const { Pet } = await tester.compile(
      t.code`model ${t.model("Pet")} { name: string; }`,
    );

    const sdl = renderComponentToSDL(tester.program, <InputType type={Pet} />, {
      modelVariants: {
        outputModels: new Map([["Pet", Pet]]),
        inputModels: new Map([["Pet", Pet]]),
      },
    });

    expect(sdl).toContain("input PetInput {");
  });

  it("uses original name when no output variant exists", async () => {
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
});
