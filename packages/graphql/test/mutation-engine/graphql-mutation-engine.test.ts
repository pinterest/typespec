import { t } from "@typespec/compiler/testing";
import { beforeEach, describe, expect, it } from "vitest";
import { sanitizeNameForGraphQL } from "../../src/lib/type-utils.js";
import { createGraphQLMutationEngine } from "../../src/mutation-engine/index.js";
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

  it("adds prefix for names starting with numbers", () => {
    expect(sanitizeNameForGraphQL("123Name")).toBe("_123Name");
    expect(sanitizeNameForGraphQL("1")).toBe("_1");
  });

  it("handles multiple special characters", () => {
    expect(sanitizeNameForGraphQL("$My-Special.Name$")).toBe("_My_Special_Name_");
  });

  it("handles empty prefix parameter", () => {
    expect(sanitizeNameForGraphQL("123Name", "")).toBe("_123Name");
  });

  it("uses custom prefix for invalid starting character", () => {
    expect(sanitizeNameForGraphQL("123Name", "Num")).toBe("Num_123Name");
  });
});

describe("GraphQL Mutation Engine - Enums", () => {
  let tester: Awaited<ReturnType<typeof Tester.createInstance>>;
  beforeEach(async () => {
    tester = await Tester.createInstance();
  });

  it("leaves valid enum names alone", async () => {
    const { ValidEnum } = await tester.compile(
      t.code`enum ${t.enum("ValidEnum")} {
        Value
      }`,
    );

    const engine = createGraphQLMutationEngine(tester.program);
    const mutated = engine.mutate(ValidEnum).getMutatedType();

    expect(mutated.name).toBe("ValidEnum");
  });

  it("renames invalid enum names", async () => {
    await tester.compile(
      t.code`enum ${t.enum("$Invalid$")} {
        Value
      }`,
    );

    const InvalidEnum = tester.program.getGlobalNamespaceType().enums.get("$Invalid$")!;
    const engine = createGraphQLMutationEngine(tester.program);
    const mutated = engine.mutate(InvalidEnum).getMutatedType();

    expect(mutated.name).toBe("_Invalid_");
  });

  it("processes enum members through sanitization", async () => {
    const { MyEnum } = await tester.compile(
      t.code`enum ${t.enum("MyEnum")} {
        ValidMember
      }`,
    );

    const engine = createGraphQLMutationEngine(tester.program);
    const mutated = engine.mutate(MyEnum).getMutatedType();

    expect(mutated.name).toBe("MyEnum");
    expect(mutated.members.has("ValidMember")).toBe(true);
  });
});

describe("GraphQL Mutation Engine - Enum Members", () => {
  let tester: Awaited<ReturnType<typeof Tester.createInstance>>;
  beforeEach(async () => {
    tester = await Tester.createInstance();
  });

  it("leaves valid enum member names alone", async () => {
    const { ValidMember } = await tester.compile(
      t.code`enum MyEnum {
        ${t.enumMember("ValidMember")}
      }`,
    );

    const engine = createGraphQLMutationEngine(tester.program);
    const mutated = engine.mutate(ValidMember).getMutatedType();

    expect(mutated.name).toBe("ValidMember");
  });

  it("renames invalid enum member names", async () => {
    const { MyEnum } = await tester.compile(
      t.code`enum ${t.enum("MyEnum")} {
        \`$Value$\`
      }`,
    );

    const engine = createGraphQLMutationEngine(tester.program);
    const mutated = engine.mutate(MyEnum).getMutatedType();

    // Check that the member was renamed in the mutated enum
    const member = Array.from(mutated.members.values())[0]!;
    expect(member.name).toBe("_Value_");
  });
});

