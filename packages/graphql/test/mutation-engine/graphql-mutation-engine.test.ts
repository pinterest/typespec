import type { EnumMember } from "@typespec/compiler";
import { t } from "@typespec/compiler/testing";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createGraphQLMutationEngine,
  GraphQLTypeContext,
} from "../../src/mutation-engine/index.js";
import { Tester } from "../test-host.js";

function createTestEngine(program: Parameters<typeof createGraphQLMutationEngine>[0]) {
  return createGraphQLMutationEngine(program);
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
    const mutation = engine.mutateModel(ValidModel);

    expect(mutation.mutatedType.name).toBe("ValidModel");
  });

  it("renames invalid model names", async () => {
    await tester.compile(t.code`model ${t.model("$Invalid$")} { }`);

    const InvalidModel = tester.program.getGlobalNamespaceType().models.get("$Invalid$")!;
    const engine = createTestEngine(tester.program);
    const mutation = engine.mutateModel(InvalidModel);

    expect(mutation.mutatedType.name).toBe("_Invalid_");
  });

  it("processes model properties through sanitization", async () => {
    const { TestModel } = await tester.compile(
      t.code`model ${t.model("TestModel")} { validProp: string }`,
    );

    const engine = createTestEngine(tester.program);
    const mutation = engine.mutateModel(TestModel);

    expect(mutation.mutatedType.name).toBe("TestModel");
    expect(mutation.mutatedType.properties.has("validProp")).toBe(true);
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
    const mutation = engine.mutateModel(M);
    const prop = mutation.mutatedType.properties.get("prop");

    expect(prop?.name).toBe("prop");
  });

  it("renames invalid property names", async () => {
    const { M } = await tester.compile(t.code`model ${t.model("M")} { \`$prop$\`: string }`);

    const engine = createTestEngine(tester.program);
    const mutation = engine.mutateModel(M);

    // Check that the property was renamed in the mutated model
    expect(mutation.mutatedType.properties.has("_prop_")).toBe(true);
    expect(mutation.mutatedType.properties.has("$prop$")).toBe(false);
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
    const mutation = engine.mutateModel(M);
    const mutated = mutation.mutatedType;

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

    const engine = createTestEngine(tester.program);
    const mutated = engine.mutateEnum(E).mutatedType;

    expect(mutated.members.has("_val1_")).toBe(true);
    expect(mutated.members.has("val_2")).toBe(true);
    expect(mutated.members.has("val_3")).toBe(true);
  });

  it("preserves valid underscore-prefixed names", async () => {
    const { _ValidName } = await tester.compile(t.code`model ${t.model("_ValidName")} { }`);

    const engine = createTestEngine(tester.program);
    const mutation = engine.mutateModel(_ValidName);

    expect(mutation.mutatedType.name).toBe("_ValidName");
  });

  it("preserves names with numbers in the middle", async () => {
    const { Model123 } = await tester.compile(t.code`model ${t.model("Model123")} { }`);

    const engine = createTestEngine(tester.program);
    const mutation = engine.mutateModel(Model123);

    expect(mutation.mutatedType.name).toBe("Model123");
  });

  it("handles property names starting with numbers", async () => {
    const { M } = await tester.compile(t.code`model ${t.model("M")} { \`123prop\`: string; }`);

    const engine = createTestEngine(tester.program);
    const mutation = engine.mutateModel(M);
    const mutated = mutation.mutatedType;

    expect(mutated.properties.has("_123prop")).toBe(true);
    expect(mutated.properties.has("123prop")).toBe(false);
  });

  it("handles enum member names starting with numbers", async () => {
    const { E } = await tester.compile(t.code`enum ${t.enum("E")} { \`123value\` }`);

    const engine = createTestEngine(tester.program);
    const mutated = engine.mutateEnum(E).mutatedType;

    expect(mutated.members.has("_123value")).toBe(true);
    expect(mutated.members.has("123value")).toBe(false);
  });
});

