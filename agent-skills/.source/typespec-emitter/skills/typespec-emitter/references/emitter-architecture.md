# Emitter Architecture

Architecture patterns and decision guides for TypeSpec emitters.

## Table of Contents

- [Custom Output wrapper](#custom-output-wrapper)
- [Type collection strategies](#type-collection-strategies)
- [Component overrides](#component-overrides)
- [Emitter options patterns](#emitter-options-patterns)
- [Decision tree: mutators vs component logic](#decision-tree-mutators-vs-component-logic)

## Custom Output wrapper

Most emitters wrap the framework's `Output` component with a custom version that sets up language-specific configuration.

### Python emitter pattern (ariadne-emitter)

```tsx
// components/output.tsx
import { Children } from "@alloy-js/core";
import * as py from "@alloy-js/python";
import { Program } from "@typespec/compiler";
import { Output as FrameworkOutput, useTsp } from "@typespec/emitter-framework";
import { typingModule } from "@typespec/emitter-framework/python";

interface OutputProps {
  program: Program;
  children?: Children;
  externals?: py.ExternalModuleRecord[];
  namePolicy?: any;
}

export function Output(props: OutputProps) {
  return (
    <FrameworkOutput
      program={props.program}
      externals={[typingModule, py.dataclassesModule, ...(props.externals ?? [])]}
      namePolicy={props.namePolicy ?? py.createPythonNamePolicy()}
    >
      {props.children}
    </FrameworkOutput>
  );
}
```

### TypeScript emitter pattern (http-client-js)

```tsx
// components/output.tsx
import { Children, SourceDirectory } from "@alloy-js/core";
import * as ts from "@alloy-js/typescript";
import { Program } from "@typespec/compiler";
import { Output as FrameworkOutput } from "@typespec/emitter-framework";

interface OutputProps {
  program: Program;
  children?: Children;
}

export function Output(props: OutputProps) {
  return (
    <FrameworkOutput program={props.program}>
      <ts.PackageDirectory name="my-sdk" version="1.0.0" path=".">
        <SourceDirectory path="src">
          <ts.BarrelFile export="." />
          {props.children}
        </SourceDirectory>
      </ts.PackageDirectory>
    </FrameworkOutput>
  );
}
```

### Key configuration points

- **`externals`** — External module references for import resolution (Python: `dataclasses`, `typing`, etc.)
- **`namePolicy`** — Controls casing (PascalCase types, camelCase/snake_case members)
- **Package structure** — TypeScript emitters often use `ts.PackageDirectory` for `package.json`/`tsconfig.json`

## Type collection strategies

### Strategy 1: Typekit iteration (recommended)

Use the Typekit (`$`) from `useTsp()` to find types:

```tsx
function Models() {
  const { $ } = useTsp();
  // Get all models from the program, filtering out built-ins
  const models = $.model.list().filter(m =>
    !$.model.isExpression(m) && m.namespace?.name !== "TypeSpec"
  );
  return models.map(m => <ModelFile model={m} />);
}
```

### Strategy 2: navigateProgram

Walk the entire type graph with callbacks:

```tsx
import { navigateProgram } from "@typespec/compiler";

function collectTypes(program: Program) {
  const models: Model[] = [];
  const operations: Operation[] = [];
  navigateProgram(program, {
    model(m) { models.push(m); },
    operation(o) { operations.push(o); },
  });
  return { models, operations };
}
```

**Caveat:** Visits ALL types including built-ins and library types. Filter by namespace or decorator.

### Strategy 3: Namespace filtering

Start from a specific namespace and walk its contents:

```tsx
function getServiceTypes(program: Program) {
  const serviceNs = program.resolveTypeReference("MyService")[0];
  if (serviceNs?.kind === "Namespace") {
    return {
      models: [...serviceNs.models.values()],
      operations: [...serviceNs.operations.values()],
      interfaces: [...serviceNs.interfaces.values()],
    };
  }
}
```

### Strategy 4: Decorator-based filtering

Use decorators to mark types for emission:

```tsx
function getEmittableModels(program: Program) {
  return [...program.stateSet(StateKeys.emitThis)] as Model[];
}
```

## Component overrides

Use `Experimental_ComponentOverridesConfig` to customize how specific types render without modifying framework components.

```tsx
import {
  Experimental_ComponentOverrides,
  Experimental_ComponentOverridesConfig,
  useTsp,
} from "@typespec/emitter-framework";
import { TypeExpression } from "@typespec/emitter-framework/typescript";

function MyOverrides(props: { children?: Children }) {
  const { $ } = useTsp();
  const overrides = Experimental_ComponentOverridesConfig()
    .forTypeKind("Model", {
      reference: (props) => {
        // Custom rendering for model references
        if (isSpecialType($, props.type)) {
          return <CustomTypeExpression type={props.type} />;
        }
        return props.default; // Fall back to default rendering
      },
    });

  return (
    <Experimental_ComponentOverrides overrides={overrides}>
      {props.children}
    </Experimental_ComponentOverrides>
  );
}
```

### Usage

Wrap your output tree with the overrides:

```tsx
<Output program={context.program}>
  <MyOverrides>
    {/* All components inside will use overrides */}
    <Models />
    <Operations />
  </MyOverrides>
</Output>
```

### Override points

Each type kind can override:
- `reference` — How the type is referenced (import + identifier)
- `declaration` — How the type is declared (full declaration statement)

## Emitter options patterns

### Defining options

```ts
// src/lib.ts
import { JSONSchemaType, createTypeSpecLibrary } from "@typespec/compiler";

export interface MyEmitterOptions {
  "package-name": string;
  "output-format": "classes" | "interfaces";
  "include-validation": boolean;
}

const schema: JSONSchemaType<MyEmitterOptions> = {
  type: "object",
  additionalProperties: false,
  properties: {
    "package-name": { type: "string", nullable: true },
    "output-format": { type: "string", enum: ["classes", "interfaces"], nullable: true },
    "include-validation": { type: "boolean", nullable: true },
  },
  required: [],
};
```

### Accessing options

```tsx
export async function $onEmit(context: EmitContext<MyEmitterOptions>) {
  const packageName = context.options["package-name"] ?? "my-package";
  const format = context.options["output-format"] ?? "interfaces";
  // Pass to components via props or context
}
```

### Convention

- Use `kebab-case` for option names
- No dots in option names
- Use `format: "absolute-path"` for path options
- Provide sensible defaults (options are always optional at runtime)

## Decision tree: mutators vs component logic

```
Does the transformation change the TYPE GRAPH structure?
├── YES: Is it needed by MULTIPLE components?
│   ├── YES: Use MUTATOR
│   │   Examples: flatten spreads, normalize nullables, rename all types
│   └── NO: Could it be needed later by other components?
│       ├── LIKELY: Use MUTATOR (invest upfront)
│       └── UNLIKELY: Use COMPONENT LOGIC
└── NO: Is it just output FORMATTING?
    └── YES: Use COMPONENT LOGIC
        Examples: add decorators to output, wrap in namespace, add imports
```

### Examples of mutator use

- **Flatten spread types:** `{ ...Base, extra: string }` → concrete properties
- **Normalize nullables:** `T | null` → target-specific nullable wrapper
- **Add suffixes:** All models get `Dto` suffix for data transfer objects
- **Resolve template types:** Expand generic instantiations

### Examples of component logic

- **Format a model as a class vs interface** — depends on emitter options
- **Add framework decorators** — `@Column()`, `@Field()`, etc.
- **Generate import statements** — handled by Alloy-JS refkey system
- **Wrap in namespace/module** — structural, not type-level

> **Reference:** `packages/ariadne-emitter/src/` (simple emitter), `packages/http-client-js/src/` (full-featured emitter)
