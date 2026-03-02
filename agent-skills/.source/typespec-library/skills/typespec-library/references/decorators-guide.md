# Decorators Guide

Complete reference for implementing TypeSpec decorators.

## Table of Contents

- [Declaration](#declaration)
- [JavaScript implementation](#javascript-implementation)
- [Parameter marshalling](#parameter-marshalling)
- [State management](#state-management)
- [Validation](#validation)
- [Accessor pattern](#accessor-pattern)
- [End-to-end example](#end-to-end-example)
- [Linking and troubleshooting](#linking-and-troubleshooting)

## Declaration

Declare decorator signatures in `lib/main.tsp` using `extern dec`:

```typespec
import "../dist/index.js";
namespace MyLib;

// Basic decorator
extern dec tag(target: Model, value: valueof string);

// Multiple target types
extern dec track(target: Model | Enum);

// Optional parameter
extern dec label(target: Model, name?: valueof string);

// Rest parameters
extern dec tags(target: Model, ...values: valueof string[]);
```

### Target types

The first parameter specifies what the decorator can be applied to:

| Target type | Applied to |
|-------------|-----------|
| `unknown` | Anything |
| `Model` | Models |
| `ModelProperty` | Model properties |
| `Operation` | Operations |
| `Interface` | Interfaces |
| `Enum` | Enums |
| `EnumMember` | Enum members |
| `Union` | Unions |
| `Scalar` | Scalars |
| `Namespace` | Namespaces |
| `Model \| Enum` | Union of targets |

### Value parameters

Use `valueof` to receive JavaScript values instead of TypeSpec types:

```typespec
extern dec maxItems(target: Model, count: valueof int32);
extern dec doc(target: unknown, text: valueof string);
```

## JavaScript implementation

Two approaches for implementing decorators:

### Approach 1: `$` prefix (simple)

```ts
// src/decorators.ts
import { DecoratorContext, Model } from "@typespec/compiler";

export function $tag(context: DecoratorContext, target: Model, value: string) {
  context.program.stateMap(StateKeys.tag).set(target, value);
}
```

### Approach 2: `$decorators` export (recommended for libraries)

```ts
// src/index.ts
export const $decorators = {
  "MyLib": {
    tag: tagDecoratorFn,
    label: labelDecoratorFn,
  },
};
```

### Decorator function signature

```ts
function $myDecorator(
  context: DecoratorContext,  // Always first
  target: Model,             // The decorated type (matches declaration)
  ...args: any[]             // Remaining decorator arguments
)
```

## Parameter marshalling

When decorators receive TypeSpec values (via `valueof`), they are marshalled to JavaScript types:

| TypeSpec value type | JavaScript type |
|--------------------|--------------------|
| `valueof string` | `string` |
| `valueof boolean` | `boolean` |
| `valueof int32`, `valueof float32`, etc. | `number` |
| `valueof int64`, `valueof numeric`, `valueof decimal` | `Numeric` |
| `valueof null` | `null` |
| enum member value | `EnumMemberValue` |

When a parameter is a TypeSpec type (no `valueof`), the type object is passed as-is.

### String templates

String templates passed to `valueof string` parameters are marshalled as interpolated strings:

```typespec
@doc("Hello ${name}!")  // JS receives: "Hello World!"
```

## State management

Store decorator metadata using `program.stateMap` or `program.stateSet`. Never use global variables.

### State keys

Define state keys in your library definition:

```ts
// src/lib.ts
export const $lib = createTypeSpecLibrary({
  name: "my-library",
  state: {
    tag: { description: "State for @tag decorator" },
    tracked: { description: "Set of types with @track" },
  },
} as const);

export const StateKeys = $lib.stateKeys;
```

### stateMap — key-value storage

```ts
import { StateKeys } from "./lib.js";

export function $tag(context: DecoratorContext, target: Model, value: string) {
  context.program.stateMap(StateKeys.tag).set(target, value);
}
```

### stateSet — membership tracking

```ts
export function $track(context: DecoratorContext, target: Model) {
  context.program.stateSet(StateKeys.tracked).add(target);
}
```

## Validation

### Immediate validation

For simple parameter checks:

```ts
export function $maxItems(context: DecoratorContext, target: Model, count: number) {
  if (count < 0) {
    reportDiagnostic(context.program, {
      code: "invalid-max-items",
      target: context.getArgumentTarget(0)!, // Points to the argument in source
    });
  }
}
```

### Post-validation: `onTargetFinish`

Validate after all decorators are applied to the target:

```ts
export function $track(context: DecoratorContext, target: Model) {
  return {
    onTargetFinish() {
      if (isDeprecated(context.program, target)) {
        return [createDiagnostic({ code: "track-deprecated-conflict", target: context.decoratorTarget })];
      }
      return [];
    },
  };
}
```

### Post-validation: `onGraphFinish`

Validate after the entire type graph is resolved:

```ts
export function $foreignKey(context: DecoratorContext, target: ModelProperty, ref: Model) {
  return {
    onGraphFinish() {
      const keys = getKeyProperties(context.program, ref);
      if (keys.length === 0) {
        return [createDiagnostic({ code: "no-primary-key", target: context.decoratorTarget })];
      }
      return [];
    },
  };
}
```

### Choosing the right validation approach

- **Immediate** — Parameter validation, simple checks
- **`onTargetFinish`** — Decorator combination conflicts on a single type
- **`onGraphFinish`** — Cross-type relationship validation

## Accessor pattern

Provide accessor functions for other libraries/emitters to read decorator state:

```ts
import { Program, Model } from "@typespec/compiler";
import { StateKeys } from "./lib.js";

export function getTag(program: Program, target: Model): string | undefined {
  return program.stateMap(StateKeys.tag).get(target);
}

export function isTracked(program: Program, target: Model): boolean {
  return program.stateSet(StateKeys.tracked).has(target);
}

export function getTrackedModels(program: Program): Set<Model> {
  return program.stateSet(StateKeys.tracked) as Set<Model>;
}
```

## End-to-end example

### 1. Library definition

```ts
// src/lib.ts
import { createTypeSpecLibrary, paramMessage } from "@typespec/compiler";

export const $lib = createTypeSpecLibrary({
  name: "@myorg/my-lib",
  diagnostics: {
    "duplicate-label": {
      severity: "warning",
      messages: {
        default: paramMessage`Label '${"label"}' is already used on '${"existingType"}'.`,
      },
    },
  },
  state: {
    label: { description: "State for @label decorator" },
  },
} as const);

export const { reportDiagnostic, createDiagnostic } = $lib;
export const StateKeys = $lib.stateKeys;
```

### 2. TypeSpec declaration

```typespec
// lib/main.tsp
import "../dist/index.js";
namespace MyOrg.MyLib;

extern dec label(target: Model, name: valueof string);
```

### 3. Decorator implementation

```ts
// src/decorators.ts
import { DecoratorContext, Model, Program } from "@typespec/compiler";
import { reportDiagnostic, StateKeys } from "./lib.js";

export function $label(context: DecoratorContext, target: Model, name: string) {
  // Check for duplicates
  for (const [existingType, existingLabel] of context.program.stateMap(StateKeys.label)) {
    if (existingLabel === name && existingType !== target) {
      reportDiagnostic(context.program, {
        code: "duplicate-label",
        format: { label: name, existingType: (existingType as Model).name },
        target: context.getArgumentTarget(0)!,
      });
    }
  }
  context.program.stateMap(StateKeys.label).set(target, name);
}

// Accessor
export function getLabel(program: Program, target: Model): string | undefined {
  return program.stateMap(StateKeys.label).get(target);
}
```

### 4. Entry point

```ts
// src/index.ts
export { $lib } from "./lib.js";
export { $label, getLabel } from "./decorators.js";
```

## Linking and troubleshooting

Decorator signatures are linked to JS implementations by name and namespace:

```typespec
// Global namespace
extern dec customName(target: Type, name: valueof string);
// -> links to exported $customName

// In a namespace
namespace MyLib {
  extern dec tableName(target: Type, name: valueof string);
}
// -> links to $tableName with setTypeSpecNamespace("MyLib", $tableName)
```

### Common issues

- **"Extern declaration must have an implementation"** — Check that JS function is prefixed with `$`, is in the correct namespace, and the JS file is imported in `main.tsp`.
- Use `--trace bind.js.decorator` to debug decorator loading.

> **Source:** `website/src/content/docs/docs/extending-typespec/create-decorators.md`
