import { t, type TransformerTesterInstance } from "@typespec/compiler/testing";
import { beforeEach, describe, expect, it } from "vitest";
import { sanitizeNameForGraphQL } from "../../src/lib/type-utils.js";
import { renameTypesTransform } from "../../src/transformers/rename-types.transform.js";
import { Tester } from "../test-host.js";

// Unit tests for the sanitization function
describe("sanitizeNameForGraphQL", () => {
  it("replaces special characters with underscores", () => {
    expect(sanitizeNameForGraphQL("$Money$")).toBe("_Money_");
    expect(sanitizeNameForGraphQL("My-Name")).toBe("My_Name");
    expect(sanitizeNameForGraphQL("Hello.World")).toBe("Hello_World");
  });

  it("replaces [] with Array", () => {
    expect(sanitizeNameForGraphQL("Item[]")).toBe("ItemArray");
  });

  it("leaves valid names unchanged", () => {
    expect(sanitizeNameForGraphQL("ValidName")).toBe("ValidName");
    expect(sanitizeNameForGraphQL("_underscore")).toBe("_underscore");
    expect(sanitizeNameForGraphQL("name123")).toBe("name123");
  });
});

// Integration tests verifying the transformer applies sanitization
describe("Rename enums transform", () => {
  let tester: TransformerTesterInstance;
  beforeEach(async () => {
    tester = await Tester.transformer({
      enable: {
        [`@typespec/graphql/${renameTypesTransform.name}`]: true,
      },
    }).createInstance();
  });

  it("leaves valid enum names alone", async () => {
    const { ValidEnum } = await tester.compile(
      t.code`enum ${t.enum("ValidEnum")} {
        Value
      }`,
    );

    expect(ValidEnum.name).toBe("ValidEnum");
  });

  it("processes enum members through sanitization", async () => {
    const { MyEnum } = await tester.compile(
      t.code`enum ${t.enum("MyEnum")} {
        ValidMember
      }`,
    );

    // Verify the enum is properly extracted and its members are accessible
    expect(MyEnum.name).toBe("MyEnum");
    expect(MyEnum.members.has("ValidMember")).toBe(true);
  });
});

describe("Rename enum members transform", () => {
  let tester: TransformerTesterInstance;
  beforeEach(async () => {
    tester = await Tester.transformer({
      enable: {
        [`@typespec/graphql/${renameTypesTransform.name}`]: true,
      },
    }).createInstance();
  });

  it("leaves valid enum member names alone", async () => {
    const { ValidMember } = await tester.compile(
      t.code`enum MyEnum {
        ${t.enumMember("ValidMember")}
      }`,
    );

    expect(ValidMember.name).toBe("ValidMember");
  });

  it("renames invalid enum member names", async () => {
    // Extract the enum (parent) and check its members collection has the renamed key
    const { MyEnum } = await tester.compile(
      t.code`enum ${t.enum("MyEnum")} {
        \`$Value$\`
      }`,
    );

    expect(MyEnum.members.has("_Value_")).toBe(true);
    expect(MyEnum.members.has("$Value$")).toBe(false);
  });
});

describe("Rename models transform", () => {
  let tester: TransformerTesterInstance;
  beforeEach(async () => {
    tester = await Tester.transformer({
      enable: {
        [`@typespec/graphql/${renameTypesTransform.name}`]: true,
      },
    }).createInstance();
  });

  it("leaves valid model names alone", async () => {
    const { ValidModel } = await tester.compile(t.code`model ${t.model("ValidModel")} { }`);

    expect(ValidModel.name).toBe("ValidModel");
  });

  it("processes model properties through sanitization", async () => {
    const { TestModel } = await tester.compile(
      t.code`model ${t.model("TestModel")} { validProp: string }`,
    );

    expect(TestModel.name).toBe("TestModel");
    expect(TestModel.properties.has("validProp")).toBe(true);
  });
});

describe("Rename model properties transform", () => {
  let tester: TransformerTesterInstance;
  beforeEach(async () => {
    tester = await Tester.transformer({
      enable: {
        [`@typespec/graphql/${renameTypesTransform.name}`]: true,
      },
    }).createInstance();
  });

  it("leaves valid property names alone", async () => {
    const { prop } = await tester.compile(t.code`model M { ${t.modelProperty("prop")}: string }`);

    expect(prop.name).toBe("prop");
  });

  it("renames invalid property names", async () => {
    // Extract the model (parent) and check its properties collection has the renamed key
    const { M } = await tester.compile(t.code`model ${t.model("M")} { \`$prop$\`: string }`);

    expect(M.properties.has("_prop_")).toBe(true);
    expect(M.properties.has("$prop$")).toBe(false);
  });
});

describe("Rename operations transform", () => {
  let tester: TransformerTesterInstance;
  beforeEach(async () => {
    tester = await Tester.transformer({
      enable: {
        [`@typespec/graphql/${renameTypesTransform.name}`]: true,
      },
    }).createInstance();
  });

  it("leaves valid operation names alone", async () => {
    const { ValidOp } = await tester.compile(t.code`op ${t.op("ValidOp")}(): void;`);

    expect(ValidOp.name).toBe("ValidOp");
  });

  it("renames invalid operation names", async () => {
    // Extract the interface (parent) and check its operations collection has the renamed key
    const { Iface } = await tester.compile(
      t.code`interface ${t.interface("Iface")} { \`$Do$\`(): void; }`,
    );

    expect(Iface.operations.has("_Do_")).toBe(true);
    expect(Iface.operations.has("$Do$")).toBe(false);
  });
});
