# Example Walkthrough

Step-by-step walkthrough building a minimal TypeSpec emitter from scratch.

## Table of Contents

- [Goal](#goal)
- [Step 1: Starting TypeSpec spec](#step-1-starting-typespec-spec)
- [Step 2: Desired output](#step-2-desired-output)
- [Step 3: Create the library package](#step-3-create-the-library-package)
- [Step 4: Define the $onEmit entry point](#step-4-define-the-onemit-entry-point)
- [Step 5: Build the Output component](#step-5-build-the-output-component)
- [Step 6: Build the Models component](#step-6-build-the-models-component)
- [Step 7: Build the Operations component](#step-7-build-the-operations-component)
- [Step 8: Write scenario tests](#step-8-write-scenario-tests)
- [Step 9: Run and iterate](#step-9-run-and-iterate)

## Goal

Build a minimal TypeScript emitter that generates interfaces for models and typed function signatures for operations.

## Step 1: Starting TypeSpec spec

```tsp
model Widget {
  id: string;
  name: string;
  weight: float32;
}

model WidgetList {
  items: Widget[];
  nextLink?: url;
}

op getWidget(@path id: string): Widget;
op listWidgets(): WidgetList;
```

## Step 2: Desired output

```
output/
├── src/
│   ├── index.ts
│   ├── models/
│   │   ├── index.ts
│   │   ├── widget.ts
│   │   └── widget-list.ts
│   └── operations/
│       ├── index.ts
│       └── operations.ts
```

`widget.ts`:
```ts
export interface Widget {
  id: string;
  name: string;
  weight: number;
}
```

`widget-list.ts`:
```ts
import { Widget } from "./widget.js";

export interface WidgetList {
  items: Widget[];
  nextLink?: string;
}
```

`operations.ts`:
```ts
import { Widget } from "../models/widget.js";
import { WidgetList } from "../models/widget-list.js";

export function getWidget(id: string): Widget;
export function listWidgets(): WidgetList;
```

## Step 3: Create the library package

```bash
tsp init --template emitter-ts
```

Install emitter framework dependencies:

```bash
npm install --save-peer @typespec/emitter-framework
npm install --save-peer @alloy-js/core @alloy-js/typescript
```

Update `tsconfig.json`:

```jsonc
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@alloy-js/core"
  }
}
```

Define the library in `src/lib.ts`:

```ts
import { createTypeSpecLibrary } from "@typespec/compiler";

export const $lib = createTypeSpecLibrary({
  name: "my-emitter",
  diagnostics: {},
} as const);
```

Export from `src/index.ts`:

```ts
export { $lib } from "./lib.js";
export { $onEmit } from "./emitter.js";
```

## Step 4: Define the $onEmit entry point

```tsx
// src/emitter.tsx
import { SourceDirectory } from "@alloy-js/core";
import * as ts from "@alloy-js/typescript";
import { type EmitContext } from "@typespec/compiler";
import { writeOutput } from "@typespec/emitter-framework";
import { Output } from "./components/output.jsx";
import { Models } from "./components/models.jsx";
import { Operations } from "./components/operations.jsx";

export async function $onEmit(context: EmitContext) {
  const tree = (
    <Output program={context.program}>
      <ts.PackageDirectory name="my-output" version="1.0.0" path=".">
        <SourceDirectory path="src">
          <ts.BarrelFile export="." />
          <SourceDirectory path="models">
            <ts.BarrelFile export="models" />
            <Models />
          </SourceDirectory>
          <SourceDirectory path="operations">
            <ts.BarrelFile export="operations" />
            <Operations />
          </SourceDirectory>
        </SourceDirectory>
      </ts.PackageDirectory>
    </Output>
  );

  await writeOutput(context.program, tree, context.emitterOutputDir);
}
```

## Step 5: Build the Output component

```tsx
// src/components/output.tsx
import { Children } from "@alloy-js/core";
import { Program } from "@typespec/compiler";
import { Output as FrameworkOutput } from "@typespec/emitter-framework";

interface OutputProps {
  program: Program;
  children?: Children;
}

export function Output(props: OutputProps) {
  return (
    <FrameworkOutput program={props.program}>
      {props.children}
    </FrameworkOutput>
  );
}
```

The `Output` component wraps the framework's `Output`, which sets up the TypeSpec context (makes `useTsp()` available to all child components).

## Step 6: Build the Models component

```tsx
// src/components/models.tsx
import * as ts from "@alloy-js/typescript";
import { useTsp } from "@typespec/emitter-framework";
import { TypeDeclaration } from "@typespec/emitter-framework/typescript";

export function Models() {
  const { $ } = useTsp();

  // Collect non-built-in, non-expression models
  const models = [...$.program.checker.getGlobalNamespaceType().models.values()].filter(
    (m) => !$.model.isExpression(m),
  );

  return models.map((model) => (
    <ts.SourceFile path={`${kebabCase(model.name)}.ts`}>
      <TypeDeclaration type={model} />
    </ts.SourceFile>
  ));
}

function kebabCase(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .toLowerCase();
}
```

`TypeDeclaration` automatically routes `Model` types to `InterfaceDeclaration`, generating the correct TypeScript interface with all properties and type expressions.

## Step 7: Build the Operations component

```tsx
// src/components/operations.tsx
import * as ts from "@alloy-js/typescript";
import { useTsp } from "@typespec/emitter-framework";
import { TypeExpression } from "@typespec/emitter-framework/typescript";

export function Operations() {
  const { $ } = useTsp();

  const operations = [
    ...$.program.checker.getGlobalNamespaceType().operations.values(),
  ];

  if (operations.length === 0) return null;

  return (
    <ts.SourceFile path="operations.ts">
      {operations.map((op) => (
        <OperationSignature operation={op} />
      ))}
    </ts.SourceFile>
  );
}

function OperationSignature(props: { operation: any }) {
  const { $ } = useTsp();
  const op = props.operation;
  const params = [...op.parameters.properties.values()];

  return (
    <ts.FunctionDeclaration export name={op.name}>
      {/* Parameters */}
      {params.map((param) => (
        <ts.FunctionDeclaration.Parameter
          name={param.name}
          type={<TypeExpression type={param.type} />}
          optional={param.optional}
        />
      ))}
      {/* Return type */}
      <ts.FunctionDeclaration.ReturnType>
        <TypeExpression type={op.returnType} />
      </ts.FunctionDeclaration.ReturnType>
    </ts.FunctionDeclaration>
  );
}
```

`TypeExpression` handles the type mapping — `string` stays `string`, `float32` becomes `number`, model references generate imports automatically via the refkey system.

## Step 8: Write scenario tests

Create the test setup:

```ts
// test/tester.ts
import { createTester } from "@typespec/compiler/testing";

export const Tester = createTester({
  libraries: ["my-emitter"],
});
```

Create a scenario file:

````markdown
<!-- test/scenarios/models/basic.md -->

# Basic model

```tsp
model Widget {
  id: string;
  name: string;
  weight: float32;
}
```

```ts src/models/widget.ts interface Widget
export interface Widget {
  id: string;
  name: string;
  weight: number;
}
```
````

Create the test runner:

```ts
// test/scenarios.test.ts
import {
  createSnippetExtractor,
  createTypeScriptExtractorConfig,
  executeScenarios,
} from "@typespec/emitter-framework/testing";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { Tester } from "./tester.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const tsExtractorConfig = await createTypeScriptExtractorConfig();
const snippetExtractor = createSnippetExtractor(tsExtractorConfig);

await executeScenarios(
  Tester,
  tsExtractorConfig,
  join(__dirname, "scenarios"),
  snippetExtractor,
);
```

## Step 9: Run and iterate

### First run — record snapshots

```bash
RECORD=true npx vitest run
```

This populates expected output in scenario files.

### Subsequent runs — verify snapshots

```bash
npx vitest run
```

Fails if output doesn't match scenarios.

### Iteration loop

1. Run tests to see current output
2. If output is wrong, fix the component
3. If output is right but snapshot is outdated, run with `RECORD=true`
4. Add new scenario files for edge cases (optionals, arrays, nested models, enums)

### Common edge cases to test

- Optional properties (`name?: string`)
- Array types (`items: Widget[]`)
- Record types (`metadata: Record<string>`)
- Cross-file references (model referencing another model)
- Enums and unions
- Nested models / inheritance
- Scalars with custom base types

> **Reference:** `packages/ariadne-emitter/` (simple real emitter), `packages/http-client-js/` (full-featured emitter)
