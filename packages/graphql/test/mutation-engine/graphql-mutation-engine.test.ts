import type { EnumMember } from "@typespec/compiler";
import { t } from "@typespec/compiler/testing";
import { beforeEach, describe, expect, it } from "vitest";
import { createGraphQLMutationEngine } from "../../src/mutation-engine/index.js";
import { Tester } from "../test-host.js";

/**
 * Helper to create the engine with the global namespace.
 * For unit tests, we use the global namespace since individual types
 * aren't placed in a custom namespace.
 */
function createTestEngine(program: Parameters<typeof createGraphQLMutationEngine>[0]) {
  return createGraphQLMutationEngine(program, program.getGlobalNamespaceType());
}

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

    const engine = createTestEngine(tester.program);
    const mutated = engine.mutateEnum(ValidEnum).mutatedType;

    expect(mutated.name).toBe("ValidEnum");
  });

  it("renames invalid enum names", async () => {
    await tester.compile(
      t.code`enum ${t.enum("$Invalid$")} {
        Value
      }`,
    );

    const InvalidEnum = tester.program.getGlobalNamespaceType().enums.get("$Invalid$")!;
    const engine = createTestEngine(tester.program);
    const mutated = engine.mutateEnum(InvalidEnum).mutatedType;

    expect(mutated.name).toBe("_Invalid_");
  });

  it("processes enum members through sanitization", async () => {
    const { MyEnum } = await tester.compile(
      t.code`enum ${t.enum("MyEnum")} {
        ValidMember
      }`,
    );

    const engine = createTestEngine(tester.program);
    const mutated = engine.mutateEnum(MyEnum).mutatedType;

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
    const { MyEnum } = await tester.compile(
      t.code`enum ${t.enum("MyEnum")} {
        ${t.enumMember("ValidMember")}
      }`,
    );

    // Mutate the enum and check the member via the enum's mutation
    const engine = createTestEngine(tester.program);
    const mutated = engine.mutateEnum(MyEnum).mutatedType;
    const member = mutated.members.get("ValidMember");

    expect(member?.name).toBe("ValidMember");
  });

  it("renames invalid enum member names", async () => {
    const { MyEnum } = await tester.compile(
      t.code`enum ${t.enum("MyEnum")} {
        \`$Value$\`
      }`,
    );

    const engine = createTestEngine(tester.program);
    const mutated = engine.mutateEnum(MyEnum).mutatedType;

    // Check that the member was renamed in the mutated enum
    const member = Array.from(mutated.members.values())[0] as EnumMember;
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

    const engine = createTestEngine(tester.program);
    const result = engine.mutateModel(ValidModel);

    // Without operations, models default to output variant
    expect(result.output?.mutatedType.name).toBe("ValidModel");
  });

  it("renames invalid model names", async () => {
    await tester.compile(t.code`model ${t.model("$Invalid$")} { }`);

    const InvalidModel = tester.program.getGlobalNamespaceType().models.get("$Invalid$")!;
    const engine = createTestEngine(tester.program);
    const result = engine.mutateModel(InvalidModel);

    expect(result.output?.mutatedType.name).toBe("_Invalid_");
  });

  it("processes model properties through sanitization", async () => {
    const { TestModel } = await tester.compile(
      t.code`model ${t.model("TestModel")} { validProp: string }`,
    );

    const engine = createTestEngine(tester.program);
    const result = engine.mutateModel(TestModel);

    expect(result.output?.mutatedType.name).toBe("TestModel");
    expect(result.output?.mutatedType.properties.has("validProp")).toBe(true);
  });
});

