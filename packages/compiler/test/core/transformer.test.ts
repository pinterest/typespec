import { describe, it } from "vitest";

import {
  Transformer,
  createTransformer,
  resolveTransformerDefinition,
} from "../../src/core/transformer.js";
import type { TransformerDefinition, TransformerLibraryInstance } from "../../src/index.js";
import { $ } from "../../src/typekit/index.js";
import { createTransform, createTypeSpecLibrary } from "../../src/index.js";
import {
  createTestHost,
  expectDiagnosticEmpty,
  expectDiagnostics,
} from "../../src/testing/index.js";
import { SimpleMutationEngine } from "@typespec/mutator-framework";

const noopTransform = createTransform({
  name: "noop",
  description: "No operation transform",
  createEngine: (program) => {
    // Create a simple mutation engine with no custom mutations
    const tk = $(program);
    return new SimpleMutationEngine(tk, {});
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
  });
});
