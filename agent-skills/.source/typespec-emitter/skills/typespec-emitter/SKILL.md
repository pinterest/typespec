---
name: typespec-emitter
description: "Orchestration guide for building TypeSpec emitters end-to-end. Use when the agent needs to (1) plan a new emitter through an interactive design conversation with the user, (2) produce a design doc for an emitter (target description, type mapping, file layout, mutation strategy), (3) assess language target availability and choose an implementation approach, (4) architect an emitter's component structure, (5) coordinate between library setup, mutations, and component implementation, or (6) set up scenario-based snapshot testing for an emitter."
---

# TypeSpec Emitter

End-to-end guide for building TypeSpec emitters — from planning through implementation and testing.

## Emitter lifecycle

```
1. Interactive planning ──> 2. Language assessment ──> 3. Mutations design
        |                                                       |
        v                                                       v
4. Library setup ──────────> 5. Component implementation ──> 6. Testing
```

Follow these phases in order. Each phase may delegate to a specialized skill.

## Phase 1: Interactive planning

**Key principle:** Emitters are OPINIONATED. Not "Python emitter" but "FastAPI server with Pydantic models" or "TypeScript Express API client with Zod validation."

Enter plan mode if available. Ask the user these questions:

### Questions to ask

1. **What is the target output?** Framework, language, and purpose (server stubs, client SDK, data models, config files).
2. **What TypeSpec constructs are relevant?** Models, operations, interfaces, enums, scalars — which ones matter?
3. **What file layout should the output have?** One file per model? Grouped by namespace? Single file?
4. **What naming conventions should the output follow?** PascalCase classes, snake_case methods, etc.
5. **What runtime dependencies does the output assume?** Framework imports, base classes, utility libraries.

### Write example output by hand

Before writing any code, take a sample TypeSpec spec and write the desired output BY HAND. This clarifies decisions before implementation.

Example TypeSpec:

```tsp
model Widget {
  id: string;
  name: string;
  weight: float32;
}

op getWidget(@path id: string): Widget;
```

Write the desired output for the target framework. This becomes the "north star" for implementation.

### Produce a design doc

Summarize planning into a design doc with:

1. **Target description** — Framework, language, purpose, runtime deps
2. **Type mapping table** — TypeSpec type -> output construct
3. **File layout plan** — Directory structure, naming pattern
4. **Mutation strategy** — What type simplifications to apply (if any)
5. **Component architecture sketch** — What components, how they compose

For the detailed planning methodology and design doc template, see [references/planning-guide.md](references/planning-guide.md).

## Phase 2: Language target assessment

Check if the target language already has emitter-framework support.

### Decision tree

```
Does @alloy-js/<lang> package exist?
├── YES: Does tree-sitter-<lang> grammar exist?
│   ├── YES: Full framework support possible
│   │   -> Add language target to emitter-framework (see emitter-framework skill, language-target.md)
│   │   -> Build emitter using TypeExpression, TypeDeclaration, etc.
│   └── NO: Partial support
│       -> Use Alloy-JS primitives directly
│       -> Build custom type mapping components
└── NO: Raw output
    -> Build on @alloy-js/core (SourceDirectory, SourceFile)
    -> Implement all type rendering manually
```

### Currently supported languages

| Language | Alloy-JS package | Framework subpath | Notes |
|----------|-----------------|-------------------|-------|
| TypeScript | `@alloy-js/typescript` | `@typespec/emitter-framework/typescript` | Full support |
| Python | `@alloy-js/python` | `@typespec/emitter-framework/python` | Full support |
| C# | `@alloy-js/csharp` | `@typespec/emitter-framework/csharp` | Full support |

## Phase 3: Designing mutations

### When to use the mutator framework

Use mutations when you need to simplify or reshape the type graph BEFORE emission:

