---
name: typespec-library
description: "Guide for creating TypeSpec libraries (packages with types, decorators, diagnostics, emitters, or linters). Use when the agent needs to (1) scaffold a new TypeSpec library or emitter package, (2) define or modify createTypeSpecLibrary configuration (diagnostics, state keys, emitter options), (3) implement or debug decorators (declaration, JS implementation, parameter marshalling, state management), (4) set up or fix testing infrastructure (createTester, tester chains, type collection), or (5) understand TypeSpec library package structure and conventions."
---

# TypeSpec Library

Create and maintain TypeSpec library packages — the foundation for decorators, emitters, and linters.

## Library structure

```
my-library/
├── lib/main.tsp          # TypeSpec entry point (imports JS, declares decorators)
├── src/
│   ├── index.ts           # Node entry point (re-exports $lib)
│   └── lib.ts             # Library definition (createTypeSpecLibrary)
├── test/
│   └── tester.ts          # Test setup (createTester)
├── package.json
└── tsconfig.json
```

## Quick start

```bash
# Library with decorators/linters
tsp init --template library-ts

# Emitter package
tsp init --template emitter-ts
```

## Package setup

### package.json essentials

```jsonc
{
  "type": "module",
  "main": "dist/src/index.js",
  "exports": {
    ".": { "typespec": "./lib/main.tsp" }
  },
  "peerDependencies": {
    "@typespec/compiler": "~0.67.0"
    // All TypeSpec library dependencies go here
  },
  "devDependencies": {
    "typescript": "~5.8.0",
    "vitest": "^3.1.4"
    // TypeSpec libs only used in tests go here
  }
}
```

**Key rule:** All TypeSpec libraries (including the compiler) used by your library go in `peerDependencies`. Only test-only TypeSpec libs go in `devDependencies`. Regular npm packages go in `dependencies`.

### tsconfig.json

```jsonc
{
  "compilerOptions": {
    "module": "Node16",
    "moduleResolution": "Node16",
    "target": "es2022",
    "rootDir": ".",
    "outDir": "./dist",
    "sourceMap": true,
    "strict": true,
    // For emitters using JSX:
    "jsx": "react-jsx",
    "jsxImportSource": "@alloy-js/core"
  }
}
```

Use `.tsx` extensions for files containing JSX (emitter components).

## Library definition (`src/lib.ts`)

Register your library with `createTypeSpecLibrary`. Export as `$lib`.

```ts
import { createTypeSpecLibrary, paramMessage } from "@typespec/compiler";

export const $lib = createTypeSpecLibrary({
  name: "my-library",
  diagnostics: {
    "invalid-usage": {
      severity: "error",
      messages: {
        default: "Invalid usage of this feature.",
      },
    },
    "missing-field": {
      severity: "warning",
      messages: {
        default: paramMessage`Missing field '${"fieldName"}' on type '${"typeName"}'.`,
      },
    },
  },
  state: {
    myDecorator: { description: "State for the @myDecorator decorator" },
  },
} as const);

export const { reportDiagnostic, createDiagnostic } = $lib;
export const StateKeys = $lib.stateKeys;
```

### Emitter options

For emitters, add an options schema:

```ts
import { JSONSchemaType, createTypeSpecLibrary } from "@typespec/compiler";

export interface MyEmitterOptions {
  "output-format": string;
}

const EmitterOptionsSchema: JSONSchemaType<MyEmitterOptions> = {
  type: "object",
  additionalProperties: false,
  properties: {
    "output-format": { type: "string", nullable: true },
  },
  required: [],
};

export const $lib = createTypeSpecLibrary({
  name: "my-emitter",
  diagnostics: {},
  emitter: {
    options: EmitterOptionsSchema,
  },
} as const);
```

**Option naming convention:** Use `kebab-case`. Avoid dots. Use `format: "absolute-path"` for path options.

## Diagnostics

### Severity levels

- `"error"` — Cannot be suppressed. Use for spec violations.
- `"warning"` — Can be suppressed with `#suppress`. Use for recommendations.

### Parameterized messages

```ts
import { paramMessage } from "@typespec/compiler";

messages: {
  default: paramMessage`Route '${"path"}' conflicts with '${"otherPath"}'.`,
}
```

### Reporting

