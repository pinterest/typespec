import type { MutationEngine } from "@typespec/mutator-framework";
import { compilerAssert, createDiagnosticCollector } from "./diagnostics.js";
import { createDiagnostic } from "./messages.js";
import type { Program, TransformedProgram } from "./program.js";
import { startTimer } from "./stats.js";
import {
  Diagnostic,
  NoTarget,
  Transform,
  TransformSet,
  TransformSetRef,
  TransformerDefinition,
  TransformerResolvedDefinition,
} from "./types.js";

/**
 * Minimal interface for transformer library data needed internally.
 * The full TransformerLibraryInstance from types.ts includes module metadata
 * that isn't needed for transformer registration.
 */
interface TransformerLibrary {
  transformer: TransformerResolvedDefinition;
}

export interface Transformer {
  /**
   * Extend the current transform set with additional transforms.
   * @param transformSet - The transform set configuration to apply
   * @returns Diagnostics from processing the transform set
   */
  extendTransformSet(transformSet: TransformSet): Promise<readonly Diagnostic[]>;

  /**
   * Register a transformer library.
   * @param name - The library name
   * @param lib - Optional library instance (will be loaded if not provided)
   */
  registerTransformLibrary(name: string, lib?: TransformerLibrary): Promise<void>;

  /**
   * Execute all enabled transforms and create mutation engines.
   * @returns The transformation result including diagnostics, program, and engines
   */
  transform(): TransformerResult;

  /**
   * Get the mutation engine for a specific transform.
   * Useful for debugging and inspecting transform state.
   * @param transformId - The fully qualified transform ID (e.g., "@library/transform-name")
   * @returns The mutation engine if it exists, undefined otherwise
   */
  getEngine(transformId: string): MutationEngine<any> | undefined;
}

export interface TransformerStats {
  runtime: {
    /** List of transform IDs that were enabled */
    enabledTransforms: readonly string[];
    /** Total time for all transform operations in milliseconds */
    total: number;
    /** Time spent creating each engine, keyed by transform ID */
    engineCreation: Record<string, number>;
  };
}
export interface TransformerResult {
  readonly diagnostics: readonly Diagnostic[];
  readonly program: TransformedProgram;
  readonly stats: TransformerStats;
  readonly engines: ReadonlyMap<string, MutationEngine<any>>;
}

/** Resolve a transformer definition for a library. */
export function resolveTransformerDefinition(
  libName: string,
  transformer: TransformerDefinition,
): TransformerResolvedDefinition {
  const transforms: Transform<string>[] = transformer.transforms.map((t) => {
    return { ...t, id: `${libName}/${t.name}` };
  });
  if (
    transformer.transforms.length === 0 ||
    (transformer.transformSets && "all" in transformer.transformSets)
  ) {
    return {
      transforms,
      transformSets: transformer.transformSets ?? {},
    };
  } else {
    // Auto-generate an 'all' transform set that enables all transforms
    const allEnable: Record<TransformSetRef, boolean> = {};
    for (const t of transforms) {
      allEnable[t.id as TransformSetRef] = true;
    }
    return {
      transforms,
      transformSets: {
        all: { enable: allEnable },
        ...transformer.transformSets,
      },
    };
  }
}