describe("GraphQL Mutation Engine - Model Properties", () => {
  let tester: Awaited<ReturnType<typeof Tester.createInstance>>;
  beforeEach(async () => {
    tester = await Tester.createInstance();
  });

  it("leaves valid property names alone", async () => {
    const { M } = await tester.compile(
      t.code`model ${t.model("M")} { ${t.modelProperty("prop")}: string }`,
    );

    const engine = createTestEngine(tester.program);
    const result = engine.mutateModel(M);
    const prop = result.output?.mutatedType.properties.get("prop");

    expect(prop?.name).toBe("prop");
  });

  it("renames invalid property names", async () => {
    const { M } = await tester.compile(t.code`model ${t.model("M")} { \`$prop$\`: string }`);

    const engine = createTestEngine(tester.program);
    const result = engine.mutateModel(M);

    // Check that the property was renamed in the mutated model
    expect(result.output?.mutatedType.properties.has("_prop_")).toBe(true);
    expect(result.output?.mutatedType.properties.has("$prop$")).toBe(false);
  });
});

describe("GraphQL Mutation Engine - Operations", () => {
  let tester: Awaited<ReturnType<typeof Tester.createInstance>>;
  beforeEach(async () => {
    tester = await Tester.createInstance();
  });

  it("leaves valid operation names alone", async () => {
    const { ValidOp } = await tester.compile(t.code`op ${t.op("ValidOp")}(): void;`);

    const engine = createTestEngine(tester.program);
    const mutation = engine.mutateOperation(ValidOp);

    expect(mutation.mutatedType.name).toBe("ValidOp");
  });

  it("renames invalid operation names", async () => {
    await tester.compile(t.code`op ${t.op("$Do$")}(): void;`);

    const DoOp = tester.program.getGlobalNamespaceType().operations.get("$Do$")!;
    const engine = createTestEngine(tester.program);
    const mutation = engine.mutateOperation(DoOp);

    expect(mutation.mutatedType.name).toBe("_Do_");
  });

  it("renames operation names with hyphens", async () => {
    await tester.compile(t.code`op \`get-data\`(): void;`);

    const GetDataOp = tester.program.getGlobalNamespaceType().operations.get("get-data")!;
    const engine = createTestEngine(tester.program);
    const mutation = engine.mutateOperation(GetDataOp);

    expect(mutation.mutatedType.name).toBe("get_data");
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

    const engine = createTestEngine(tester.program);
    const mutation = engine.mutateScalar(ValidScalar);

    expect(mutation.mutatedType.name).toBe("ValidScalar");
  });

  it("renames invalid scalar names", async () => {
    await tester.compile(t.code`scalar ${t.scalar("$Invalid$")} extends string;`);

    const InvalidScalar = tester.program.getGlobalNamespaceType().scalars.get("$Invalid$")!;
    const engine = createTestEngine(tester.program);
    const mutation = engine.mutateScalar(InvalidScalar);

    expect(mutation.mutatedType.name).toBe("_Invalid_");
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

    const engine = createTestEngine(tester.program);
    const result = engine.mutateModel(M);
    const mutated = result.output?.mutatedType;

    expect(mutated?.properties.has("_prop1_")).toBe(true);
    expect(mutated?.properties.has("prop_2")).toBe(true);
    expect(mutated?.properties.has("prop_3")).toBe(true);
    expect(mutated?.properties.has("$prop1$")).toBe(false);
    expect(mutated?.properties.has("prop-2")).toBe(false);
    expect(mutated?.properties.has("prop.3")).toBe(false);
  });

  it("handles enum with multiple invalid members", async () => {
    const { E } = await tester.compile(
      t.code`enum ${t.enum("E")} {
        \`$val1$\`,
        \`val-2\`,
        \`val.3\`
      }`,
    );

    const engine = createTestEngine(tester.program);
    const mutated = engine.mutateEnum(E).mutatedType;

    expect(mutated.members.has("_val1_")).toBe(true);
    expect(mutated.members.has("val_2")).toBe(true);
    expect(mutated.members.has("val_3")).toBe(true);
  });

  it("preserves valid underscore-prefixed names", async () => {
    const { _ValidName } = await tester.compile(t.code`model ${t.model("_ValidName")} { }`);

    const engine = createTestEngine(tester.program);
    const result = engine.mutateModel(_ValidName);

    expect(result.output?.mutatedType.name).toBe("_ValidName");
  });

  it("preserves names with numbers in the middle", async () => {
    const { Model123 } = await tester.compile(t.code`model ${t.model("Model123")} { }`);

    const engine = createTestEngine(tester.program);
    const result = engine.mutateModel(Model123);

    expect(result.output?.mutatedType.name).toBe("Model123");
  });

  it("handles property names starting with numbers", async () => {
    const { M } = await tester.compile(t.code`model ${t.model("M")} { \`123prop\`: string; }`);

    const engine = createTestEngine(tester.program);
    const result = engine.mutateModel(M);
    const mutated = result.output?.mutatedType;

    expect(mutated?.properties.has("_123prop")).toBe(true);
    expect(mutated?.properties.has("123prop")).toBe(false);
  });

  it("handles enum member names starting with numbers", async () => {
    const { E } = await tester.compile(t.code`enum ${t.enum("E")} { \`123value\` }`);

    const engine = createTestEngine(tester.program);
    const mutated = engine.mutateEnum(E).mutatedType;

    expect(mutated.members.has("_123value")).toBe(true);
    expect(mutated.members.has("123value")).toBe(false);
  });
});

