import type { EnumMember, Model, Union } from "@typespec/compiler";
import { t } from "@typespec/compiler/testing";
import { beforeEach, describe, expect, it } from "vitest";
import { isNullable } from "../../src/lib/nullable.js";
import { isOneOf } from "../../src/lib/one-of.js";
import { getSpecifiedBy } from "../../src/lib/specified-by.js";
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
    const mutation = engine.mutateModel(ValidModel, GraphQLTypeContext.Output);

    expect(mutation.mutatedType.name).toBe("ValidModel");
  });

  it("renames invalid model names", async () => {
    await tester.compile(t.code`model ${t.model("$Invalid$")} { }`);

    const InvalidModel = tester.program.getGlobalNamespaceType().models.get("$Invalid$")!;
    const engine = createTestEngine(tester.program);
    const mutation = engine.mutateModel(InvalidModel, GraphQLTypeContext.Output);

    expect(mutation.mutatedType.name).toBe("_Invalid_");
  });

  it("processes model properties through sanitization", async () => {
    const { TestModel } = await tester.compile(
      t.code`model ${t.model("TestModel")} { validProp: string }`,
    );

    const engine = createTestEngine(tester.program);
    const mutation = engine.mutateModel(TestModel, GraphQLTypeContext.Output);

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
    const mutation = engine.mutateModel(M, GraphQLTypeContext.Output);
    const prop = mutation.mutatedType.properties.get("prop");

    expect(prop?.name).toBe("prop");
  });

  it("renames invalid property names", async () => {
    const { M } = await tester.compile(t.code`model ${t.model("M")} { \`$prop$\`: string }`);

    const engine = createTestEngine(tester.program);
    const mutation = engine.mutateModel(M, GraphQLTypeContext.Output);

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

  it("has no @specifiedBy when decorator is not applied", async () => {
    const { MyScalar } = await tester.compile(
      t.code`scalar ${t.scalar("MyScalar")} extends string;`,
    );

    const engine = createTestEngine(tester.program);
    const mutation = engine.mutateScalar(MyScalar);

    expect(getSpecifiedBy(tester.program, mutation.mutatedType)).toBeUndefined();
  });

  it("applies @specifiedBy from decorator to mutated scalar", async () => {
    const { MyScalar } = await tester.compile(
      t.code`
        @specifiedBy("https://example.com/my-scalar-spec")
        scalar ${t.scalar("MyScalar")} extends string;
      `,
    );

    const engine = createTestEngine(tester.program);
    const mutation = engine.mutateScalar(MyScalar);

    expect(getSpecifiedBy(tester.program, mutation.mutatedType)).toBe("https://example.com/my-scalar-spec");
  });

  it("inherits @specifiedBy from mapped ancestor via extends chain", async () => {
    const { MyDate } = await tester.compile(
      t.code`
        @encode("rfc3339")
        scalar ${t.scalar("MyDate")} extends utcDateTime;
      `,
    );

    const engine = createTestEngine(tester.program);
    const mutation = engine.mutateScalar(MyDate);

    // User-defined name is preserved (sanitized), not replaced with mapping's graphqlName
    expect(mutation.mutatedType.name).toBe("MyDate");
    // @specifiedBy inherited from utcDateTime's rfc3339 mapping
    expect(getSpecifiedBy(tester.program, mutation.mutatedType)).toBe(
      "https://scalars.graphql.org/chillicream/date-time.html",
    );
  });

  it("strips baseScalar from user-defined scalars", async () => {
    const { MyScalar } = await tester.compile(
      t.code`scalar ${t.scalar("MyScalar")} extends string;`,
    );

    const engine = createTestEngine(tester.program);
    const mutation = engine.mutateScalar(MyScalar);

    expect(mutation.mutatedType.baseScalar).toBeUndefined();
  });

  it("explicit @specifiedBy wins over inherited mapping", async () => {
    const { MyDate } = await tester.compile(
      t.code`
        @encode("rfc3339")
        @specifiedBy("https://example.com/custom-spec")
        scalar ${t.scalar("MyDate")} extends utcDateTime;
      `,
    );

    const engine = createTestEngine(tester.program);
    const mutation = engine.mutateScalar(MyDate);

    expect(getSpecifiedBy(tester.program, mutation.mutatedType)).toBe(
      "https://example.com/custom-spec",
    );
  });

  it("maps scalar extending GraphQL.ID to built-in ID type", async () => {
    const { MyId } = await tester.compile(
      t.code`scalar ${t.scalar("MyId")} extends GraphQL.ID;`,
    );

    const engine = createTestEngine(tester.program);
    const mutation = engine.mutateScalar(MyId);

    expect(mutation.mutatedType.name).toBe("ID");
  });

  it("maps multi-hop extends chain through GraphQL.ID to built-in ID type", async () => {
    const { SubId } = await tester.compile(
      t.code`
        scalar MyId extends GraphQL.ID;
        scalar ${t.scalar("SubId")} extends MyId;
      `,
    );

    const engine = createTestEngine(tester.program);
    const mutation = engine.mutateScalar(SubId);

    expect(mutation.mutatedType.name).toBe("ID");
  });

  it("does not rename builtin std scalars even when they inherit a mapping", async () => {
    // float32 inherits a mapping via float → numeric → "Numeric", but it's a
    // GraphQL builtin (maps to Float) and must never be renamed.
    const { M } = await tester.compile(
      t.code`model ${t.model("M")} { value: float32; }`,
    );

    const engine = createTestEngine(tester.program);
    const float32Scalar = M.properties.get("value")!.type;
    expect(float32Scalar.kind).toBe("Scalar");
    const mutation = engine.mutateScalar(float32Scalar as any);

    expect(mutation.mutatedType.name).toBe("float32");
  });

  it("does not rename float64 builtin scalar", async () => {
    const { M } = await tester.compile(
      t.code`model ${t.model("M")} { value: float64; }`,
    );

    const engine = createTestEngine(tester.program);
    const float64Scalar = M.properties.get("value")!.type;
    expect(float64Scalar.kind).toBe("Scalar");
    const mutation = engine.mutateScalar(float64Scalar as any);

    expect(mutation.mutatedType.name).toBe("float64");
  });

  it("does not rename int32 builtin scalar", async () => {
    const { M } = await tester.compile(
      t.code`model ${t.model("M")} { count: int32; }`,
    );

    const engine = createTestEngine(tester.program);
    const int32Scalar = M.properties.get("count")!.type;
    expect(int32Scalar.kind).toBe("Scalar");
    const mutation = engine.mutateScalar(int32Scalar as any);

    expect(mutation.mutatedType.name).toBe("int32");
  });

  it("still renames mapped non-builtin std scalars like int64", async () => {
    const { M } = await tester.compile(
      t.code`model ${t.model("M")} { big: int64; }`,
    );

    const engine = createTestEngine(tester.program);
    const int64Scalar = M.properties.get("big")!.type;
    expect(int64Scalar.kind).toBe("Scalar");
    const mutation = engine.mutateScalar(int64Scalar as any);

    expect(mutation.mutatedType.name).toBe("Long");
  });

  it("warns when user-defined scalar collides with GraphQL built-in name", async () => {
    const { Float } = await tester.compile(
      t.code`scalar ${t.scalar("Float")} extends string;`,
    );

    const engine = createTestEngine(tester.program);
    engine.mutateScalar(Float);

    const warnings = tester.program.diagnostics.filter(
      (d) => d.code === "@typespec/graphql/graphql-builtin-scalar-collision",
    );
    expect(warnings.length).toBe(1);
    expect(warnings[0].message).toContain("Float");
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
    const mutation = engine.mutateModel(M, GraphQLTypeContext.Output);
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
    const mutation = engine.mutateModel(_ValidName, GraphQLTypeContext.Output);

    expect(mutation.mutatedType.name).toBe("_ValidName");
  });

  it("preserves names with numbers in the middle", async () => {
    const { Model123 } = await tester.compile(t.code`model ${t.model("Model123")} { }`);

    const engine = createTestEngine(tester.program);
    const mutation = engine.mutateModel(Model123, GraphQLTypeContext.Output);

    expect(mutation.mutatedType.name).toBe("Model123");
  });

  it("handles property names starting with numbers", async () => {
    const { M } = await tester.compile(t.code`model ${t.model("M")} { \`123prop\`: string; }`);

    const engine = createTestEngine(tester.program);
    const mutation = engine.mutateModel(M, GraphQLTypeContext.Output);
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
    const mutation = engine.mutateUnion(NullableString, GraphQLTypeContext.Output);

    expect(mutation.wrapperModels).toHaveLength(0);
    expect(isNullable(tester.program, NullableString)).toBe(true);
  });

  it("skips union processing for nullable model wrapper", async () => {
    const { MaybeDog } = await tester.compile(
      t.code`
        model ${t.model("Dog")} { breed: string; }
        union ${t.union("MaybeDog")} { Dog, null }
      `,
    );

    const engine = createTestEngine(tester.program);
    const mutation = engine.mutateUnion(MaybeDog, GraphQLTypeContext.Output);

    // This is a nullable wrapper (Dog | null), not a real union —
    // it should pass through without union processing
    expect(mutation.mutatedType.kind).toBe("Union");
    expect(mutation.wrapperModels).toHaveLength(0);
    expect(isNullable(tester.program, MaybeDog)).toBe(true);
  });

  it("creates wrapper models for scalar variants", async () => {
    const { Mixed } = await tester.compile(
      t.code`
        model ${t.model("Cat")} { name: string; }
        union ${t.union("Mixed")} { cat: Cat; text: string; }
      `,
    );

    const engine = createTestEngine(tester.program);
    const mutation = engine.mutateUnion(Mixed, GraphQLTypeContext.Output);

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
    const mutation = engine.mutateUnion(Pet, GraphQLTypeContext.Output);

    expect(mutation.wrapperModels).toHaveLength(0);
  });

  it("wrapper model has value property with the scalar type", async () => {
    const { Data } = await tester.compile(
      t.code`union ${t.union("Data")} { text: string; }`,
    );

    const engine = createTestEngine(tester.program);
    const mutation = engine.mutateUnion(Data, GraphQLTypeContext.Output);

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
    const mutation = engine.mutateUnion(Mixed, GraphQLTypeContext.Output);

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
    const mutation = engine.mutateUnion(ValidUnion, GraphQLTypeContext.Output);

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
    const inputMutation = engine.mutateModel(Book, GraphQLTypeContext.Input);
    const outputMutation = engine.mutateModel(Book, GraphQLTypeContext.Output);

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
    const first = engine.mutateModel(Book, GraphQLTypeContext.Input);
    const second = engine.mutateModel(Book, GraphQLTypeContext.Input);

    expect(first).toBe(second);
  });

  it("exposes typeContext on the mutation", async () => {
    const { Book } = await tester.compile(
      t.code`model ${t.model("Book")} { title: string; }`,
    );

    const engine = createTestEngine(tester.program);
    const inputMutation = engine.mutateModel(Book, GraphQLTypeContext.Input);
    const outputMutation = engine.mutateModel(Book, GraphQLTypeContext.Output);

    expect(inputMutation.typeContext).toBe(GraphQLTypeContext.Input);
    expect(outputMutation.typeContext).toBe(GraphQLTypeContext.Output);
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
    const inputMutation = engine.mutateModel(Book, GraphQLTypeContext.Input);
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
    const outputMutation = engine.mutateModel(Book, GraphQLTypeContext.Output);
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

    const inputMutation = engine.mutateModel(Book, GraphQLTypeContext.Input);
    const outputMutation = engine.mutateModel(Book, GraphQLTypeContext.Output);

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
    const authorInput = engine.mutateModel(Author, GraphQLTypeContext.Input);
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

    const authorOutput = engine.mutateModel(Author, GraphQLTypeContext.Output);
    expect(authorOutput.typeContext).toBe(GraphQLTypeContext.Output);
  });

  it("replaces union parameter with oneOf model via operation mutation", async () => {
    const { Pet, createPet } = await tester.compile(
      t.code`
        model ${t.model("Cat")} { name: string; }
        model ${t.model("Dog")} { breed: string; }
        union ${t.union("Pet")} { cat: Cat; dog: Dog; }
        op ${t.op("createPet")}(input: Pet): void;
      `,
    );

    const engine = createTestEngine(tester.program);
    engine.mutateOperation(createPet);

    // The union should be cached under input context and replaced with a oneOf model
    const unionMutation = engine.mutateUnion(Pet, GraphQLTypeContext.Input);
    expect(unionMutation.mutatedType.kind).toBe("Model");
    expect(unionMutation.mutatedType.name).toBe("PetInput");
    expect(isOneOf(tester.program, unionMutation.mutatedType as Model)).toBe(true);
  });

  it("keeps union return type as union via operation mutation", async () => {
    const { Pet, getPet } = await tester.compile(
      t.code`
        model ${t.model("Cat")} { name: string; }
        model ${t.model("Dog")} { breed: string; }
        union ${t.union("Pet")} { cat: Cat; dog: Dog; }
        op ${t.op("getPet")}(): Pet;
      `,
    );

    const engine = createTestEngine(tester.program);
    engine.mutateOperation(getPet);

    // The union in output context stays a union (not replaced)
    const unionMutation = engine.mutateUnion(Pet, GraphQLTypeContext.Output);
    expect(unionMutation.mutatedType.kind).toBe("Union");
  });
});

