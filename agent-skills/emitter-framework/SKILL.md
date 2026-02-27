---
name: emitter-framework
description: "Guide for building TypeSpec emitters using the emitter framework (@typespec/emitter-framework). Use when the agent needs to (1) create a new TypeSpec emitter that generates code from TypeSpec types, (2) add or modify components in an existing emitter (TypeExpression, TypeDeclaration, declarations), (3) add a new language target to the emitter framework (e.g., Go, Java, Rust), (4) work with the JSX-based component model, Alloy-JS integration, refkeys, or the rendering pipeline, (5) write or debug scenario-based snapshot tests for emitters, or (6) understand the emitter framework architecture and APIs."
---

# Emitter Framework

Build TypeSpec emitters using the `@typespec/emitter-framework` JSX-based component model.

## Architecture

```
TypeSpec Compiler ──> Emitter Framework ──> Alloy-JS ──> Output Files
   (type graph)     (context, hooks,      (rendering,
                     type mapping)         file output)
```

- **TypeSpec compiler** provides the type graph (models, operations, enums, unions, scalars)
- **Emitter framework** provides `Output`, `useTsp()`, and language-specific components for mapping types to code
- **Alloy-JS** handles rendering: JSX evaluation, cross-file reference resolution, import generation, file output

## 1. Project setup

### Dependencies

Your emitter needs these packages:

- `@typespec/compiler` — the TypeSpec compiler, provides the type graph
- `@typespec/emitter-framework` — the framework itself (Output, useTsp, writeOutput, etc.)
- An Alloy-JS language package for your target language:
  - `@alloy-js/typescript` for TypeScript output
  - `@alloy-js/python` for Python output
  - `@alloy-js/csharp` for C# output
- `@alloy-js/core` — Alloy-JS core (SourceDirectory, SourceFile, rendering primitives)

### TypeScript configuration

Your `tsconfig.json` needs JSX support configured for Alloy-JS:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@alloy-js/core"
  }
}
```

Use `.tsx` file extensions for any file containing JSX.

## 2. The `$onEmit` entry point

Every emitter exports an async `$onEmit` function that receives an `EmitContext`:

1. Receive `EmitContext` with `program` and `options`
2. Build a JSX tree rooted in `<Output program={context.program}>`
3. Call `writeOutput(program, tree, emitterOutputDir)` to render and write files

### Minimal example (based on ariadne-emitter)

```tsx
import { SourceDirectory } from "@alloy-js/core";
import * as py from "@alloy-js/python";
import { type EmitContext } from "@typespec/compiler";
import { writeOutput } from "@typespec/emitter-framework";
import { Output } from "./components/output.jsx";
import { Operations } from "./components/operations.jsx";

export async function $onEmit(context: EmitContext) {
  writeOutput(
    context.program,
    <Output
      program={context.program}
      externals={[py.dataclassesModule]}
      namePolicy={py.createPythonNamePolicy()}
    >
      <SourceDirectory path="operations">
        <Operations />
      </SourceDirectory>
    </Output>,
    context.emitterOutputDir,
  );
}
```

> **Reference:** `packages/ariadne-emitter/src/emitter.tsx` — simplest real emitter

### Full-featured example (based on http-client-js)

```tsx
import { Children, SourceDirectory } from "@alloy-js/core";
import * as ts from "@alloy-js/typescript";
import { EmitContext } from "@typespec/compiler";
import { writeOutput } from "@typespec/emitter-framework";
import { Output } from "./components/output.jsx";
import { Models } from "./components/models.js";
import { Client } from "./components/client.jsx";

export async function $onEmit(context: EmitContext<MyEmitterOptions>) {
  const packageName = context.options["package-name"] ?? "test-package";
  const output = (
    <Output program={context.program}>
      <ts.PackageDirectory name={packageName} version="1.0.0" path=".">
        <SourceDirectory path="src">
          <ts.BarrelFile export="." />
          <Client />
          <SourceDirectory path="models">
            <ts.BarrelFile export="models" />
            <Models />
          </SourceDirectory>
        </SourceDirectory>
      </ts.PackageDirectory>
    </Output>
  );

  await writeOutput(context.program, output, context.emitterOutputDir);
}
```

> **Reference:** `packages/http-client-js/src/emitter.tsx` — full-featured emitter

## 3. Directory and file structure

The JSX tree maps directly to directory/file structure on disk.

- `SourceDirectory` (from `@alloy-js/core`) — creates a directory. Nest for subdirectories.
- `SourceFile` — creates a file. Available from `@alloy-js/core` or language-specific packages.
- **TypeScript:** `ts.PackageDirectory` (creates `package.json` + `tsconfig.json`), `ts.SourceFile`, `ts.BarrelFile` (index.ts re-exports)
- **Python:** `py.SourceFile`

```tsx
<Output program={context.program}>
  <ts.PackageDirectory name="my-sdk" version="1.0.0" path=".">
    <SourceDirectory path="src">
      <ts.BarrelFile export="." />
      <ts.SourceFile path="client.ts">
        {/* client code */}
      </ts.SourceFile>
      <SourceDirectory path="models">
        <ts.BarrelFile export="models" />
        {/* model files */}
      </SourceDirectory>
    </SourceDirectory>
  </ts.PackageDirectory>
