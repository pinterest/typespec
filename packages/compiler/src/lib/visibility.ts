// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import type {
  DefaultVisibilityDecorator,
  InvisibleDecorator,
  ParameterVisibilityDecorator,
  RemoveVisibilityDecorator,
  ReturnTypeVisibilityDecorator,
  VisibilityDecorator,
  WithDefaultKeyVisibilityDecorator,
  WithLifecycleUpdateDecorator,
  WithUpdateablePropertiesDecorator,
  WithVisibilityDecorator,
  WithVisibilityFilterDecorator,
} from "../../generated-defs/TypeSpec.js";
import { validateDecoratorTarget, validateDecoratorUniqueOnNode } from "../core/decorator-utils.js";
import { getSourceLocation, SyntaxKind } from "../core/index.js";
import { reportDiagnostic } from "../core/messages.js";
import type { Program } from "../core/program.js";
import {
  CodeFix,
  DecoratorApplication,
  DecoratorContext,
  DecoratorFunction,
  Enum,
  EnumMember,
  EnumValue,
  Model,
  ModelProperty,
  Operation,
  Type,
  UnionVariant,
} from "../core/types.js";
import {
  addVisibilityModifiers,
  clearLegacyVisibility,
  clearVisibilityModifiersForClass,
  GeneratedVisibilityFilter,
  getLegacyVisibility,
  getVisibility,
  isVisible,
  removeVisibilityModifiers,
  resetVisibilityModifiersForClass,
  setDefaultModifierSetForVisibilityClass,
  setLegacyVisibility,
  VisibilityFilter,
} from "../core/visibility/core.js";
import {
  getLifecycleVisibilityEnum,
  normalizeLegacyLifecycleVisibilityString,
  normalizeVisibilityToLegacyLifecycleString,
} from "../core/visibility/lifecycle.js";
import { isMutableType, mutateSubgraph, Mutator, MutatorFlow } from "../experimental/mutators.js";
import { useStateMap } from "../utils/index.js";
import { isKey } from "./key.js";
import { createStateSymbol, filterModelPropertiesInPlace } from "./utils.js";

// #region Legacy Visibility Utilities

/**
 * Takes a list of visibilities that possibly include both legacy visibility
 * strings and visibility class members, and returns two lists containing only
 * each type.
 *
 * @param visibilities - The list of visibilities to split
 * @returns a tuple containing visibility enum members in the first position and
 *         legacy visibility strings in the second position
 */
function splitLegacyVisibility(
  context: DecoratorContext,
  visibilities: (string | EnumValue)[],
  decorator: DecoratorFunction,
): [EnumMember[], string[]] {
  const legacyVisibilities = [] as string[];
  const modifiers = [] as EnumMember[];

  let argIdx = 0;

  const decoratorLocation = getSourceLocation(context.decoratorTarget);
  const decoratorName = decorator.name.slice(1);

  function isArgumentFixable(idx: number): boolean {
    const argTarget = context.getArgumentTarget(idx);

    const argTargetIsStringLiteral =
      argTarget &&
      typeof argTarget !== "symbol" &&
      "kind" in argTarget &&
      argTarget.kind === SyntaxKind.StringLiteral;

    const argTargetSourceLocation = getSourceLocation(argTarget);

    // We can fix the string if the target is a string literal
    // in user code.
    return (
      !!argTargetIsStringLiteral &&
      argTargetSourceLocation !== undefined &&
      !argTargetSourceLocation.isSynthetic &&
      !argTargetSourceLocation.file.path.includes("node_modules")
    );
  }

  const allVisibilityStringsAreFixable = visibilities.every((v, idx) => {
    if (typeof v !== "string") return false;

    const lifecycleModifier = normalizeLegacyLifecycleVisibilityString(context.program, v);

    return lifecycleModifier && isArgumentFixable(idx);
  });

  for (const visibility of visibilities) {
    if (typeof visibility === "string") {
      const lifecycleModifier = normalizeLegacyLifecycleVisibilityString(
        context.program,
        visibility,
      );

      const canApplyCodeFix = isArgumentFixable(argIdx);

      const argTarget = context.getArgumentTarget(argIdx);

      const fallbackTarget = argTarget ?? context.decoratorTarget;

      if (lifecycleModifier) {
        const codefixes: CodeFix[] = [];

        if (allVisibilityStringsAreFixable) {
          let alreadyFixed = false;
          codefixes.push({
            id: "visibility-legacy-to-lifecycle",
            label: `Convert to Lifecycle`,
            fix: (ctx) => {
              if (alreadyFixed) return;

              alreadyFixed = true;

              const replacements = visibilities
                .map((v) => {
                  const normalized = normalizeLegacyLifecycleVisibilityString(
                    context.program,
                    v as string,
                  );

                  return `Lifecycle.${normalized!.name}`;
                })
                .join(", ");

              return ctx.replaceText(decoratorLocation, `@${decoratorName}(${replacements})`);
            },
          });
        }

        reportDiagnostic(context.program, {
          code: "visibility-legacy",
          target: fallbackTarget,
          messageId: "default",
          format: {
            modifier: visibility,
            newModifier: `Lifecycle.${lifecycleModifier.name}`,
          },
          codefixes,
        });
      } else if (visibility === "none" && decoratorName === "visibility") {
        const codefixes: CodeFix[] = [];

        if (visibilities.length === 1 && canApplyCodeFix) {
          codefixes.push({
            id: "visibility-none-invisible-lifecycle",
            label: "Convert to `@invisible(Lifecycle)`",
            fix: (ctx) => {
              return ctx.replaceText(decoratorLocation, "@invisible(Lifecycle)");
            },
          });
        }

        reportDiagnostic(context.program, {
          code: "visibility-legacy",
          messageId: "none",
          target: decoratorLocation,
          codefixes,
        });
      } else {
        reportDiagnostic(context.program, {
          code: "visibility-legacy",
          target: context.getArgumentTarget(argIdx) ?? context.decoratorTarget,
          messageId: "unrecognized",
          format: {
            modifier: visibility,
          },
        });
      }

      legacyVisibilities.push(visibility);
    } else {
      modifiers.push(visibility.value);
    }

    argIdx += 1;
  }

  return [modifiers, legacyVisibilities] as const;
}