```ts
import { reportDiagnostic } from "./lib.js";

// In decorators and $onEmit:
reportDiagnostic(program, {
  code: "missing-field",
  format: { fieldName: "id", typeName: "Widget" },
  target: diagnosticTarget,
});
```

### Diagnostic collector (for accessor functions)

Do not call `reportDiagnostic` directly in accessors. Return a tuple instead:

```ts
import { createDiagnosticCollector } from "@typespec/compiler";

function getRoutes(program: Program): [Route[], readonly Diagnostic[]] {
  const diagnostics = createDiagnosticCollector();
  diagnostics.add(createDiagnostic({ code: "no-array", target }));
  const result = diagnostics.pipe(getParameters()); // chain nested diagnostics
  return diagnostics.wrap(routes);
}
```

## Decorators

Decorators are declared in TypeSpec and implemented in JavaScript. For the complete guide including parameter marshalling, state management, validation callbacks, and end-to-end examples, see [references/decorators-guide.md](references/decorators-guide.md).

### Quick example

```typespec
// lib/main.tsp
import "../dist/index.js";
namespace MyLib;
extern dec tag(target: Model, value: valueof string);
```

```ts
// src/decorators.ts
import { DecoratorContext, Model } from "@typespec/compiler";
import { StateKeys } from "./lib.js";

export function $tag(context: DecoratorContext, target: Model, value: string) {
  context.program.stateMap(StateKeys.tag).set(target, value);
}

// Accessor
export function getTag(program: Program, target: Model): string | undefined {
  return program.stateMap(StateKeys.tag).get(target);
}
```

## The `main.tsp` file

```typespec
import "../dist/index.js";

namespace MyLib;

// Declare decorators (links to JS implementations by name)
extern dec tag(target: Model, value: valueof string);
extern dec customName(target: Model | ModelProperty, name: valueof string);
```

The `import "../dist/index.js"` ensures the library JS code runs when TypeSpec loads the package.

## Emitter entry point

```ts
// src/index.ts
export { $lib } from "./lib.js";

export async function $onEmit(context: EmitContext<MyEmitterOptions>) {
  const program = context.program;
  const options = context.options;
  const outputDir = context.emitterOutputDir;
  // Build output tree and write files
}
```

For emitters using the emitter framework, see the **emitter-framework** skill. For the full emitter lifecycle (planning, architecture, testing), see the **typespec-emitter** skill.

## Testing

Use `createTester` from `@typespec/compiler/testing`. For the complete testing guide with advanced patterns, see [references/testing-guide.md](references/testing-guide.md).

### Quick setup

```ts
// test/tester.ts
import { createTester } from "@typespec/compiler/testing";

export const Tester = createTester({
  libraries: ["@typespec/http", "my-library"],
});
```

### Basic test

```ts
import { t } from "@typespec/compiler/testing";
import { Tester } from "./tester.js";
import { it } from "vitest";
import { strictEqual } from "assert";

it("creates a model", async () => {
  const { Foo } = await Tester.compile(t.code`
    model ${t.model("Foo")} { name: string; }
  `);
  strictEqual(Foo.name, "Foo");
});

it("reports diagnostics", async () => {
  const diagnostics = await Tester.diagnose(`model Bar {}`);
  expectDiagnostics(diagnostics, { code: "my-library/some-code" });
});
```

### Tester chains

```ts
const HttpTester = Tester
  .import("@typespec/http")
  .using("Http");

// Add mock files
const WithMocks = Tester.files({
  "helpers.tsp": `model Helper {}`,
}).import("./helpers.tsp");
```

## Related skills

- **typespec-emitter** — End-to-end emitter lifecycle: interactive planning, design docs, architecture
- **emitter-framework** — JSX-based component model for building emitters
- **mutator-framework** — Type graph transformations before emission

## Key source locations

| Area | Path |
|------|------|
| Library basics docs | `website/src/content/docs/docs/extending-typespec/basics.md` |
| Emitter basics docs | `website/src/content/docs/docs/extending-typespec/emitters-basics.md` |
| Decorator docs | `website/src/content/docs/docs/extending-typespec/create-decorators.md` |
| Testing docs | `website/src/content/docs/docs/extending-typespec/testing.mdx` |
| Diagnostics docs | `website/src/content/docs/docs/extending-typespec/diagnostics.md` |