</Output>
```

Produces:

```
my-sdk/
  package.json
  tsconfig.json
  src/
    index.ts          (barrel file)
    client.ts
    models/
      index.ts        (barrel file)
```

## 4. Writing components

Components are plain functions that return JSX. Use the `useTsp()` hook to access the TypeSpec program and Typekit.

```tsx
import { useTsp } from "@typespec/emitter-framework";

function MyComponent() {
  const { program, $ } = useTsp();
  // program: the TypeSpec Program object
  // $: the Typekit for type introspection
}
```

The `$` (Typekit) provides introspection methods: `$.model.getProperties()`, `$.scalar.is()`, `$.array.is()`, `$.record.is()`, `$.type.getDoc()`, etc.

### Example: iterating over types

```tsx
import * as ts from "@alloy-js/typescript";
import { useTsp } from "@typespec/emitter-framework";
import { TypeDeclaration } from "@typespec/emitter-framework/typescript";

function Models() {
  const { $ } = useTsp();
  const models = getRelevantModels($);

  return models.map((model) => (
    <ts.SourceFile path={`${model.name}.ts`}>
      <TypeDeclaration type={model} />
    </ts.SourceFile>
  ));
}
```

## 5. Type mapping with TypeExpression

Each target language provides a `TypeExpression` component that maps TypeSpec types to language-specific type expressions.

```tsx
import { TypeExpression } from "@typespec/emitter-framework/typescript";
// or: import { TypeExpression } from "@typespec/emitter-framework/python";

function MyProperty(props: { type: Type }) {
  return <TypeExpression type={props.type} />;
}
```

`TypeExpression` handles scalars/intrinsics, literal values, arrays, records, unions, tuples, model references, and operation/function types. When a type is a named declaration, it automatically emits a reference (using `efRefkey`) rather than inlining.

For the complete intrinsic type mapping table across all languages, see [references/language-target.md](references/language-target.md) (section "Intrinsic type map").

> **Reference:** `packages/emitter-framework/src/typescript/components/type-expression.tsx`
> **Reference:** `packages/emitter-framework/src/python/components/type-expression/type-expression.tsx`

## 6. Declarations with TypeDeclaration

`TypeDeclaration` routes a TypeSpec type to the correct language-specific declaration based on `type.kind`.

### TypeScript routing

| TypeSpec kind | TypeScript declaration |
|---------------|----------------------|
| `Model` | `InterfaceDeclaration` |
| `Union` | `UnionDeclaration` |
| `Enum` | `EnumDeclaration` |
| `Scalar` | `TypeAliasDeclaration` |
| `Operation` | `TypeAliasDeclaration` |

```tsx
import { TypeDeclaration } from "@typespec/emitter-framework/typescript";

// Automatically picks the right declaration type
<TypeDeclaration type={someType} />
```

For the full list of declaration components per language, see [references/api-reference.md](references/api-reference.md).

> **Reference:** `packages/emitter-framework/src/typescript/components/type-declaration.tsx`

## 7. Name policies

Name policies control casing conventions for the target language, provided by Alloy-JS language packages:

- `useTSNamePolicy()` — camelCase members, PascalCase types
- `usePythonNamePolicy()` — snake_case members, PascalCase classes
- `createPythonNamePolicy()` — creates instance to pass to `<Output>`

```tsx
import * as py from "@alloy-js/python";

<Output program={context.program} namePolicy={py.createPythonNamePolicy()}>
  {/* children */}
</Output>
```

The framework also provides `createTransformNamePolicy()` for managing transport names (wire format) vs. application names (SDK conventions):

```tsx
import { createTransformNamePolicy } from "@typespec/emitter-framework";

const policy = createTransformNamePolicy({
  transportNamer: (type) => type.name,
  applicationNamer: (type) => camelCase(type.name),
});
```

## 8. Refkeys and cross-file references

The Alloy-JS refkey system handles cross-file references automatically — when you reference a type declared in one file from another file, the framework generates the correct import statement.

1. Declarations register themselves with a refkey (a unique identifier)
2. References use the same refkey to point to the declaration
3. Alloy-JS resolves the refkeys at render time and generates imports

```tsx
import { efRefkey } from "@typespec/emitter-framework/typescript";

// Create a refkey for a TypeSpec type
const key = efRefkey(someType);

// Use in a declaration
<InterfaceDeclaration refkey={key} name="Widget" type={widgetModel} />