export const $withDefaultKeyVisibility: WithDefaultKeyVisibilityDecorator = (
  context: DecoratorContext,
  entity: Model,
  visibility: string | EnumValue,
) => {
  const keyProperties: ModelProperty[] = [];
  entity.properties.forEach((prop: ModelProperty) => {
    // Keep track of any key property without a visibility
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    if (isKey(context.program, prop) && !getVisibility(context.program, prop)) {
      keyProperties.push(prop);
    }
  });

  // For each key property without a visibility, clone it and add the specified
  // default visibility value
  keyProperties.forEach((keyProp) => {
    entity.properties.set(
      keyProp.name,
      context.program.checker.cloneType(keyProp, {
        decorators: [
          ...keyProp.decorators,
          {
            decorator: $visibility,
            args: [
              {
                value:
                  typeof visibility === "string"
                    ? context.program.checker.createLiteralType(visibility)
                    : visibility,
                jsValue: visibility,
              },
            ],
          },
        ],
      }),
    );
  });
};

/**
 * Visibility configuration of an operation.
 */
interface OperationVisibilityConfig {
  /**
   * Stored parameter visibility configuration.
   */
  parameters?: string[] | EnumMember[];
  /**
   * Stored return type visibility configuration.
   */
  returnType?: string[] | EnumMember[];
}

const [getOperationVisibilityConfigRaw, setOperationVisibilityConfigRaw] = useStateMap<
  Operation,
  OperationVisibilityConfig
>(createStateSymbol("operationVisibilityConfig"));

function getOperationVisibilityConfig(
  program: Program,
  operation: Operation,
): OperationVisibilityConfig {
  let config = getOperationVisibilityConfigRaw(program, operation);

  if (!config) {
    config = {};

    setOperationVisibilityConfigRaw(program, operation, config);
  }

  return config;
}

// Hidden internal symbol to mark that parameter visibility was empty. This is used by HTTP
// to set the LegacyParameterVisibility flag. This is a hack.
const parameterVisibilityIsEmpty = Symbol.for("TypeSpec.Visibility.ParameterVisibilityIsEmpty");

export const $parameterVisibility: ParameterVisibilityDecorator = (
  context: DecoratorContext,
  operation: Operation,
  ...visibilities: (string | EnumValue)[]
) => {
  validateDecoratorUniqueOnNode(context, operation, $parameterVisibility);

  if (visibilities.length === 0) {
    reportDiagnostic(context.program, {
      code: "operation-visibility-constraint-empty",
      messageId: "parameter",
      target: context.decoratorTarget,
    });

    context.program.stateSet(parameterVisibilityIsEmpty).add(operation);
  }

  const [modifiers, legacyVisibilities] = splitLegacyVisibility(
    context,
    visibilities,
    $parameterVisibility,
  );

  if (modifiers.length > 0 && legacyVisibilities.length > 0) {
    reportDiagnostic(context.program, {
      code: "visibility-mixed-legacy",
      target: context.decoratorTarget,
    });

    return;
  }

  if (modifiers.length > 0) {
    getOperationVisibilityConfig(context.program, operation).parameters = modifiers;
  } else {
    getOperationVisibilityConfig(context.program, operation).parameters = legacyVisibilities;
  }
};

