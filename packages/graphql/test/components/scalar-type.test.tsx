import { t } from "@typespec/compiler/testing";
import { describe, expect, it, beforeEach } from "vitest";
import { ScalarType } from "../../src/components/types/index.js";
import { createGraphQLMutationEngine } from "../../src/mutation-engine/index.js";
import { getSpecifiedBy } from "../../src/lib/specified-by.js";
import { Tester } from "../test-host.js";
import { renderComponentToSDL } from "./component-test-utils.js";

describe("ScalarType component", () => {
  let tester: Awaited<ReturnType<typeof Tester.createInstance>>;
  beforeEach(async () => {
    tester = await Tester.createInstance();
  });

  it("renders a custom scalar", async () => {
    const { DateTime } = await tester.compile(
      t.code`scalar ${t.scalar("DateTime")} extends string;`,
    );

    const engine = createGraphQLMutationEngine(tester.program);
    const mutation = engine.mutateScalar(DateTime);

    const sdl = renderComponentToSDL(tester.program, <ScalarType type={mutation.mutatedType} />);

    expect(sdl).toContain("scalar DateTime");
  });

  it("renders a scalar with doc comment description", async () => {
    const { JSON } = await tester.compile(
      t.code`
        /** Arbitrary JSON blob */
        scalar ${t.scalar("JSON")} extends string;
      `,
    );

    const engine = createGraphQLMutationEngine(tester.program);
    const mutation = engine.mutateScalar(JSON);

    const sdl = renderComponentToSDL(tester.program, <ScalarType type={mutation.mutatedType} />);

    expect(sdl).toContain("Arbitrary JSON blob");
    expect(sdl).toContain("scalar JSON");
  });

  it("renders a scalar with @specifiedBy from context", async () => {
    const { MyScalar } = await tester.compile(
      t.code`
        @specifiedBy("https://example.com/spec")
        scalar ${t.scalar("MyScalar")} extends string;
      `,
    );

    const engine = createGraphQLMutationEngine(tester.program);
    const mutation = engine.mutateScalar(MyScalar);

    // Build scalarSpecifications map like the emitter does
    const specUrl = getSpecifiedBy(tester.program, mutation.mutatedType);
    const scalarSpecifications = new Map<string, string>();
    if (specUrl) {
      scalarSpecifications.set(mutation.mutatedType.name, specUrl);
    }

    const sdl = renderComponentToSDL(
      tester.program,
      <ScalarType type={mutation.mutatedType} />,
      { scalarSpecifications },
    );

    expect(sdl).toContain("scalar MyScalar");
    expect(sdl).toContain("@specifiedBy");
    expect(sdl).toContain("https://example.com/spec");
  });

  it("renders a scalar without @specifiedBy when not in context", async () => {
    const { MyScalar } = await tester.compile(
      t.code`scalar ${t.scalar("MyScalar")} extends string;`,
    );

    const engine = createGraphQLMutationEngine(tester.program);
    const mutation = engine.mutateScalar(MyScalar);

    const sdl = renderComponentToSDL(tester.program, <ScalarType type={mutation.mutatedType} />);

    expect(sdl).toContain("scalar MyScalar");
    expect(sdl).not.toContain("@specifiedBy");
  });

  it("renders a scalar with sanitized name", async () => {
    await tester.compile(
      t.code`scalar ${t.scalar("$Bad$")} extends string;`,
    );

    const BadScalar = tester.program.getGlobalNamespaceType().scalars.get("$Bad$")!;
    const engine = createGraphQLMutationEngine(tester.program);
    const mutation = engine.mutateScalar(BadScalar);

    const sdl = renderComponentToSDL(tester.program, <ScalarType type={mutation.mutatedType} />);

    expect(sdl).toContain("scalar _Bad_");
    expect(sdl).not.toContain("$Bad$");
  });
});
