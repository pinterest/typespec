import { describe, expect, it } from "vitest";

import { ModelMutation, SimpleMutationEngine } from "@typespec/mutator-framework";
import {
  builtInTransformerLibraryName,
  createBuiltInTransformerLibrary,
  createTransformer,
  resolveTransformerDefinition,
  Transformer,
} from "../../src/core/transformer.js";
import type { TransformerDefinition, TransformerLibraryInstance } from "../../src/index.js";
import { createTransform, createTypeSpecLibrary } from "../../src/index.js";
import {
  createTestHost,
  expectDiagnosticEmpty,
  expectDiagnostics,
} from "../../src/testing/index.js";
import { $ } from "../../src/typekit/index.js";

const noopTransform = createTransform({
  name: "noop",
  description: "No operation transform",
  createEngine: (program) => {
    // Create a simple mutation engine with no custom mutations
    const tk = $(program);
    return new SimpleMutationEngine(tk, {});
  },
});

// A transform that actually renames models by adding a prefix
class PrefixModelMutation extends ModelMutation<any, any> {
  mutate() {
    this.mutateType((model) => {
      model.name = `Prefixed${model.name}`;
    });
    super.mutate();
  }
}

const prefixTransform = createTransform({
  name: "prefix",
  description: "Add prefix to model names",
  createEngine: (program) => {
    const tk = $(program);
    return new SimpleMutationEngine(tk, {
      Model: PrefixModelMutation,
    });
  },
});

// A transform that throws during engine creation
const failingTransform = createTransform({
  name: "failing",
  description: "Transform that fails during engine creation",
  createEngine: (_program) => {
    throw new Error("Intentional engine creation failure");
  },
});