/**
 * Returns the visibilities of the parameters of the given operation, if provided with `@parameterVisibility`.
 *
 * @deprecated Use `getParameterVisibilityFilter` instead. This function will be REMOVED in TypeSpec 1.0-rc.
 *
 * @see {@link getParameterVisibilityFilter}
 * @see {@link $parameterVisibility}
 */
export function getParameterVisibility(program: Program, entity: Operation): string[] | undefined {
  return getOperationVisibilityConfig(program, entity)
    .parameters?.map((p) =>
      typeof p === "string" ? p : normalizeVisibilityToLegacyLifecycleString(program, p),
    )
    .filter((p) => !!p) as string[];
}

/**
 * A context-specific provider for visibility information that applies when parameter or return type visibility
 * constraints are not explicitly specified. Visibility providers are provided by libraries that define implied
 * visibility semantics, such as `@typespec/http`.
 *
 * If you are not working in a protocol that has specific visibility semantics, you can use the
 * {@link EmptyVisibilityProvider} from this package as a default provider. It will consider all properties visible by
 * default unless otherwise explicitly specified.
 */
export interface VisibilityProvider {
  parameters(program: Program, operation: Operation): VisibilityFilter;
  returnType(program: Program, operation: Operation): VisibilityFilter;
}

/**
 * An empty visibility provider. This provider returns an empty filter that considers all properties visible. This filter
 * is used when no context-specific visibility provider is available.
 *
 * When working with an HTTP specification, use the `HttpVisibilityProvider` from the `@typespec/http` library instead.
 */
export const EmptyVisibilityProvider: VisibilityProvider = {
  parameters: () => ({}),
  returnType: () => ({}),
};

/**
 * Get the visibility filter that should apply to the parameters of the given operation, or `undefined` if no parameter
 * visibility is set.
 *
 * If you are not working in a protocol that has specific implicit visibility semantics, you can use the
 * {@link EmptyVisibilityProvider} as a default provider. If you working in a protocol or context where parameters have
 * implicit visibility transformations (like HTTP), you should use the visibility provider from that library (for HTTP,
 * use the `HttpVisibilityProvider` from the `@typespec/http` library).
 *
 * @param program - the Program in which the operation is defined
 * @param operation - the Operation to get the parameter visibility filter for
 * @param defaultProvider - a provider for visibility filters that apply when no visibility constraints are explicitly
 *                         set. Defaults to an empty provider that returns an empty filter if not provided.
 * @returns a visibility filter for the parameters of the operation, or `undefined` if no parameter visibility is set
 */
export function getParameterVisibilityFilter(
  program: Program,
  operation: Operation,
  defaultProvider: VisibilityProvider,
): VisibilityFilter {
  const operationVisibilityConfig = getOperationVisibilityConfig(program, operation);

  if (!operationVisibilityConfig.parameters) return defaultProvider.parameters(program, operation);

  // If there are no parameters, return an empty filter. This has the effect of allowing `@parameterVisibility()` to
  // disable the default visibility provider for an operation.
  if (operationVisibilityConfig.parameters.length === 0) return {};

  return {
    // WARNING: the HTTP library depends on `any` being the only key in the filter object returned by this method.
    //          if you change this logic, you will need to update the HTTP library to account for differences in the
    //          returned object. HTTP does not currently have a way to express `all` or `none` constraints in the same
    //          way that the core visibility system does.
    any: new Set(
      operationVisibilityConfig.parameters
        .map((v) =>
          typeof v === "string" ? normalizeLegacyLifecycleVisibilityString(program, v) : v,
        )
        .filter((v) => !!v),
    ),
  };
}