describe("GraphQL Mutation Engine - oneOf Input Objects", () => {
  let tester: Awaited<ReturnType<typeof Tester.createInstance>>;
  beforeEach(async () => {
    tester = await Tester.createInstance();
  });

  it("replaces union with oneOf model in input context", async () => {
    const { Pet } = await tester.compile(
      t.code`
        model ${t.model("Cat")} { name: string; }
        model ${t.model("Dog")} { breed: string; }
        union ${t.union("Pet")} { cat: Cat; dog: Dog; }
      `,
    );

    const engine = createTestEngine(tester.program);
    const mutation = engine.mutateUnion(Pet, GraphQLTypeContext.Input);

    // Union is replaced with a Model in the type graph
    expect(mutation.mutatedType.kind).toBe("Model");
    expect(mutation.mutatedType.name).toBe("PetInput");
    expect(isOneOf(tester.program, mutation.mutatedType as Model)).toBe(true);
  });

  it("oneOf model has one field per variant, all optional", async () => {
    const { Pet } = await tester.compile(
      t.code`
        model ${t.model("Cat")} { name: string; }
        model ${t.model("Dog")} { breed: string; }
        union ${t.union("Pet")} { cat: Cat; dog: Dog; }
      `,
    );

    const engine = createTestEngine(tester.program);
    const mutation = engine.mutateUnion(Pet, GraphQLTypeContext.Input);
    const model = mutation.mutatedType as Model;

    expect(model.properties.size).toBe(2);
    expect(model.properties.has("cat")).toBe(true);
    expect(model.properties.has("dog")).toBe(true);
    // All fields are optional (oneOf semantics)
    expect(model.properties.get("cat")!.optional).toBe(true);
    expect(model.properties.get("dog")!.optional).toBe(true);
  });

  it("keeps union in output context (no replacement)", async () => {
    const { Pet } = await tester.compile(
      t.code`
        model ${t.model("Cat")} { name: string; }
        model ${t.model("Dog")} { breed: string; }
        union ${t.union("Pet")} { cat: Cat; dog: Dog; }
      `,
    );

    const engine = createTestEngine(tester.program);
    const mutation = engine.mutateUnion(Pet, GraphQLTypeContext.Output);

    expect(mutation.mutatedType.kind).toBe("Union");
  });

  it("oneOf model handles scalar variants", async () => {
    const { Data } = await tester.compile(
      t.code`
        model ${t.model("Foo")} { x: int32; }
        union ${t.union("Data")} { text: string; num: int32; foo: Foo; }
      `,
    );

    const engine = createTestEngine(tester.program);
    const mutation = engine.mutateUnion(Data, GraphQLTypeContext.Input);
    const model = mutation.mutatedType as Model;

    // All variants become fields — no wrapper models needed for oneOf
    expect(model.properties.size).toBe(3);
    expect(model.properties.has("text")).toBe(true);
    expect(model.properties.has("num")).toBe(true);
    expect(model.properties.has("foo")).toBe(true);
    // No wrapper models created in input context
    expect(mutation.wrapperModels).toHaveLength(0);
  });

  it("oneOf model flattens and deduplicates nested unions", async () => {
    const { Outer } = await tester.compile(
      t.code`
        model ${t.model("Cat")} { name: string; }
        model ${t.model("Dog")} { breed: string; }
        model ${t.model("Bird")} { wingspan: int32; }
        union ${t.union("Inner")} { cat: Cat; dog: Dog; }
        union ${t.union("Outer")} { inner: Inner; bird: Bird; dog2: Dog; }
      `,
    );

    const engine = createTestEngine(tester.program);
    const mutation = engine.mutateUnion(Outer, GraphQLTypeContext.Input);
    const model = mutation.mutatedType as Model;

    // Inner is flattened: Cat + Dog from Inner, Bird from Outer
    // Dog appears twice (from Inner and as dog2) — deduplicated to one
    expect(model.properties.size).toBe(3);
    expect(model.properties.has("cat")).toBe(true);
    expect(model.properties.has("dog")).toBe(true);
    expect(model.properties.has("bird")).toBe(true);
  });

  it("nullable union in input context is not replaced", async () => {
    const { MaybeString } = await tester.compile(
      t.code`union ${t.union("MaybeString")} { string, null }`,
    );

    const engine = createTestEngine(tester.program);
    const mutation = engine.mutateUnion(MaybeString, GraphQLTypeContext.Input);

    // Nullable unions are not real unions — union is kept, not replaced
    expect(mutation.mutatedType.kind).toBe("Union");
  });

  it("strips null from multi-variant union in output context", async () => {
    const { Pet } = await tester.compile(
      t.code`
        model ${t.model("Cat")} { name: string; }
        model ${t.model("Dog")} { breed: string; }
        union ${t.union("Pet")} { cat: Cat; dog: Dog; null; }
      `,
    );

    const engine = createTestEngine(tester.program);
    const mutation = engine.mutateUnion(Pet, GraphQLTypeContext.Output);

    // Null should be stripped — only Cat and Dog remain
    const mutatedUnion = mutation.mutatedType as Union;
    expect(mutatedUnion.kind).toBe("Union");
    expect(mutatedUnion.variants.size).toBe(2);

    // The result should be marked as nullable
    expect(isNullable(tester.program, mutatedUnion)).toBe(true);
  });

  it("strips null from multi-variant union in input context", async () => {
    const { Pet } = await tester.compile(
      t.code`
        model ${t.model("Cat")} { name: string; }
        model ${t.model("Dog")} { breed: string; }
        union ${t.union("Pet")} { cat: Cat; dog: Dog; null; }
      `,
    );

    const engine = createTestEngine(tester.program);
    const mutation = engine.mutateUnion(Pet, GraphQLTypeContext.Input);

    // Should become a @oneOf model with 2 fields (null stripped)
    const model = mutation.mutatedType as Model;
    expect(model.kind).toBe("Model");
    expect(model.properties.size).toBe(2);
    expect(model.properties.has("cat")).toBe(true);
    expect(model.properties.has("dog")).toBe(true);

    // Should be marked as both @oneOf and nullable
    expect(isOneOf(tester.program, model)).toBe(true);
    expect(isNullable(tester.program, model)).toBe(true);
  });

  it("non-nullable union is not marked as nullable", async () => {
    const { Pet } = await tester.compile(
      t.code`
        model ${t.model("Cat")} { name: string; }
        model ${t.model("Dog")} { breed: string; }
        union ${t.union("Pet")} { cat: Cat; dog: Dog; }
      `,
    );

    const engine = createTestEngine(tester.program);
    const mutation = engine.mutateUnion(Pet, GraphQLTypeContext.Output);

    expect(isNullable(tester.program, mutation.mutatedType)).toBe(false);
  });

  it("exposes typeContext on union mutation", async () => {
    const { Pet } = await tester.compile(
      t.code`
        model ${t.model("Cat")} { name: string; }
        union ${t.union("Pet")} { cat: Cat; }
      `,
    );

    const engine = createTestEngine(tester.program);
    const inputMutation = engine.mutateUnion(Pet, GraphQLTypeContext.Input);
    const outputMutation = engine.mutateUnion(Pet, GraphQLTypeContext.Output);

    expect(inputMutation.typeContext).toBe(GraphQLTypeContext.Input);
    expect(outputMutation.typeContext).toBe(GraphQLTypeContext.Output);
  });
});