export function createTransformer(
  program: Program,
  loadLibrary: (name: string) => Promise<TransformerLibrary | undefined>,
): Transformer {
  const tracer = program.tracer.sub("transformer");

  const transformMap = new Map<string, Transform<string>>();
  const enabledTransforms = new Map<string, Transform<string>>();
  const transformerLibraries = new Map<string, TransformerLibrary | undefined>();
  const engines = new Map<string, MutationEngine<any>>();

  return {
    extendTransformSet,
    registerTransformLibrary: async (name: string, lib?: TransformerLibrary) => {
      await registerTransformLibraryInternal(name, lib);
    },
    transform,
    getEngine: (transformId: string) => engines.get(transformId),
  };

  async function extendTransformSet(transformSet: TransformSet): Promise<readonly Diagnostic[]> {
    tracer.trace("extend-transform-set.start", JSON.stringify(transformSet, null, 2));
    const diagnostics = createDiagnosticCollector();
    if (transformSet.extends) {
      for (const extendingTransformSetName of transformSet.extends) {
        const ref = diagnostics.pipe(parseTransformReference(extendingTransformSetName));
        if (ref) {
          const library = await resolveLibrary(ref.libraryName);
          const libTransformerDefinition = library?.transformer;
          const extendingTransformSet = libTransformerDefinition?.transformSets?.[ref.name];
          if (extendingTransformSet) {
            await extendTransformSet(extendingTransformSet);
          } else {
            diagnostics.add(
              createDiagnostic({
                code: "unknown-transform-set",
                format: { libraryName: ref.libraryName, transformSetName: ref.name },
                target: NoTarget,
              }),
            );
          }
        }
      }
    }

    const enabledInThisSet = new Set<string>();
    if (transformSet.enable) {
      for (const [transformName, enable] of Object.entries(transformSet.enable)) {
        if (enable === false) {
          continue;
        }
        const ref = diagnostics.pipe(parseTransformReference(transformName as TransformSetRef));
        if (ref) {
          await resolveLibrary(ref.libraryName);
          const transform = transformMap.get(transformName);
          if (transform) {
            enabledInThisSet.add(transformName);
            enabledTransforms.set(transformName, transform);
          } else {
            diagnostics.add(
              createDiagnostic({
                code: "unknown-transform",
                format: { libraryName: ref.libraryName, transformName: ref.name },
                target: NoTarget,
              }),
            );
          }
        }
      }
    }

    if (transformSet.disable) {
      for (const transformName of Object.keys(transformSet.disable)) {
        if (enabledInThisSet.has(transformName)) {
          diagnostics.add(
            createDiagnostic({
              code: "transform-enabled-disabled",
              format: { transformName },
              target: NoTarget,
            }),
          );
        }
        enabledTransforms.delete(transformName);
      }
    }
    tracer.trace(
      "extend-transform-set.end",
      "Transforms enabled: \n" + [...enabledTransforms.keys()].map((x) => ` - ${x}`).join("\n"),
    );

    return diagnostics.diagnostics;
  }

  function transform(): TransformerResult {
    const diagnostics = createDiagnosticCollector();
    const enabledTransformIds = [...enabledTransforms.keys()];
    const stats: TransformerStats = {
      runtime: {
        enabledTransforms: enabledTransformIds,
        total: 0,
        engineCreation: {},
      },
    };
    tracer.trace(
      "transform",
      `Running transformer with following transforms:\n` +
        enabledTransformIds.map((x) => ` - ${x}`).join("\n"),
    );

    const timer = startTimer();

    // Create mutation engines for all enabled transforms
    for (const [id, t] of enabledTransforms.entries()) {
      const engineTimer = startTimer();
      try {
        tracer.trace("transform.create-engine", `Creating engine for ${id}`);
        const engine = t.createEngine(program);
        engines.set(id, engine);
        stats.runtime.engineCreation[id] = engineTimer.end();
        tracer.trace("transform.engine-created", `Created engine for ${id}`);
      } catch (error) {
        diagnostics.add(
          createDiagnostic({
            code: "transform-engine-error",
            format: { transformId: id, error: String(error) },
            target: NoTarget,
          }),
        );
        stats.runtime.engineCreation[id] = engineTimer.end();
      }
    }

    // Note: With the mutator-framework, mutations are lazy - they happen when types are accessed,
    // not upfront. The engines are stored and will be used when transformed types are requested.

    stats.runtime.total = timer.end();

    return {
      diagnostics: diagnostics.diagnostics,
      program: program as TransformedProgram,
      stats,
      engines,
    };
  }

  async function resolveLibrary(name: string): Promise<TransformerLibrary | undefined> {
    const loadedLibrary = transformerLibraries.get(name);
    if (loadedLibrary === undefined) {
      return registerTransformLibraryInternal(name);
    }
    return loadedLibrary;
  }

  async function registerTransformLibraryInternal(
    name: string,
    lib?: TransformerLibrary,
  ): Promise<TransformerLibrary | undefined> {
    tracer.trace("register-library", name);

    const library = lib ?? (await loadLibrary(name));
    const transformer = library?.transformer;
    if (transformer?.transforms) {
      for (const t of transformer.transforms) {
        tracer.trace(
          "register-library.transform",
          `Registering transform "${t.id}" for library "${name}".`,
        );
        if (transformMap.has(t.id)) {
          compilerAssert(false, `Unexpected duplicate transform: "${t.id}"`);
        } else {
          transformMap.set(t.id, t);
        }
      }
    }
    transformerLibraries.set(name, library);

    return library;
  }

  function parseTransformReference(
    ref: TransformSetRef,
  ): [{ libraryName: string; name: string } | undefined, readonly Diagnostic[]] {
    const segments = ref.split("/");
    const name = segments.pop();
    const libraryName = segments.join("/");
    if (!libraryName || !name) {
      return [
        undefined,
        [createDiagnostic({ code: "invalid-transform-ref", format: { ref }, target: NoTarget })],
      ];
    }
    return [{ libraryName, name }, []];
  }
}

export const builtInTransformerLibraryName = `@typespec/compiler/transformers`;
export function createBuiltInTransformerLibrary(): TransformerLibrary {
  // No built-in transforms yet; provide an empty definition.
  const empty: TransformerResolvedDefinition = {
    transforms: [],
    transformSets: {},
  };
  return { transformer: empty };
}