export const $returnTypeVisibility: ReturnTypeVisibilityDecorator = (
  context: DecoratorContext,
  operation: Operation,
  ...visibilities: (string | EnumValue)[]
) => {
  validateDecoratorUniqueOnNode(context, operation, $parameterVisibility);

  if (visibilities.length === 0) {
    reportDiagnostic(context.program, {
      code: "operation-visibility-constraint-empty",
      messageId: "returnType",
      target: context.decoratorTarget,
    });

    context.program.stateSet(parameterVisibilityIsEmpty).add(operation);
  }

  const [modifiers, legacyVisibilities] = splitLegacyVisibility(
    context,
    visibilities,
    $returnTypeVisibility,
  );

  if (modifiers.length > 0 && legacyVisibilities.length > 0) {
    reportDiagnostic(context.program, {
      code: "visibility-mixed-legacy",
      target: context.decoratorTarget,
    });

    return;
  }

  if (modifiers.length > 0) {
    getOperationVisibilityConfig(context.program, operation).returnType = modifiers;
  } else {
    getOperationVisibilityConfig(context.program, operation).returnType = legacyVisibilities;
  }
};

/**
 * Returns the visibilities of the return type of the given operation, if provided with `@returnTypeVisibility`.
 *
 * @deprecated Use `getReturnTypeVisibilityFilter` instead. This function will be REMOVED in TypeSpec 1.0-rc.
 *
 * @see {@link getReturnTypeVisibilityFilter}
 * @see {@link $returnTypeVisibility}
 */
export function getReturnTypeVisibility(program: Program, entity: Operation): string[] | undefined {
  return getOperationVisibilityConfig(program, entity)
    .returnType?.map((p) =>
      typeof p === "string" ? p : normalizeVisibilityToLegacyLifecycleString(program, p),
    )
    .filter((p) => !!p) as string[];
}

/**
 * Get the visibility filter that should apply to the return type of the given operation, or `undefined` if no return
 * type visibility is set.
 *
 * @param program - the Program in which the operation is defined
 * @param operation - the Operation to get the return type visibility filter for
 * @param defaultProvider - a provider for visibility filters that apply when no visibility constraints are explicitly
 *                          set. Defaults to an empty provider that returns an empty filter if not provided.
 * @returns a visibility filter for the return type of the operation, or `undefined` if no return type visibility is set
 */
export function getReturnTypeVisibilityFilter(
  program: Program,
  operation: Operation,
  defaultProvider: VisibilityProvider,
): VisibilityFilter {
  const visibilityConfig = getOperationVisibilityConfig(program, operation);

  if (!visibilityConfig.returnType) return defaultProvider.returnType(program, operation);

  // If there are no return type visibilities, return an empty filter. This has the effect of allowing
  // `@returnTypeVisibility()` to disable the default visibility provider for an operation.
  if (visibilityConfig.returnType.length === 0) return {};

  return {
    // WARNING: the HTTP library depends on `any` being the only key in the filter object returned by this method.
    //          if you change this logic, you will need to update the HTTP library to account for differences in the
    //          returned object. HTTP does not currently have a way to express `all` or `none` constraints in the same
    //          way that the core visibility system does.
    any: new Set(
      visibilityConfig.returnType
        .map((v) =>
          typeof v === "string" ? normalizeLegacyLifecycleVisibilityString(program, v) : v,
        )
        .filter((v) => !!v),
    ),
  };
}

// #endregion

// #region Core Visibility Decorators

// -- @visibility decorator ---------------------

export const $visibility: VisibilityDecorator = (
  context: DecoratorContext,
  target: ModelProperty,
  ...visibilities: (string | EnumValue)[]
) => {
  const [modifiers, legacyVisibilities] = splitLegacyVisibility(context, visibilities, $visibility);

  if (legacyVisibilities.length > 0 || visibilities.length === 0) {
    const isUnique = validateDecoratorUniqueOnNode(context, target, $visibility);

    if (modifiers.length > 0) {
      reportDiagnostic(context.program, {
        code: "visibility-mixed-legacy",
        target: context.decoratorTarget,
      });

      return;
    }

    // Only attempt to set the legacy visibility modifiers if the visibility invocation is unique. Otherwise, a compiler
    // assertion will fail inside the legacy visibility management API.
    if (isUnique) setLegacyVisibility(context, target, legacyVisibilities);
  } else {
    if (getLegacyVisibility(context.program, target)) {
      reportDiagnostic(context.program, {
        code: "visibility-mixed-legacy",
        target: context.decoratorTarget,
      });
    }
    addVisibilityModifiers(context.program, target, modifiers, context);
  }
};

// -- @removeVisibility decorator ---------------------