- **Flatten spreads** — Resolve `...` spread types into concrete properties
- **Resolve templates** — Expand template instantiations
- **Normalize nullables** — Wrap nullable references in union types
- **Rename for conventions** — Add suffixes/prefixes to match target framework patterns
- **Simplify inheritance** — Flatten base model chains

### Decision: mutation vs. component logic

| Use mutator when... | Use component logic when... |
|--------------------|-----------------------------|
| Transformation is global (all types of a kind) | Transformation is local to one component |
| Multiple components need the same simplified types | Only one component uses the transformation |
| Type graph shape needs to change | Just output formatting differs |
| Transformation is reusable across emitters | Specific to this emitter's rendering |

For implementation details, see the **mutator-framework** skill.

## Phase 4: Library setup

### Initialize the package

```bash
tsp init --template emitter-ts
```

This creates the standard library structure. Then:

1. Define emitter options in `src/lib.ts` using `createTypeSpecLibrary` with an options schema
2. Export `$lib` from `src/index.ts`
3. Export `$onEmit` from `src/index.ts`
4. Set up `main.tsp` to import the JS entry point

For full library setup details (package.json, tsconfig, diagnostics, state keys), see the **typespec-library** skill.

### TSX configuration for JSX emitters

Add to `tsconfig.json`:

```jsonc
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@alloy-js/core"
  }
}
```

## Phase 5: Component implementation

### Component organization pattern

```
src/
├── emitter.tsx        # $onEmit entry point
├── components/
│   ├── output.tsx     # Custom Output wrapper
│   ├── models.tsx     # Model declarations
│   ├── operations.tsx # Operation/function declarations
│   ├── enums.tsx      # Enum declarations
│   └── client.tsx     # Client class (if SDK emitter)
└── utils.tsx          # Helper functions, external module refs
```

### The `$onEmit` entry point

```tsx
export async function $onEmit(context: EmitContext<MyOptions>) {
  writeOutput(
    context.program,
    <Output program={context.program}>
      <SourceDirectory path="models">
        <Models />
      </SourceDirectory>
      <SourceDirectory path="operations">
        <Operations />
      </SourceDirectory>
    </Output>,
    context.emitterOutputDir,
  );
}
```

### Iterating over types

```tsx
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

For JSX component patterns, rendering pipeline, type mapping, refkeys, and the complete component API, see the **emitter-framework** skill.

For architecture patterns (Output wrapper, type collection, component overrides), see [references/emitter-architecture.md](references/emitter-architecture.md).

## Phase 6: Testing

### Scenario-based snapshot testing

The recommended approach uses `executeScenarios()` with markdown scenario files.

### Setup

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
  Tester.import("@typespec/http").using("Http"),
  tsExtractorConfig,
  join(__dirname, "scenarios"),
  snippetExtractor,
);
```

### Writing scenario files

Create `.md` files in `test/scenarios/`:

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

### Updating snapshots

```bash
RECORD=true npx vitest run
```

### Testing tester setup

```ts
// test/tester.ts
import { createTester } from "@typespec/compiler/testing";

export const Tester = createTester({
  libraries: ["@typespec/http", "my-emitter"],
});
```

For the complete testing guide (tester chains, type collection, diagnostic testing), see the **typespec-library** skill's [testing-guide.md](../typespec-library/references/testing-guide.md).

## Reference files

- **[references/planning-guide.md](references/planning-guide.md)** — Detailed interactive planning methodology, design doc template, question sets for different emitter types
- **[references/emitter-architecture.md](references/emitter-architecture.md)** — Output wrapper pattern, type collection strategies, component overrides, emitter options patterns
- **[references/example-walkthrough.md](references/example-walkthrough.md)** — Step-by-step walkthrough building a minimal emitter from scratch

## Related skills

- **emitter-framework** — JSX-based component model: Output, TypeExpression, TypeDeclaration, refkeys, rendering pipeline
- **typespec-library** — Library package setup, decorators, diagnostics, testing infrastructure
- **mutator-framework** — Type graph transformations before emission