describe("GraphQL Mutation Engine - Unions", () => {
  let tester: Awaited<ReturnType<typeof Tester.createInstance>>;
  beforeEach(async () => {
    tester = await Tester.createInstance();
  });

  it("skips wrapper creation for nullable unions", async () => {
    const { NullableString } = await tester.compile(
      t.code`union ${t.union("NullableString")} { string, null }`,
    );

    const engine = createTestEngine(tester.program);
    const mutation = engine.mutateUnion(NullableString);

    expect(mutation.wrapperModels).toHaveLength(0);
  });

  it("creates wrapper models for scalar variants", async () => {
    const { Mixed } = await tester.compile(
      t.code`
        model ${t.model("Cat")} { name: string; }
        union ${t.union("Mixed")} { cat: Cat; text: string; }
      `,
    );

    const engine = createTestEngine(tester.program);
    const mutation = engine.mutateUnion(Mixed);

    // Only the scalar variant (string) should get a wrapper
    expect(mutation.wrapperModels).toHaveLength(1);
    expect(mutation.wrapperModels[0].name).toBe("MixedTextUnionVariant");
  });

  it("does not create wrappers for model-only unions", async () => {
    const { Pet } = await tester.compile(
      t.code`
        model ${t.model("Cat")} { name: string; }
        model ${t.model("Dog")} { breed: string; }
        union ${t.union("Pet")} { cat: Cat; dog: Dog; }
      `,
    );

    const engine = createTestEngine(tester.program);
    const mutation = engine.mutateUnion(Pet);

    expect(mutation.wrapperModels).toHaveLength(0);
  });

  it("wrapper model has value property with the scalar type", async () => {
    const { Data } = await tester.compile(
      t.code`union ${t.union("Data")} { text: string; }`,
    );

    const engine = createTestEngine(tester.program);
    const mutation = engine.mutateUnion(Data);

    expect(mutation.wrapperModels).toHaveLength(1);
    const wrapper = mutation.wrapperModels[0];
    const valueProp = wrapper.properties.get("value");
    expect(valueProp).toBeDefined();
    expect(valueProp!.optional).toBe(false);
  });

  it("creates wrappers for multiple scalar variants", async () => {
    const { Mixed } = await tester.compile(
      t.code`
        model ${t.model("Cat")} { name: string; }
        union ${t.union("Mixed")} { cat: Cat; text: string; count: int32; }
      `,
    );

    const engine = createTestEngine(tester.program);
    const mutation = engine.mutateUnion(Mixed);

    expect(mutation.wrapperModels).toHaveLength(2);
    const names = mutation.wrapperModels.map((m) => m.name).sort();
    expect(names).toEqual(["MixedCountUnionVariant", "MixedTextUnionVariant"]);
  });

  it("sanitizes union name in mutated type", async () => {
    const { ValidUnion } = await tester.compile(
      t.code`
        model ${t.model("Cat")} { name: string; }
        model ${t.model("Dog")} { breed: string; }
        union ${t.union("ValidUnion")} { cat: Cat; dog: Dog; }
      `,
    );

    const engine = createTestEngine(tester.program);
    const mutation = engine.mutateUnion(ValidUnion);

    expect(mutation.mutatedType.name).toBe("ValidUnion");
  });
});

describe("GraphQL Mutation Engine - Input/Output Context", () => {
  let tester: Awaited<ReturnType<typeof Tester.createInstance>>;
  beforeEach(async () => {
    tester = await Tester.createInstance();
  });

  it("produces separate mutations for input and output contexts", async () => {
    const { Book } = await tester.compile(
      t.code`model ${t.model("Book")} { title: string; }`,
    );

    const engine = createTestEngine(tester.program);
    const inputMutation = engine.mutateModelAs(Book, GraphQLTypeContext.Input);
    const outputMutation = engine.mutateModelAs(Book, GraphQLTypeContext.Output);

    // Different mutation objects (different cache entries)
    expect(inputMutation).not.toBe(outputMutation);
    // Both produce valid mutated types
    expect(inputMutation.mutatedType.name).toBe("Book");
    expect(outputMutation.mutatedType.name).toBe("Book");
  });

  it("returns cached mutation for same type and context", async () => {
    const { Book } = await tester.compile(
      t.code`model ${t.model("Book")} { title: string; }`,
    );

    const engine = createTestEngine(tester.program);
    const first = engine.mutateModelAs(Book, GraphQLTypeContext.Input);
    const second = engine.mutateModelAs(Book, GraphQLTypeContext.Input);

    expect(first).toBe(second);
  });

  it("exposes typeContext on the mutation", async () => {
    const { Book } = await tester.compile(
      t.code`model ${t.model("Book")} { title: string; }`,
    );

    const engine = createTestEngine(tester.program);
    const inputMutation = engine.mutateModelAs(Book, GraphQLTypeContext.Input);
    const outputMutation = engine.mutateModelAs(Book, GraphQLTypeContext.Output);

    expect(inputMutation.typeContext).toBe(GraphQLTypeContext.Input);
    expect(outputMutation.typeContext).toBe(GraphQLTypeContext.Output);
  });

  it("has no typeContext when mutated without explicit context", async () => {
    const { Book } = await tester.compile(
      t.code`model ${t.model("Book")} { title: string; }`,
    );

    const engine = createTestEngine(tester.program);
    const mutation = engine.mutateModel(Book);

    expect(mutation.typeContext).toBeUndefined();
  });
});