export const $removeVisibility: RemoveVisibilityDecorator = (
  context: DecoratorContext,
  target: ModelProperty,
  ...visibilities: EnumValue[]
) => {
  removeVisibilityModifiers(
    context.program,
    target,
    visibilities.map((v) => v.value),
  );
};

// -- @invisible decorator ---------------------

export const $invisible: InvisibleDecorator = (
  context: DecoratorContext,
  target: ModelProperty,
  visibilityClass: Enum,
) => {
  clearVisibilityModifiersForClass(context.program, target, visibilityClass);
};

// -- @defaultVisibility decorator ------------------

export const $defaultVisibility: DefaultVisibilityDecorator = (
  context: DecoratorContext,
  target: Enum,
  ...visibilities: EnumValue[]
) => {
  validateDecoratorUniqueOnNode(context, target, $defaultVisibility);

  const modifierSet = new Set<EnumMember>();

  for (const visibility of visibilities) {
    if (visibility.value.enum !== target) {
      reportDiagnostic(context.program, {
        code: "default-visibility-not-member",
        target: context.decoratorTarget,
      });
    } else {
      modifierSet.add(visibility.value);
    }
  }

  setDefaultModifierSetForVisibilityClass(context.program, target, modifierSet);
};

// #endregion

// #region Legacy Visibility Transforms

// -- @withVisibility decorator ---------------------

