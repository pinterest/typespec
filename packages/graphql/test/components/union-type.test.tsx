import { type Union } from "@typespec/compiler";
import { t } from "@typespec/compiler/testing";
import * as gql from "@alloy-js/graphql";
import { describe, expect, it, beforeEach } from "vitest";
import { UnionType } from "../../src/components/types/index.js";
import {
  createGraphQLMutationEngine,
  GraphQLTypeContext,
} from "../../src/mutation-engine/index.js";
import { Tester } from "../test-host.js";
import { renderComponentToSDL } from "./component-test-utils.js";

describe("UnionType component", () => {
  let tester: Awaited<ReturnType<typeof Tester.createInstance>>;
  beforeEach(async () => {
    tester = await Tester.createInstance();
  });

  it("renders a union of model types", async () => {
    const { Pet } = await tester.compile(
      t.code`
        model ${t.model("Cat")} { name: string; }
        model ${t.model("Dog")} { breed: string; }
        union ${t.union("Pet")} { cat: Cat; dog: Dog; }
      `,
    );

    const engine = createGraphQLMutationEngine(tester.program);
    const mutation = engine.mutateUnion(Pet, GraphQLTypeContext.Output);

    // Union members must be registered in the schema for buildSchema to resolve them
    const sdl = renderComponentToSDL(
      tester.program,
      <>
        <gql.ObjectType name="Cat">
          <gql.Field name="name" type={gql.String} nonNull />
        </gql.ObjectType>
        <gql.ObjectType name="Dog">
          <gql.Field name="breed" type={gql.String} nonNull />
        </gql.ObjectType>
        <UnionType type={mutation.mutatedType as Union} />
      </>,
    );

    expect(sdl).toContain("union Pet =");
    expect(sdl).toContain("Cat");
    expect(sdl).toContain("Dog");
  });

  it("renders a union with doc comment description", async () => {
    const { Result } = await tester.compile(
      t.code`
        model ${t.model("Success")} { value: string; }
        model ${t.model("Failure")} { message: string; }
        /** The result of an operation */
        union ${t.union("Result")} { success: Success; failure: Failure; }
      `,
    );

    const engine = createGraphQLMutationEngine(tester.program);
    const mutation = engine.mutateUnion(Result, GraphQLTypeContext.Output);

    const sdl = renderComponentToSDL(
      tester.program,
      <>
        <gql.ObjectType name="Success">
          <gql.Field name="value" type={gql.String} nonNull />
        </gql.ObjectType>
        <gql.ObjectType name="Failure">
          <gql.Field name="message" type={gql.String} nonNull />
        </gql.ObjectType>
        <UnionType type={mutation.mutatedType as Union} />
      </>,
    );

    expect(sdl).toContain("The result of an operation");
    expect(sdl).toContain("union Result =");
  });

  it("renders a union with multiple model members", async () => {
    const { Shape } = await tester.compile(
      t.code`
        model ${t.model("Circle")} { radius: float32; }
        model ${t.model("Square")} { side: float32; }
        model ${t.model("Triangle")} { base: float32; }
        union ${t.union("Shape")} { circle: Circle; square: Square; triangle: Triangle; }
      `,
    );

    const engine = createGraphQLMutationEngine(tester.program);
    const mutation = engine.mutateUnion(Shape, GraphQLTypeContext.Output);

    const sdl = renderComponentToSDL(
      tester.program,
      <>
        <gql.ObjectType name="Circle">
          <gql.Field name="radius" type={gql.Float} nonNull />
        </gql.ObjectType>
        <gql.ObjectType name="Square">
          <gql.Field name="side" type={gql.Float} nonNull />
        </gql.ObjectType>
        <gql.ObjectType name="Triangle">
          <gql.Field name="base" type={gql.Float} nonNull />
        </gql.ObjectType>
        <UnionType type={mutation.mutatedType as Union} />
      </>,
    );

    expect(sdl).toContain("union Shape =");
    expect(sdl).toContain("Circle");
    expect(sdl).toContain("Square");
    expect(sdl).toContain("Triangle");
  });

  it("references wrapper type names for scalar variants", async () => {
    const { Mixed } = await tester.compile(
      t.code`
        model ${t.model("Cat")} { name: string; }
        union ${t.union("Mixed")} { cat: Cat; text: string; }
      `,
    );

    const engine = createGraphQLMutationEngine(tester.program);
    const mutation = engine.mutateUnion(Mixed, GraphQLTypeContext.Output);

    // Register Cat and the wrapper type that the union will reference
    const sdl = renderComponentToSDL(
      tester.program,
      <>
        <gql.ObjectType name="Cat">
          <gql.Field name="name" type={gql.String} nonNull />
        </gql.ObjectType>
        <gql.ObjectType name="MixedTextUnionVariant">
          <gql.Field name="value" type={gql.String} nonNull />
        </gql.ObjectType>
        <UnionType type={mutation.mutatedType as Union} />
      </>,
    );

    // Scalar variant should reference wrapper type name
    expect(sdl).toContain("union Mixed =");
    expect(sdl).toContain("MixedTextUnionVariant");
    expect(sdl).toContain("Cat");
  });
});