describe("GraphQL Mutation Engine - Input/Output Splitting", () => {
  let tester: Awaited<ReturnType<typeof Tester.createInstance>>;
  beforeEach(async () => {
    tester = await Tester.createInstance();
  });

  it("creates input variant for models used as operation parameters", async () => {
    const { Person } = await tester.compile(
      t.code`
        model ${t.model("Person")} { name: string }
        op createPerson(person: Person): void;
      `,
    );

    const engine = createTestEngine(tester.program);
    const result = engine.mutateModel(Person);

    // Should have input variant with "Input" suffix
    expect(result.input?.mutatedType.name).toBe("PersonInput");
  });

  it("creates output variant for models used as return types", async () => {
    const { Person } = await tester.compile(
      t.code`
        model ${t.model("Person")} { name: string }
        op getPerson(): Person;
      `,
    );

    const engine = createTestEngine(tester.program);
    const result = engine.mutateModel(Person);

    // Should have output variant without suffix
    expect(result.output?.mutatedType.name).toBe("Person");
    // Should not have input variant
    expect(result.input).toBeUndefined();
  });

  it("creates both variants for models used as both input and output", async () => {
    const { Person } = await tester.compile(
      t.code`
        model ${t.model("Person")} { name: string }
        op getPerson(): Person;
        op updatePerson(person: Person): void;
      `,
    );

    const engine = createTestEngine(tester.program);
    const result = engine.mutateModel(Person);

    // Should have both variants
    expect(result.output?.mutatedType.name).toBe("Person");
    expect(result.input?.mutatedType.name).toBe("PersonInput");
  });

  it("applies name sanitization to input variants", async () => {
    await tester.compile(
      t.code`
        model \`$Invalid$\` { name: string }
        op create(data: \`$Invalid$\`): void;
      `,
    );

    const InvalidModel = tester.program.getGlobalNamespaceType().models.get("$Invalid$")!;
    const engine = createTestEngine(tester.program);
    const result = engine.mutateModel(InvalidModel);

    // Should sanitize name AND add Input suffix
    expect(result.input?.mutatedType.name).toBe("_Invalid_Input");
  });

  it("defaults to output variant when no operations reference the model", async () => {
    const { Standalone } = await tester.compile(t.code`model ${t.model("Standalone")} { }`);

    const engine = createTestEngine(tester.program);
    const result = engine.mutateModel(Standalone);

    // Should only have output variant
    expect(result.output?.mutatedType.name).toBe("Standalone");
    expect(result.input).toBeUndefined();
  });
});