describe("GraphQL Mutation Engine - Operation Context Propagation", () => {
  let tester: Awaited<ReturnType<typeof Tester.createInstance>>;
  beforeEach(async () => {
    tester = await Tester.createInstance();
  });

  it("mutates operation parameters with input context", async () => {
    const { Book, createBook } = await tester.compile(
      t.code`
        model ${t.model("Book")} { title: string; }
        op ${t.op("createBook")}(input: Book): void;
      `,
    );

    const engine = createTestEngine(tester.program);
    engine.mutateOperation(createBook);

    // The model should now be cached under the input key
    const inputMutation = engine.mutateModelAs(Book, GraphQLTypeContext.Input);
    expect(inputMutation.typeContext).toBe(GraphQLTypeContext.Input);
  });

  it("mutates operation return type with output context", async () => {
    const { Book, getBook } = await tester.compile(
      t.code`
        model ${t.model("Book")} { title: string; }
        op ${t.op("getBook")}(): Book;
      `,
    );

    const engine = createTestEngine(tester.program);
    engine.mutateOperation(getBook);

    // The model should now be cached under the output key
    const outputMutation = engine.mutateModelAs(Book, GraphQLTypeContext.Output);
    expect(outputMutation.typeContext).toBe(GraphQLTypeContext.Output);
  });

  it("creates separate variants when model is used as both param and return", async () => {
    const { Book, createBook } = await tester.compile(
      t.code`
        model ${t.model("Book")} { title: string; }
        op ${t.op("createBook")}(input: Book): Book;
      `,
    );

    const engine = createTestEngine(tester.program);
    engine.mutateOperation(createBook);

    const inputMutation = engine.mutateModelAs(Book, GraphQLTypeContext.Input);
    const outputMutation = engine.mutateModelAs(Book, GraphQLTypeContext.Output);

    expect(inputMutation).not.toBe(outputMutation);
    expect(inputMutation.typeContext).toBe(GraphQLTypeContext.Input);
    expect(outputMutation.typeContext).toBe(GraphQLTypeContext.Output);
  });

  it("propagates input context to nested models", async () => {
    const { Author, createBook } = await tester.compile(
      t.code`
        model ${t.model("Author")} { name: string; }
        model ${t.model("Book")} { title: string; author: Author; }
        op ${t.op("createBook")}(input: Book): void;
      `,
    );

    const engine = createTestEngine(tester.program);
    engine.mutateOperation(createBook);

    // Author should also be cached under input context via Book's property
    const authorInput = engine.mutateModelAs(Author, GraphQLTypeContext.Input);
    expect(authorInput.typeContext).toBe(GraphQLTypeContext.Input);
  });

  it("propagates output context to nested models", async () => {
    const { Author, getBook } = await tester.compile(
      t.code`
        model ${t.model("Author")} { name: string; }
        model ${t.model("Book")} { title: string; author: Author; }
        op ${t.op("getBook")}(): Book;
      `,
    );

    const engine = createTestEngine(tester.program);
    engine.mutateOperation(getBook);

    const authorOutput = engine.mutateModelAs(Author, GraphQLTypeContext.Output);
    expect(authorOutput.typeContext).toBe(GraphQLTypeContext.Output);
  });
});