describe("GraphQL Mutation Engine - Models", () => {
  let tester: Awaited<ReturnType<typeof Tester.createInstance>>;
  beforeEach(async () => {
    tester = await Tester.createInstance();
  });

  it("leaves valid model names alone", async () => {
    const { ValidModel } = await tester.compile(t.code`model ${t.model("ValidModel")} { }`);

    const engine = createGraphQLMutationEngine(tester.program);
    const mutated = engine.mutate(ValidModel).getMutatedType();

    expect(mutated.name).toBe("ValidModel");
  });

  it("renames invalid model names", async () => {
    await tester.compile(t.code`model ${t.model("$Invalid$")} { }`);

    const InvalidModel = tester.program.getGlobalNamespaceType().models.get("$Invalid$")!;
    const engine = createGraphQLMutationEngine(tester.program);
    const mutated = engine.mutate(InvalidModel).getMutatedType();

    expect(mutated.name).toBe("_Invalid_");
  });

  it("processes model properties through sanitization", async () => {
    const { TestModel } = await tester.compile(
      t.code`model ${t.model("TestModel")} { validProp: string }`,
    );

    const engine = createGraphQLMutationEngine(tester.program);
    const mutated = engine.mutate(TestModel).getMutatedType();

    expect(mutated.name).toBe("TestModel");
    expect(mutated.properties.has("validProp")).toBe(true);
  });
});

describe("GraphQL Mutation Engine - Model Properties", () => {
  let tester: Awaited<ReturnType<typeof Tester.createInstance>>;
  beforeEach(async () => {
    tester = await Tester.createInstance();
  });

  it("leaves valid property names alone", async () => {
    const { prop } = await tester.compile(t.code`model M { ${t.modelProperty("prop")}: string }`);

    const engine = createGraphQLMutationEngine(tester.program);
    const mutated = engine.mutate(prop).getMutatedType();

    expect(mutated.name).toBe("prop");
  });

  it("renames invalid property names", async () => {
    const { M } = await tester.compile(t.code`model ${t.model("M")} { \`$prop$\`: string }`);

    const engine = createGraphQLMutationEngine(tester.program);
    const mutated = engine.mutate(M).getMutatedType();

    // Check that the property was renamed in the mutated model
    expect(mutated.properties.has("_prop_")).toBe(true);
    expect(mutated.properties.has("$prop$")).toBe(false);
  });
});

describe("GraphQL Mutation Engine - Operations", () => {
  let tester: Awaited<ReturnType<typeof Tester.createInstance>>;
  beforeEach(async () => {
    tester = await Tester.createInstance();
  });

  it("leaves valid operation names alone", async () => {
    const { ValidOp } = await tester.compile(t.code`op ${t.op("ValidOp")}(): void;`);

    const engine = createGraphQLMutationEngine(tester.program);
    const mutated = engine.mutate(ValidOp).getMutatedType();

    expect(mutated.name).toBe("ValidOp");
  });

  it("renames invalid operation names", async () => {
    const { Iface } = await tester.compile(
      t.code`interface ${t.interface("Iface")} { \`$Do$\`(): void; }`,
    );

    const engine = createGraphQLMutationEngine(tester.program);
    const mutated = engine.mutate(Iface).getMutatedType();

    // Check that the operation was renamed in the mutated interface
    expect(mutated.operations.has("_Do_")).toBe(true);
    expect(mutated.operations.has("$Do$")).toBe(false);
  });

  it("renames operation names with hyphens", async () => {
    const { Iface } = await tester.compile(
      t.code`interface ${t.interface("Iface")} { \`get-data\`(): void; }`,
    );

    const engine = createGraphQLMutationEngine(tester.program);
    const mutated = engine.mutate(Iface).getMutatedType();

    expect(mutated.operations.has("get_data")).toBe(true);
    expect(mutated.operations.has("get-data")).toBe(false);
  });
});

describe("GraphQL Mutation Engine - Scalars", () => {
  let tester: Awaited<ReturnType<typeof Tester.createInstance>>;
  beforeEach(async () => {
    tester = await Tester.createInstance();
  });

  it("leaves valid scalar names alone", async () => {
    const { ValidScalar } = await tester.compile(
      t.code`scalar ${t.scalar("ValidScalar")} extends string;`,
    );

    const engine = createGraphQLMutationEngine(tester.program);
    const mutated = engine.mutate(ValidScalar).getMutatedType();

    expect(mutated.name).toBe("ValidScalar");
  });

  it("renames invalid scalar names", async () => {
    await tester.compile(
      t.code`scalar ${t.scalar("$Invalid$")} extends string;`,
    );

    const InvalidScalar = tester.program.getGlobalNamespaceType().scalars.get("$Invalid$")!;
    const engine = createGraphQLMutationEngine(tester.program);
    const mutated = engine.mutate(InvalidScalar).getMutatedType();

    expect(mutated.name).toBe("_Invalid_");
  });
});

