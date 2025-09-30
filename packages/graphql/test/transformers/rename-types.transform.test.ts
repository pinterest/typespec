import { t, type TransformerTesterInstance } from "@typespec/compiler/testing";
import { beforeEach, describe, expect, it } from "vitest";
import { renameTypesTransform } from "../../src/transformers/rename-types.transform.js";
import { Tester } from "../test-host.js";

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
        ${t.enumMember("ValidEnumValue")}
      }`,
    );

    expect(ValidEnum.name).toBe("ValidEnum");
  });

  it("changes invalid enum names", async () => {
    const { ValidEnumValue } = await tester.compile(
      t.code`enum \`$Money$\` {
        ${t.enumMember("ValidEnumValue")}
      }`,
    );

    expect(ValidEnumValue.enum.name).toBe("_Money_");
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

  it("changes invalid enum member names", async () => {
    const { MyEnum } = await tester.compile(
      t.code`enum ${t.enum("MyEnum")} {
        \`$Value$\`
      }`,
    );

    expect(MyEnum.members).toContain("_Value_");
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

  it("changes invalid model names", async () => {
    const { prop } = await tester.compile(
      t.code`model \`$Foo$\` { ${t.modelProperty("prop")}: string }`,
    );

    expect(prop.model?.name).toBe("_Foo_");
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
    const { prop } = await tester.compile(
      t.code`model ${t.model("M")} { ${t.modelProperty("prop")}: string }`,
    );

    expect(prop.name).toBe("prop");
  });

  it("changes invalid property names", async () => {
    const { M } = await tester.compile(t.code`model ${t.model("M")} { \`$prop$\`: string }`);

    expect(M.properties).toContain("_prop_");
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

  it("changes invalid operation names", async () => {
    const { Iface } = await tester.compile(
      t.code`interface ${t.interface("Iface")} { \`$Do$\`(): void; }`,
    );

    expect(Iface.operations).toContain("_Do_");
  });
});