describe("compiler: transformer", () => {
  async function createTestTransformer(
    code: string | Record<string, string>,
    transformerDef: TransformerDefinition,
  ): Promise<Transformer> {
    const host = await createTestHost();
    if (typeof code === "string") {
      host.addTypeSpecFile("main.tsp", code);
    } else {
      for (const [name, content] of Object.entries(code)) {
        host.addTypeSpecFile(name, content);
      }
    }

    const library: TransformerLibraryInstance = {
      entrypoint: {} as any,
      metadata: { type: "module", name: "@typespec/test-transformer" },
      module: { type: "module", path: "", mainFile: "", manifest: { name: "", version: "" } },
      definition: createTypeSpecLibrary({
        name: "@typespec/test-transformer",
        diagnostics: {},
      }),
      transformer: resolveTransformerDefinition("@typespec/test-transformer", transformerDef),
    };

    await host.compile("main.tsp");

    return createTransformer(host.program, (libName) =>
      Promise.resolve(libName === "@typespec/test-transformer" ? library : undefined),
    );
  }

  it("registering a transform doesn't enable it", async () => {
    const transformer = await createTestTransformer(`model Foo {}`, {
      transforms: [noopTransform],
    });
    expectDiagnosticEmpty(transformer.transform().diagnostics);
  });

  it("enabling a transform that doesn't exist emits a diagnostic", async () => {
    const transformer = await createTestTransformer(`model Foo {}`, {
      transforms: [noopTransform],
    });
    expectDiagnostics(
      await transformer.extendTransformSet({
        enable: { "@typespec/test-transformer/not-a-transform": true },
      }),
      {
        severity: "warning",
        code: "unknown-transform",
        message: `Unknown transform 'not-a-transform' in library '@typespec/test-transformer'.`,
      },
    );
  });

  it("enabling a transform set that doesn't exist emits a diagnostic", async () => {
    const transformer = await createTestTransformer(`model Foo {}`, {
      transforms: [noopTransform],
    });
    expectDiagnostics(
      await transformer.extendTransformSet({ extends: ["@typespec/test-transformer/not-a-set"] }),
      {
        severity: "warning",
        code: "unknown-transform-set",
        message: `Unknown transform set 'not-a-set' in library '@typespec/test-transformer'.`,
      },
    );
  });

  it("emits a diagnostic if enabling and disabling the same transform", async () => {
    const transformer = await createTestTransformer(`model Foo {}`, {
      transforms: [noopTransform],
    });
    expectDiagnostics(
      await transformer.extendTransformSet({
        enable: { "@typespec/test-transformer/noop": true },
        disable: { "@typespec/test-transformer/noop": "Reason" },
      }),
      {
        severity: "warning",
        code: "transform-enabled-disabled",
        message: `Transform '@typespec/test-transformer/noop' cannot be both enabled and disabled.`,
      },
    );
  });

  describe("when enabling a transform set", () => {
    it("/all set is automatically provided and include all transforms", async () => {
      const transformer = await createTestTransformer(`model Foo {}`, {
        transforms: [noopTransform],
      });
      expectDiagnosticEmpty(
        await transformer.extendTransformSet({
          extends: ["@typespec/test-transformer/all"],
        }),
      );
      // No diagnostics expected from running transforms as noop transform doesn't report any.
      expectDiagnosticEmpty(transformer.transform().diagnostics);
    });

    it("extending specific transform set enables the transforms inside", async () => {
      const transformer = await createTestTransformer(`model Foo {}`, {
        transforms: [noopTransform],
        transformSets: {
          custom: {
            enable: { "@typespec/test-transformer/noop": true },
          },
        },
      });
      expectDiagnosticEmpty(
        await transformer.extendTransformSet({
          extends: ["@typespec/test-transformer/custom"],
        }),
      );
      expectDiagnosticEmpty(transformer.transform().diagnostics);
    });

    it("nested extends enables transforms from both sets", async () => {
      const transformer = await createTestTransformer(`model Foo {}`, {
        transforms: [noopTransform, prefixTransform],
        transformSets: {
          base: {
            enable: { "@typespec/test-transformer/noop": true },
          },
          extended: {
            extends: ["@typespec/test-transformer/base"],
            enable: { "@typespec/test-transformer/prefix": true },
          },
        },
      });
      expectDiagnosticEmpty(
        await transformer.extendTransformSet({
          extends: ["@typespec/test-transformer/extended"],
        }),
      );
      const result = transformer.transform();
      expectDiagnosticEmpty(result.diagnostics);
      // Both engines should be created
      expect(result.engines.size).toBe(2);
    });
  });

  describe("disable functionality", () => {
    it("disabling a transform from an extended set removes it", async () => {
      const transformer = await createTestTransformer(`model Foo {}`, {
        transforms: [noopTransform, prefixTransform],
        transformSets: {
          base: {
            enable: {
              "@typespec/test-transformer/noop": true,
              "@typespec/test-transformer/prefix": true,
            },
          },
        },
      });
      expectDiagnosticEmpty(
        await transformer.extendTransformSet({
          extends: ["@typespec/test-transformer/base"],
          disable: { "@typespec/test-transformer/noop": "Not needed" },
        }),
      );
      const result = transformer.transform();
      expectDiagnosticEmpty(result.diagnostics);
      // Only prefix transform should be enabled
      expect(result.engines.size).toBe(1);
      expect(transformer.getEngine("@typespec/test-transformer/prefix")).toBeDefined();
      expect(transformer.getEngine("@typespec/test-transformer/noop")).toBeUndefined();
    });

    it("setting enable to false does not enable the transform", async () => {
      const transformer = await createTestTransformer(`model Foo {}`, {
        transforms: [noopTransform],
      });
      expectDiagnosticEmpty(
        await transformer.extendTransformSet({
          enable: { "@typespec/test-transformer/noop": false },
        }),
      );
      const result = transformer.transform();
      expectDiagnosticEmpty(result.diagnostics);
      expect(result.engines.size).toBe(0);
    });
  });

  describe("getEngine", () => {
    it("returns undefined for non-existent transform", async () => {
      const transformer = await createTestTransformer(`model Foo {}`, {
        transforms: [noopTransform],
      });
      expect(transformer.getEngine("@typespec/test-transformer/noop")).toBeUndefined();
    });

    it("returns the engine after transform is enabled and run", async () => {
      const transformer = await createTestTransformer(`model Foo {}`, {
        transforms: [noopTransform],
      });
      await transformer.extendTransformSet({
        enable: { "@typespec/test-transformer/noop": true },
      });
      transformer.transform();
      expect(transformer.getEngine("@typespec/test-transformer/noop")).toBeDefined();
    });
  });

  describe("transform execution", () => {
    it("creates engines for enabled transforms", async () => {
      const transformer = await createTestTransformer(`model Foo {}`, {
        transforms: [noopTransform],
      });
      await transformer.extendTransformSet({
        enable: { "@typespec/test-transformer/noop": true },
      });
      const result = transformer.transform();
      expectDiagnosticEmpty(result.diagnostics);
      expect(result.engines.size).toBe(1);
      expect(result.engines.has("@typespec/test-transformer/noop")).toBe(true);
    });

    it("tracks engine creation time in stats", async () => {
      const transformer = await createTestTransformer(`model Foo {}`, {
        transforms: [noopTransform],
      });
      await transformer.extendTransformSet({
        enable: { "@typespec/test-transformer/noop": true },
      });
      const result = transformer.transform();
      expect(result.stats.runtime.engineCreation["@typespec/test-transformer/noop"]).toBeDefined();
      expect(result.stats.runtime.total).toBeGreaterThanOrEqual(0);
    });

    it("runs multiple transforms in sequence", async () => {
      const transformer = await createTestTransformer(`model Foo {}`, {
        transforms: [noopTransform, prefixTransform],
      });
      await transformer.extendTransformSet({
        enable: {
          "@typespec/test-transformer/noop": true,
          "@typespec/test-transformer/prefix": true,
        },
      });
      const result = transformer.transform();
      expectDiagnosticEmpty(result.diagnostics);
      expect(result.engines.size).toBe(2);
    });

    it("emits diagnostic when engine creation fails", async () => {
      const transformer = await createTestTransformer(`model Foo {}`, {
        transforms: [failingTransform],
      });
      await transformer.extendTransformSet({
        enable: { "@typespec/test-transformer/failing": true },
      });
      const result = transformer.transform();
      expectDiagnostics(result.diagnostics, {
        code: "transform-engine-error",
        severity: "error",
        message: /Failed to create mutation engine.*Intentional engine creation failure/,
      });
    });
  });

  describe("transform that mutates types", () => {
    it("creates engine that can mutate model names", async () => {
      const transformer = await createTestTransformer(`model Foo { x: string; }`, {
        transforms: [prefixTransform],
      });
      await transformer.extendTransformSet({
        enable: { "@typespec/test-transformer/prefix": true },
      });
      const result = transformer.transform();
      expectDiagnosticEmpty(result.diagnostics);

      const engine = result.engines.get("@typespec/test-transformer/prefix");
      expect(engine).toBeDefined();

      // Get the Foo model from the program
      const Foo = result.program.getGlobalNamespaceType().models.get("Foo");
      expect(Foo).toBeDefined();

      // Use the engine to get the mutated type
      const mutation = engine!.mutate(Foo!);
      const mutatedFoo = mutation.getMutatedType();
      expect(mutatedFoo.name).toBe("PrefixedFoo");
    });
  });
});