describe("GraphQL Mutation Engine - Edge Cases", () => {
  let tester: Awaited<ReturnType<typeof Tester.createInstance>>;
  beforeEach(async () => {
    tester = await Tester.createInstance();
  });

  it("handles model with multiple invalid properties", async () => {
    const { M } = await tester.compile(
      t.code`model ${t.model("M")} { 
        \`$prop1$\`: string;
        \`prop-2\`: int32;
        \`prop.3\`: boolean;
      }`,
    );

    const engine = createGraphQLMutationEngine(tester.program);
    const mutated = engine.mutate(M).getMutatedType();

    expect(mutated.properties.has("_prop1_")).toBe(true);
    expect(mutated.properties.has("prop_2")).toBe(true);
    expect(mutated.properties.has("prop_3")).toBe(true);
    expect(mutated.properties.has("$prop1$")).toBe(false);
    expect(mutated.properties.has("prop-2")).toBe(false);
    expect(mutated.properties.has("prop.3")).toBe(false);
  });

  it("handles enum with multiple invalid members", async () => {
    const { E } = await tester.compile(
      t.code`enum ${t.enum("E")} {
        \`$val1$\`,
        \`val-2\`,
        \`val.3\`
      }`,
    );

    const engine = createGraphQLMutationEngine(tester.program);
    const mutated = engine.mutate(E).getMutatedType();

    expect(mutated.members.has("_val1_")).toBe(true);
    expect(mutated.members.has("val_2")).toBe(true);
    expect(mutated.members.has("val_3")).toBe(true);
  });

  it("handles interface with multiple invalid operations", async () => {
    const { Api } = await tester.compile(
      t.code`interface ${t.interface("Api")} {
        \`get-user\`(): void;
        \`create-user\`(): void;
        \`delete.user\`(): void;
      }`,
    );

    const engine = createGraphQLMutationEngine(tester.program);
    const mutated = engine.mutate(Api).getMutatedType();

    expect(mutated.operations.has("get_user")).toBe(true);
    expect(mutated.operations.has("create_user")).toBe(true);
    expect(mutated.operations.has("delete_user")).toBe(true);
  });

  it("preserves valid underscore-prefixed names", async () => {
    const { _ValidName } = await tester.compile(t.code`model ${t.model("_ValidName")} { }`);

    const engine = createGraphQLMutationEngine(tester.program);
    const mutated = engine.mutate(_ValidName).getMutatedType();

    expect(mutated.name).toBe("_ValidName");
  });

  it("preserves names with numbers in the middle", async () => {
    const { Model123 } = await tester.compile(t.code`model ${t.model("Model123")} { }`);

    const engine = createGraphQLMutationEngine(tester.program);
    const mutated = engine.mutate(Model123).getMutatedType();

    expect(mutated.name).toBe("Model123");
  });

  it("handles property names starting with numbers", async () => {
    const { M } = await tester.compile(t.code`model ${t.model("M")} { \`123prop\`: string; }`);

    const engine = createGraphQLMutationEngine(tester.program);
    const mutated = engine.mutate(M).getMutatedType();

    expect(mutated.properties.has("_123prop")).toBe(true);
    expect(mutated.properties.has("123prop")).toBe(false);
  });

  it("handles enum member names starting with numbers", async () => {
    const { E } = await tester.compile(t.code`enum ${t.enum("E")} { \`123value\` }`);

    const engine = createGraphQLMutationEngine(tester.program);
    const mutated = engine.mutate(E).getMutatedType();

    expect(mutated.members.has("_123value")).toBe(true);
    expect(mutated.members.has("123value")).toBe(false);
  });

  it("handles operation names starting with numbers", async () => {
    const { Api } = await tester.compile(
      t.code`interface ${t.interface("Api")} { \`123action\`(): void; }`,
    );

    const engine = createGraphQLMutationEngine(tester.program);
    const mutated = engine.mutate(Api).getMutatedType();

    expect(mutated.operations.has("_123action")).toBe(true);
    expect(mutated.operations.has("123action")).toBe(false);
  });
});

