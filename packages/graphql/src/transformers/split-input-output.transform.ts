import type { Model, Operation, Program } from "@typespec/compiler";
import { $, createTransform, resolveUsages, UsageFlags } from "@typespec/compiler";
import type { UsageTracker } from "@typespec/compiler/core";
import type {
  unsafe_MutatorRecord as MutatorRecord,
  unsafe_Realm as Realm,
} from "@typespec/compiler/experimental";
import { unsafe_MutatorFlow as MutatorFlow } from "@typespec/compiler/experimental";
import { appendFileSync } from "fs";

function debug(msg: string) {
  try {
    appendFileSync("/tmp/typespec-transform-debug.log", msg + "\n");
  } catch {}
}

/**
 * Creates an input version of a model by appending "Input" to its name
 */
function createInputModelName(originalName: string): string {
  return `${originalName}Input`;
}

// Per-program state using WeakMap for proper GC across test runs
const programState = new WeakMap<
  Program,
  {
    inputVariantsByName: Map<string, Model>; // Map by name to handle multiple clones
    modelsToSplit: Array<{ original: Model; clone: Model; realm: Realm }>; // Models that need input variants
    modelsToRename: Array<{ clone: Model }>; // Models to rename with Input suffix
    usageTracker: UsageTracker | null;
    variantsCreated: boolean; // Flag to ensure we only create variants once
  }
>();

function getState(program: Program) {
  let state = programState.get(program);
  if (!state) {
    state = {
      inputVariantsByName: new Map(), // Map is OK here - stored per program in WeakMap
      modelsToSplit: [],
      modelsToRename: [],
      usageTracker: null,
      variantsCreated: false,
    };
    programState.set(program, state);
  }
  return state;
}

/**
 * Get or create the usage tracker for this program
 */
function getUsageTracker(program: Program, state: ReturnType<typeof getState>): UsageTracker {
  if (!state.usageTracker) {
    state.usageTracker = resolveUsages(program.getGlobalNamespaceType());
  }
  return state.usageTracker;
}

/**
 * Transform that splits models used in both input and output positions into separate
 * input and output versions. This is necessary for GraphQL, which requires separate
 * input and output types.
 *
 * Single-Pass Strategy:
 * 1. Create input variants for models (split or rename)
 * 2. Update properties of input variants immediately to reference other input variants
 * 3. Update operation parameters to reference input variants
 *
 * - Output version: keeps the original name
 * - Input version: gets "Input" appended to the name
 */
export const splitInputOutputTransform = createTransform({
  name: "split-input-output",
  description:
    "Split models used in both input and output positions into separate input and output types.",
  mutators: [
    {
      name: "Split Input/Output Models",
      Model: {
        filter: (model) => {
          debug(`[Model.filter] Checking model: ${model.name}`);
          // Skip models already ending with Input (don't mutate or recurse)
          if (model.name.endsWith("Input")) {
            debug(`  -> SKIPPING (ends with Input)`);
            return MutatorFlow.DoNotMutate | MutatorFlow.DoNotRecur;
          }
          debug(`  -> PROCESSING`);
          return MutatorFlow.DoNotRecur;
        },
        mutate(original: Model, clone: Model, program: Program, realm: Realm) {
          const state = getState(program);
          const usageTracker = getUsageTracker(program, state);

          // Check usage directly using the tracker (no caching needed!)
          const isInput = usageTracker.isUsedAs(original, UsageFlags.Input);
          const isOutput = usageTracker.isUsedAs(original, UsageFlags.Output);

          if (isInput && isOutput) {
            // Model used in BOTH input and output - mark for splitting
            state.modelsToSplit.push({ original, clone, realm });
          } else if (isInput && !isOutput && !original.name.endsWith("Input")) {
            // Model used ONLY as input - mark for renaming
            state.modelsToRename.push({ clone });
          }
        },
      } as MutatorRecord<Model>,
      // Update operation parameters to use input variants
      Operation: {
        mutate(original: Operation, clone: Operation, program: Program, realm: Realm) {
          const state = getState(program);

          if (clone.parameters.kind === "Model") {
            for (const [paramName, param] of clone.parameters.properties) {
              if (param.type.kind === "Model" && !param.type.name.endsWith("Input")) {
                const inputVariant = state.inputVariantsByName.get(param.type.name);
                if (inputVariant) {
                  param.type = inputVariant;
                }
              }
            }
          }
        },
      } as MutatorRecord<Operation>,
      // Create input variants and update references
      Namespace: {
        mutate(original, clone, program, realm) {
          const state = getState(program);

          // Only run once per program to avoid creating duplicates
          if (state.variantsCreated) {
            return;
          }
          state.variantsCreated = true;

          // First, rename models that are input-only
          for (const { clone: model } of state.modelsToRename) {
            const oldName = model.name;
            const newName = createInputModelName(oldName);
            model.name = newName;

            // Store renamed model
            state.inputVariantsByName.set(oldName, model);

            // Update namespace
            if (model.namespace) {
              model.namespace.models.delete(oldName);
              model.namespace.models.set(newName, model);
            }
          }

          // Second, create input variants for models used in both input and output
          // Create models with EMPTY properties first to avoid cascading
          for (const { original, clone: outputModel, realm } of state.modelsToSplit) {
            const inputModel = $(realm).model.create({
              name: createInputModelName(original.name),
              properties: {}, // Empty for now
            });

            // Store mapping
            state.inputVariantsByName.set(original.name, inputModel);

            // Set the namespace property
            if (outputModel.namespace) {
              (inputModel as any).namespace = outputModel.namespace;
            }
          }

          // Now populate properties for all input variants
          for (const { original, clone: outputModel, realm } of state.modelsToSplit) {
            const inputModel = state.inputVariantsByName.get(original.name)!;

            for (const [key, prop] of outputModel.properties) {
              const newProp = $(realm).modelProperty.create({
                name: prop.name,
                type: prop.type,
                optional: prop.optional,
                decorators: [],
              });
              inputModel.properties.set(key, newProp);
            }
          }

          // Third, update properties of input variants to reference other input variants
          for (const [originalName, inputVariant] of state.inputVariantsByName) {
            for (const [propName, prop] of inputVariant.properties) {
              if (prop.type.kind === "Model" && !prop.type.name.endsWith("Input")) {
                const propInputVariant = state.inputVariantsByName.get(prop.type.name);
                if (propInputVariant) {
                  prop.type = propInputVariant;
                }
              }
            }
          }

          // Cleanup
          state.inputVariantsByName.clear();
          state.modelsToSplit = [];
          state.modelsToRename = [];
        },
      },
    },
  ],
});
