# Testing Guide

Advanced testing patterns for TypeSpec libraries and emitters.

## Table of Contents

- [Tester setup](#tester-setup)
- [Tester chains](#tester-chains)
- [Type collection](#type-collection)
- [Diagnostic testing](#diagnostic-testing)
- [Emitter output testing](#emitter-output-testing)
- [Scenario files](#scenario-files)
- [Vitest configuration](#vitest-configuration)

## Tester setup

Create a root-level tester file shared across all tests:

```ts
// test/tester.ts
import { createTester } from "@typespec/compiler/testing";

export const Tester = createTester({
  libraries: ["@typespec/http", "@typespec/rest", "my-library"],
});
```

The tester caches file system calls between tests for performance.

**Important:** Unlike the old `createTestHost`, `createTester` does not auto-import libraries. Use `.importLibraries()` or `.import()` to add imports.

### Pre-configured tester

```ts
export const HttpTester = Tester
  .importLibraries()
  .using("Http", "Rest");
```

## Tester chains

The tester uses a builder pattern. Each chain method returns a new tester clone.

### `.files()` — inject mock files

```ts
import { mockFile } from "@typespec/compiler/testing";

const TesterWithFiles = Tester.files({
  "helpers.tsp": `model Helper { id: string; }`,
  "custom.js": mockFile.js({
    $myDec: () => {},
  }),
});
```

### `.import()` — add imports

```ts
const TesterWithImports = Tester.import("my-library", "./helpers.tsp");
```

### `.importLibraries()` — import all configured libraries

```ts
const FullTester = Tester.importLibraries();
// Equivalent to: Tester.import("@typespec/http", "@typespec/rest", "my-library")
```

### `.using()` — add using statements

```ts
const TesterWithUsing = Tester.using("Http", "MyOrg.MyLibrary");
```

### `.wrap()` — wrap main file source

```ts
const TesterWithWrapper = Tester.wrap((x) => `
  model Shared { id: string; }
  ${x}
`);
```

### Combining chains

```ts
const ConfiguredTester = Tester
  .files({ "common.tsp": `model Base {}` })
  .import("@typespec/http", "./common.tsp")
  .using("Http")
  .wrap((x) => `namespace Test { ${x} }`);
```

## Type collection

Three methods for extracting types from compiled code:

### Method 1: `t` helper (recommended)

Type-safe, inferred return types:

```ts
import { t } from "@typespec/compiler/testing";

const { Foo, bar } = await Tester.compile(t.code`
  model ${t.model("Foo")} {
    ${t.modelProperty("bar")}: string;
  }
`);
// Foo is typed as Model, bar is typed as ModelProperty
```

Available `t` helpers:

| Helper | TypeSpec kind | Return type |
|--------|--------------|-------------|
| `t.model("Name")` | Model | `Model` |
| `t.modelProperty("name")` | ModelProperty | `ModelProperty` |
| `t.operation("name")` | Operation | `Operation` |
| `t.interface("Name")` | Interface | `Interface` |
| `t.enum("Name")` | Enum | `Enum` |
| `t.enumMember("name")` | EnumMember | `EnumMember` |
| `t.union("Name")` | Union | `Union` |
| `t.unionVariant("name")` | UnionVariant | `UnionVariant` |
| `t.scalar("Name")` | Scalar | `Scalar` |
| `t.namespace("Name")` | Namespace | `Namespace` |

### Method 2: flourslash syntax

Less type safety, but works anywhere:

```ts
const { Foo } = await Tester.compile(t.code`
  model /*Foo*/Foo {}
`);
// Foo is typed as Entity (needs narrowing)
```

### Method 3: `@test` decorator (legacy)

```ts
const { Foo } = await Tester.compile(t.code`
  @test model Foo {}
`);
```

Limited to decorable types. Prefer `t` helper for new code.

## Diagnostic testing

### Expect specific diagnostics

```ts
import { expectDiagnostics } from "@typespec/compiler/testing";

it("reports invalid usage", async () => {
  const diagnostics = await Tester.diagnose(`
    @myDecorator("invalid")
    model Foo {}
  `);
  expectDiagnostics(diagnostics, {
    code: "my-library/invalid-usage",
    message: "Invalid usage of this feature.",
  });
});
```

### Expect no diagnostics

```ts
it("accepts valid input", async () => {
  const diagnostics = await Tester.diagnose(`
    @myDecorator("valid")
    model Foo {}
  `);
  expectDiagnosticEmpty(diagnostics);
});
```

### Compile and diagnose together

```ts
it("compiles with warnings", async () => {
  const [diagnostics, { Foo }] = await Tester.compileAndDiagnose(t.code`
    model ${t.model("Foo")} {}
  `);
  strictEqual(Foo.name, "Foo");
  expectDiagnostics(diagnostics, { code: "my-library/some-warning" });
});
```

## Emitter output testing

### Basic emitter test

```ts
import { createTester } from "@typespec/compiler/testing";
import { resolvePath } from "@typespec/compiler";

const EmitterTester = createTester({
  libraries: ["@typespec/http", "my-emitter"],
});

it("emits correct output", async () => {
  const instance = await EmitterTester.createInstance();
  const { program } = await instance.compile(`
    model Widget { id: string; name: string; }
  `);

  // Access emitted files from program host
  // Or use snapshot testing with executeScenarios
});
```

### Scenario-based snapshot testing

For emitters using the emitter framework, use `executeScenarios()`:

```ts
import {
  createSnippetExtractor,
  createTypeScriptExtractorConfig,
  executeScenarios,
} from "@typespec/emitter-framework/testing";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const tsExtractorConfig = await createTypeScriptExtractorConfig();
const snippetExtractor = createSnippetExtractor(tsExtractorConfig);
const scenarioPath = join(__dirname, "scenarios");

await executeScenarios(
  Tester.import("@typespec/http").using("Http"),
  tsExtractorConfig,
  scenarioPath,
  snippetExtractor,
);
```

## Scenario files

Markdown files where each `#` heading is a scenario. Contains TypeSpec input and expected output.

### Format

````markdown
# Basic model

```tsp
model Widget {
  id: string;
  name: string;
}
```

```ts src/models/widget.ts
export interface Widget {
  id: string;
  name: string;
}
```
````

### Declaration extraction

Extract specific declarations for comparison:

````markdown
```ts src/models/widget.ts interface Widget
export interface Widget {
  id: string;
  name: string;
}
```
````

Code block header: `` `<lang> <file-path> [type] [name]` ``

### Updating snapshots

```bash
RECORD=true npx vitest run        # Update all scenarios
SCENARIOS_UPDATE=true npx vitest run  # Same effect
```

## Vitest configuration

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    isolate: false,  // Safe when tests have no side effects; improves performance
    // testTimeout: 10000,  // Increase for emitter tests
  },
});
```

> **Source:** `website/src/content/docs/docs/extending-typespec/testing.mdx`