// Reference from another file — the import is generated automatically
<Reference refkey={key} />
```

`efRefkey()` wraps Alloy-JS's `refkey()` with a per-language namespace prefix to avoid collisions. With no arguments it generates a unique key; with a TypeSpec type it creates a deterministic key.

## 9. Component overrides (experimental)

`Experimental_ComponentOverridesConfig` customizes how specific types or type kinds render:

```tsx
import {
  Experimental_ComponentOverrides,
  Experimental_ComponentOverridesConfig,
  useTsp,
} from "@typespec/emitter-framework";
import { TypeExpression } from "@typespec/emitter-framework/typescript";

export function HttpClientOverrides(props: { children?: Children }) {
  const { $ } = useTsp();
  const overrides = Experimental_ComponentOverridesConfig().forTypeKind("Model", {
    reference: (props) => {
      if ($.httpPart.is(props.type)) {
        return <TypeExpression type={$.httpPart.unpack(props.type)} />;
      } else {
        return props.default;
      }
    },
  });
  return (
    <Experimental_ComponentOverrides overrides={overrides}>
      {props.children}
    </Experimental_ComponentOverrides>
  );
}
```

Wrap your output tree with the overrides component:

```tsx
<Output program={context.program}>
  <HttpClientOverrides>
    {/* your output tree */}
  </HttpClientOverrides>
</Output>
```

> **Reference:** `packages/http-client-js/src/emitter.tsx` lines 68-84

## 10. Testing with scenario files

The framework provides `executeScenarios()` for markdown-based snapshot testing. Each `.md` file contains TypeSpec input and expected output.

### Setting up tests

```ts
import {
  createSnippetExtractor,
  createTypeScriptExtractorConfig,
  executeScenarios,
} from "@typespec/emitter-framework/testing";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { Tester } from "./test-host.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const tsExtractorConfig = await createTypeScriptExtractorConfig();
const snippetExtractor = createSnippetExtractor(tsExtractorConfig);
const scenarioPath = join(__dirname, "scenarios");

await executeScenarios(
  Tester.import("@typespec/http", "@typespec/rest").using("Http", "Rest"),
  tsExtractorConfig,
  scenarioPath,
  snippetExtractor,
);
```

> **Reference:** `packages/http-client-js/test/scenarios.test.ts`

### Scenario file format

Scenarios are separated by `#` (H1) headings. Each scenario has a `` ```tsp `` block with TypeSpec input and one or more language output blocks.

The language code block heading format: `<lang> <file-path> [type] [name]`

- `lang` — language identifier (`ts`, `py`, `cs`)
- `file-path` — expected output file path (e.g., `src/models/models.ts`)
- `type` (optional) — declaration type to extract: `interface`, `class`, `function`, `type`, `enum`
- `name` (optional) — declaration name to extract

When `type` and `name` are provided, only that declaration is extracted for comparison. When omitted, the entire file content is compared.

### Updating snapshots

Set `RECORD=true` or `SCENARIOS_UPDATE=true` to auto-update expected output:

```bash
RECORD=true npx vitest run
```

> **Reference:** `packages/emitter-framework/src/testing/scenario-test/harness.ts`
> **Reference:** `packages/http-client-js/test/scenarios/models/basic.md`

## Other workflows

### Adding a new language target to the framework

1. Verify prerequisites: `@alloy-js/<lang>` package and `tree-sitter-<lang>` grammar must exist
2. Create `src/<lang>/` directory with infrastructure files (refkeys, diagnostics, barrels)
3. Implement core components: `TypeExpression`, `TypeDeclaration`, model/enum/alias declarations
4. Add array and record expression components
5. Optionally add `builtins.ts` for languages requiring stdlib imports (Go, Rust)
6. Configure `package.json` exports, imports, and dependencies
7. Add testing support with extractor config

For the complete guide with code patterns and implementation checklist, see [references/language-target.md](references/language-target.md).

## Reference files

- **[references/concepts.md](references/concepts.md)** — Architecture deep-dive: component model, rendering pipeline, type system bridge (Typekit, TypeExpression, TypeDeclaration, SCCSet), language support details, and the mutator framework.
- **[references/language-target.md](references/language-target.md)** — Complete guide for adding a new language target (Go, Java, Rust, etc.) to the emitter framework. Includes directory layout, code patterns for every required component, intrinsic type mapping table, package.json configuration, and implementation checklist.
- **[references/api-reference.md](references/api-reference.md)** — Lookup table of all framework exports organized by import path (`@typespec/emitter-framework`, `/typescript`, `/python`, `/csharp`, `/testing`). Includes component props, utility functions, and the scenario file format.

## Key source locations

| Area | Path |
|------|------|
| Core framework | `packages/emitter-framework/src/core/` |
| TypeScript target | `packages/emitter-framework/src/typescript/` |
| Python target | `packages/emitter-framework/src/python/` |
| C# target | `packages/emitter-framework/src/csharp/` |
| Testing utilities | `packages/emitter-framework/src/testing/` |
| Mutator framework | `packages/mutator-framework/` |
| Example emitter (simple) | `packages/ariadne-emitter/` |
| Example emitter (full) | `packages/http-client-js/` |