export const $withVisibility: WithVisibilityDecorator = (
  context: DecoratorContext,
  target: Model,
  ...visibilities: (string | EnumValue)[]
) => {
  const [modifiers, legacyVisibilities] = splitLegacyVisibility(
    context,
    visibilities,
    $withVisibility,
  );

  if (legacyVisibilities.length > 0) {
    if (modifiers.length > 0) {
      reportDiagnostic(context.program, {
        code: "visibility-mixed-legacy",
        target: context.decoratorTarget,
      });

      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    filterModelPropertiesInPlace(target, (p) => isVisible(context.program, p, legacyVisibilities));

    for (const p of target.properties.values()) {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const legacyModifiers = getVisibility(context.program, p);

      if (legacyModifiers && legacyModifiers.length > 0) {
        clearLegacyVisibility(context.program, p);
      } else {
        resetVisibilityModifiersForClass(
          context.program,
          p,
          getLifecycleVisibilityEnum(context.program),
        );
      }
    }
  } else {
    const filter: VisibilityFilter = {
      all: new Set(modifiers),
    };

    const visibilityClasses = new Set(modifiers.map((m) => m.enum));
    filterModelPropertiesInPlace(target, (p) => isVisible(context.program, p, filter));
    for (const p of target.properties.values()) {
      for (const c of visibilityClasses) {
        resetVisibilityModifiersForClass(context.program, p, c);
      }
    }
  }
};

// -- @withUpdateableProperties decorator ----------------------

/**
 * Filters a model for properties that are updateable.
 *
 * @param context - the program context
 * @param target - Model to filter for updateable properties
 */
export const $withUpdateableProperties: WithUpdateablePropertiesDecorator = (
  context: DecoratorContext,
  target: Type,
) => {
  if (!validateDecoratorTarget(context, target, "@withUpdateableProperties", "Model")) {
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-deprecated
  filterModelPropertiesInPlace(target, (p) => isVisible(context.program, p, ["update"]));
};

// #endregion

// #region Mutator Driven Transforms

// -- @withVisibilityFilter decorator ----------------------

export const $withVisibilityFilter: WithVisibilityFilterDecorator = (
  context: DecoratorContext,
  target: Model,
  _filter: GeneratedVisibilityFilter,
) => {
  const filter = VisibilityFilter.fromDecoratorArgument(_filter);

  const vfMutator: Mutator = createVisibilityFilterMutator(filter, {
    decoratorFn: $withVisibilityFilter,
  });

  const { type } = mutateSubgraph(context.program, [vfMutator], target);

  target.properties = (type as Model).properties;
};

// -- @withLifecycleUpdate decorator ----------------------

export const $withLifecycleUpdate: WithLifecycleUpdateDecorator = (
  context: DecoratorContext,
  target: Model,
) => {
  const lifecycle = getLifecycleVisibilityEnum(context.program);
  const lifecycleUpdate: VisibilityFilter = {
    all: new Set([lifecycle.members.get("Update")!]),
  };

  const lifecycleCreateOrUpdate: VisibilityFilter = {
    any: new Set([lifecycle.members.get("Create")!, lifecycle.members.get("Update")!]),
  };

  const createOrUpdateMutator = createVisibilityFilterMutator(lifecycleCreateOrUpdate);

  const updateMutator = createVisibilityFilterMutator(lifecycleUpdate, {
    recur: createOrUpdateMutator,
    decoratorFn: $withLifecycleUpdate,
  });

  const { type } = mutateSubgraph(context.program, [updateMutator], target);

  target.properties = (type as Model).properties;
};

/**
 * Options for the `createVisibilityFilterMutator` function.
 */
interface CreateVisibilityFilterMutatorOptions {
  /**
   * A mutator to apply to the type of visible properties of the model. If not provided, applies the constructed
   * visibility filter mutator recursively.
   */
  recur?: Mutator;

  /**
   * Optionally, a decorator function to remove from the model's decorators, if present.
   *
   * This allows removing a decorator like `withVisibilityFilter` from the model after it has been applied
   * to avoid an infinite loop.
   */
  decoratorFn?: DecoratorFunction;
}

/**
 * Create a mutator that applies a visibility filter to a type.
 *
 * @param filter - The visibility filter to apply
 * @param options - optional settings for the mutator
 * @returns
 */
function createVisibilityFilterMutator(
  filter: VisibilityFilter,
  options: CreateVisibilityFilterMutatorOptions = {},
): Mutator {
  const visibilityClasses = VisibilityFilter.getVisibilityClasses(filter);
  const mpMutator: Mutator = {
    name: "VisibilityFilterProperty",
    ModelProperty: {
      filter: () => MutatorFlow.DoNotRecur,
      mutate: (prop, clone, program) => {
        // We need to create a copy of the decorators array to avoid modifying the original.
        // Decorators are _NOT_ cloned by the type kit, so we have to be careful not to modify the decorator arguments
        // of the original type.
        const decorators: DecoratorApplication[] = [];

        for (const decorator of prop.decorators) {
          const decFn = decorator.decorator;
          if (decFn === $visibility || decFn === $removeVisibility) {
            const nextArgs = decorator.args.filter((arg) => {
              if (arg.value.entityKind !== "Value") return false;

              const isString = arg.value.valueKind === "StringValue";
              const isOperativeVisibility =
                arg.value.valueKind === "EnumValue" && visibilityClasses.has(arg.value.value.enum);

              return !(isString || isOperativeVisibility);
            });

            if (nextArgs.length > 0) {
              decorators.push({
                ...decorator,
                args: nextArgs,
              });
            }
          } else if (decFn !== $invisible) {
            decorators.push(decorator);
          }
        }

        clone.decorators = decorators;

        for (const visibilityClass of visibilityClasses) {
          resetVisibilityModifiersForClass(program, clone, visibilityClass);
        }

        if (isMutableType(prop.type)) {
          clone.type = mutateSubgraph(program, [options.recur ?? self], prop.type).type;
        }
      },
    },
  };
  const self: Mutator = {
    name: "VisibilityFilter",
    Union: {
      filter: () => MutatorFlow.DoNotRecur,
      mutate: (union, clone, program) => {
        for (const [key, member] of union.variants) {
          if (member.type.kind === "Model" || member.type.kind === "Union") {
            const variant: UnionVariant = {
              ...member,
              type: mutateSubgraph(program, [self], member.type).type,
            };
            clone.variants.set(key, variant);
          }
        }
      },
    },
    Model: {
      filter: () => MutatorFlow.DoNotRecur,
      mutate: (model, clone, program, realm) => {
        for (const [key, prop] of model.properties) {
          if (!isVisible(program, prop, filter)) {
            // Property is not visible, remove it
            clone.properties.delete(key);
            realm.remove(clone);
          } else {
            const mutated = mutateSubgraph(program, [mpMutator], prop);

            clone.properties.set(key, mutated.type as ModelProperty);
          }
        }

        if (options.decoratorFn) {
          clone.decorators = clone.decorators.filter((d) => d.decorator !== options.decoratorFn);
        }
      },
    },
    ModelProperty: {
      filter: () => MutatorFlow.DoNotRecur,
      mutate: (prop, clone, program) => {
        if (isMutableType(prop.type)) {
          clone.type = mutateSubgraph(program, [self], prop.type).type;
        }
      },
    },
    Tuple: {
      filter: () => MutatorFlow.DoNotRecur,
      mutate: (tuple, clone, program) => {
        for (const [index, element] of tuple.values.entries()) {
          if (isMutableType(element)) {
            clone.values[index] = mutateSubgraph(program, [self], element).type;
          }
        }
      },
    },
  };

  return self;
}

// #endregion
