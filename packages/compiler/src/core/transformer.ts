import { mutateSubgraphWithNamespace } from "../experimental/mutators.js";
import { compilerAssert, createDiagnosticCollector } from "./diagnostics.js";
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

type TransformerLibraryInstance = { transformer: TransformerResolvedDefinition };

export interface Transformer {
  extendTransformSet(transformSet: TransformSet): Promise<readonly Diagnostic[]>;
  registerTransformLibrary(name: string, lib?: TransformerLibraryInstance): void;
  transform(): TransformerResult;
}

export interface TransformerStats {
  runtime: {
    total: number;
    transforms: Record<string, number>;
  };
}
export interface TransformerResult {
  readonly diagnostics: readonly Diagnostic[];
  readonly program: TransformedProgram;
  readonly stats: TransformerStats;
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
    return {
      transforms,
      transformSets: {
        all: {
          enable: Object.fromEntries(transforms.map((x) => [x.id, true])) as any,
        },
        ...transformer.transformSets,
      },
    };
  }
}

export function createTransformer(
  program: Program,
  loadLibrary: (name: string) => Promise<TransformerLibraryInstance | undefined>,
): Transformer {
  const tracer = program.tracer.sub("transformer");

  const transformMap = new Map<string, Transform<string>>();
  const enabledTransforms = new Map<string, Transform<string>>();
  const transformerLibraries = new Map<string, TransformerLibraryInstance | undefined>();

  return {
    extendTransformSet,
    registerTransformLibrary,
    transform,
  };

  async function extendTransformSet(transformSet: TransformSet): Promise<readonly Diagnostic[]> {
    tracer.trace("extend-transform-set.start", JSON.stringify(transformSet, null, 2));
    const diagnostics = createDiagnosticCollector();
    if (transformSet.extends) {
      for (const extendingTransformSetName of transformSet.extends) {
        const ref = parseTransformReference(extendingTransformSetName);
        if (ref) {
          const library = await resolveLibrary(ref.libraryName);
          const libTransformerDefinition = library?.transformer;
          const extendingTransformSet = libTransformerDefinition?.transformSets?.[ref.name];
          if (extendingTransformSet) {
            await extendTransformSet(extendingTransformSet);
          } else {
            diagnostics.add({
              code: "unknown-transform-set",
              message: `Unknown transform set '${ref.name}' in library '${ref.libraryName}'.`,
              severity: "warning",
              target: NoTarget,
            } as Diagnostic);
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
        const ref = parseTransformReference(transformName as TransformSetRef);
        if (ref) {
          await resolveLibrary(ref.libraryName);
          const transform = transformMap.get(transformName);
          if (transform) {
            enabledInThisSet.add(transformName);
            enabledTransforms.set(transformName, transform);
          } else {
            diagnostics.add({
              code: "unknown-transform",
              message: `Unknown transform '${ref.name}' in library '${ref.libraryName}'.`,
              severity: "warning",
              target: NoTarget,
            } as Diagnostic);
          }
        }
      }
    }

    if (transformSet.disable) {
      for (const transformName of Object.keys(transformSet.disable)) {
        if (enabledInThisSet.has(transformName)) {
          diagnostics.add({
            code: "transform-enabled-disabled",
            message: `Transform '${transformName}' cannot be both enabled and disabled.`,
            severity: "warning",
            target: NoTarget,
          } as Diagnostic);
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
    const stats: TransformerStats = {
      runtime: {
        total: 0,
        transforms: {},
      },
    };
    tracer.trace(
      "transform",
      `Running transformer with following transforms:\n` +
        [...enabledTransforms.keys()].map((x) => ` - ${x}`).join("\n"),
    );

    const timer = startTimer();
    for (const t of enabledTransforms.values()) {
      const createTiming = startTimer();
      // TODO is this okay?
      mutateSubgraphWithNamespace(program, t.mutators, program.getGlobalNamespaceType());
      stats.runtime.transforms[t.id] = createTiming.end();
      // TODO fix timing
      // for (const [name, cb] of Object.entries(listener)) {
      //   const timedCb = (...args: any[]) => {
      //     const duration = time(() => (cb as any)(...args));
      //     stats.runtime.transforms[t.id] += duration;
      //   };
      //   eventEmitter.on(name as any, timedCb);
      // }
    }
    // navigateProgram(program, mapEventEmitterToNodeListener(eventEmitter));
    stats.runtime.total = timer.end();
    // For now, return the original program as the transformed program placeholder.
    return { diagnostics: diagnostics.diagnostics, program: program as TransformedProgram, stats };
  }

  async function resolveLibrary(name: string): Promise<TransformerLibraryInstance | undefined> {
    const loadedLibrary = transformerLibraries.get(name);
    if (loadedLibrary === undefined) {
      return registerTransformLibrary(name);
    }
    return loadedLibrary;
  }

  async function registerTransformLibrary(
    name: string,
    lib?: TransformerLibraryInstance,
  ): Promise<TransformerLibraryInstance | undefined> {
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
  ): { libraryName: string; name: string } | undefined {
    const segments = ref.split("/");
    const name = segments.pop();
    const libraryName = segments.join("/");
    if (!libraryName || !name) {
      return undefined;
    }
    return { libraryName, name };
  }
}

export const builtInTransformerLibraryName = `@typespec/compiler/transformers`;
export function createBuiltInTransformerLibrary(): TransformerLibraryInstance {
  // No built-in transforms yet; provide an empty definition.
  const empty: TransformerResolvedDefinition = {
    transforms: [],
    transformSets: {},
  };
  return { transformer: empty };
}