describe("resolveTransformerDefinition", () => {
  it("adds library prefix to transform ids", () => {
    const resolved = resolveTransformerDefinition("@my/lib", {
      transforms: [noopTransform],
    });
    expect(resolved.transforms[0].id).toBe("@my/lib/noop");
  });

  it("auto-generates 'all' transform set when not provided", () => {
    const resolved = resolveTransformerDefinition("@my/lib", {
      transforms: [noopTransform],
    });
    expect(resolved.transformSets.all).toBeDefined();
    expect(resolved.transformSets.all.enable).toEqual({
      "@my/lib/noop": true,
    });
  });

  it("does not override existing 'all' transform set", () => {
    const resolved = resolveTransformerDefinition("@my/lib", {
      transforms: [noopTransform],
      transformSets: {
        all: {
          enable: { "@my/lib/custom": true },
        },
      },
    });
    expect(resolved.transformSets.all.enable).toEqual({
      "@my/lib/custom": true,
    });
  });

  it("preserves custom transform sets", () => {
    const resolved = resolveTransformerDefinition("@my/lib", {
      transforms: [noopTransform],
      transformSets: {
        custom: {
          enable: { "@my/lib/noop": true },
        },
      },
    });
    expect(resolved.transformSets.custom).toBeDefined();
    expect(resolved.transformSets.all).toBeDefined();
  });

  it("handles empty transforms array", () => {
    const resolved = resolveTransformerDefinition("@my/lib", {
      transforms: [],
    });
    expect(resolved.transforms).toHaveLength(0);
    expect(resolved.transformSets).toEqual({});
  });
});

describe("createBuiltInTransformerLibrary", () => {
  it("returns an empty transformer definition", () => {
    const lib = createBuiltInTransformerLibrary();
    expect(lib.transformer.transforms).toHaveLength(0);
    expect(lib.transformer.transformSets).toEqual({});
  });

  it("has the correct library name", () => {
    expect(builtInTransformerLibraryName).toBe("@typespec/compiler/transformers");
  });
});
