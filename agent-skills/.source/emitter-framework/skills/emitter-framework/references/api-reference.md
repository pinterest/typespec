# Emitter Framework API Reference

Lookup table of framework exports organized by import path.

## Table of Contents

- [`@typespec/emitter-framework`](#typespecemitter-framework) — Core exports (Output, useTsp, writeOutput, SCCSet)
- [`@typespec/emitter-framework/typescript`](#typespecemitter-frameworktypescript) — TypeScript components and utilities
- [`@typespec/emitter-framework/python`](#typespecemitter-frameworkpython) — Python components and utilities
- [`@typespec/emitter-framework/csharp`](#typespecemitter-frameworkcsharp) — C# components
- [`@typespec/emitter-framework/testing`](#typespecemitter-frameworktesting) — Testing utilities and scenario harness
- [Scenario file format](#scenario-file-format) — Code block heading syntax and update mode

## `@typespec/emitter-framework`

Core exports from the emitter framework.

### Components

| Export | Description |
|--------|------------|
| `Output` | Root component. Wraps Alloy-JS `CoreOutput` with `TspContext`. Props: `program: Program` + all `CoreOutputProps` (externals, namePolicy, tabWidth, etc.) |
| `Experimental_ComponentOverrides` | Wrapper component that applies component overrides to children. Props: `overrides`, `children` |
| `Experimental_ComponentOverridesConfig` | Factory function — call `.forTypeKind(kind, overrides)` to create override config for a specific type kind |

### Hooks and context

| Export | Description |
|--------|------------|
| `useTsp()` | Returns `{ program: Program, $: Typekit }`. `$` is lazily initialized on first access. Must be called within an `<Output>` tree. |
| `TspContext` | The Alloy-JS named context object. Rarely used directly — prefer `useTsp()`. |

### Functions

| Export | Description |
|--------|------------|
| `writeOutput(program, rootComponent, emitterOutputDir)` | Renders the JSX tree via `renderAsync()` and writes all files to disk using the compiler's `emitFile()`. |
| `createTransformNamePolicy({ transportNamer, applicationNamer })` | Creates a `TransformNamePolicy` with functions for transport (wire) vs. application (SDK) naming. |

### Classes

| Export | Description |
|--------|------------|
| `SCCSet<T>` | Maintains a directed graph and exposes strongly connected components via incremental Tarjan's algorithm. Constructor takes a `connector: (item: T) => Iterable<T>` and optional `SCCSetOptions`. Key properties: `items: T[]` (topologically ordered), `components: SCCComponent<T>[]`. Methods: `add(item)`, `addAll(items)`. |

### Utilities

| Export | Description |
|--------|------------|
| `typeDependencyConnector` | Connector function for `SCCSet` that maps TypeSpec `Type` to its dependency edges (base models, property types, union variants, etc.). |

---

## `@typespec/emitter-framework/typescript`

TypeScript-specific components and utilities.

### Components

| Export | Description |
|--------|------------|
| `TypeExpression` | Maps a TypeSpec type to a TS type expression. Props: `type: Type`, `noReference?: boolean`. Handles scalars, literals, models, unions, tuples, arrays, records, operations. |
| `TypeDeclaration` | Routes a TypeSpec type to the correct TS declaration based on `type.kind`. Props: `type?: Type`, `name?: string`, plus `ts.TypeDeclarationProps`. |
| `InterfaceDeclaration` | Emits a TypeScript `interface`. Used for TypeSpec `Model` types. |
| `EnumDeclaration` | Emits a TypeScript `enum`. Used for TypeSpec `Enum` types. |
| `TypeAliasDeclaration` | Emits a TypeScript `type` alias. Used for TypeSpec `Scalar` and `Operation` types. |
| `UnionDeclaration` | Emits a TypeScript union type declaration. Used for TypeSpec `Union` types. |
| `FunctionDeclaration` | Emits a TypeScript function declaration. |
| `InterfaceExpression` | Emits an inline interface expression (object literal type). |
| `InterfaceMember` | Emits a single interface member (property). |
| `InterfaceMethod` | Emits a method signature in an interface. |
| `ArrayExpression` | Emits an `Array<T>` type expression. |
| `ArrowFunction` | Emits an arrow function expression. |
| `ClassMethod` | Emits a class method. |
| `FunctionExpression` | Emits a function expression. |
| `FunctionType` | Emits a function type signature. |
| `RecordExpression` | Emits a `Record<string, T>` type expression. |
| `UnionExpression` | Emits an inline union expression (`A \| B`). |
| `ValueExpression` | Emits a value expression for TypeSpec values. |
| `TypeTransform` | Emits serialization/deserialization transform functions. |
| `StaticSerializers` | Emits static serializer functions. |

### Utilities

| Export | Description |
|--------|------------|
| `efRefkey(...args)` | Creates a namespaced refkey for cross-file references. With no args, generates a unique key. With a TypeSpec type, creates a deterministic key. |
| `declarationRefkeys(refkey?, ...args)` | Creates an array of refkeys combining a user-provided refkey with an internal one. |

### Name policy

Name policies for TypeScript come from `@alloy-js/typescript`:
- `useTSNamePolicy()` — use within a component to get the active TS name policy

---

## `@typespec/emitter-framework/python`

Python-specific components and utilities.

### Components

| Export | Description |
|--------|------------|
| `TypeExpression` | Maps a TypeSpec type to a Python type expression. Props: `type: Type`, `noReference?: boolean`. Maps scalars to Python types (`int`, `str`, `bool`, `float`, `datetime`, `Decimal`, etc.). |
| `TypeDeclaration` | Routes a TypeSpec type to the correct Python declaration. |
| `ClassDeclaration` | Emits a Python class (dataclass). |
| `EnumDeclaration` | Emits a Python `Enum` class. |
| `TypeAliasDeclaration` | Emits a Python type alias. |
| `FunctionDeclaration` | Emits a Python function. |
| `ProtocolDeclaration` | Emits a Python Protocol (structural typing). |
| `ArrayExpression` | Emits a `list[T]` type expression. |
| `RecordExpression` | Emits a `dict[str, T]` type expression. |
| `DocElement` | Emits Python docstrings. |
| `Atom` | Emits a Python atom (basic expression). |

### Utilities

| Export | Description |
|--------|------------|
| `efRefkey(...args)` | Python-namespaced refkey creator. Same API as the TypeScript version. |

### Built-in module references

| Export | Description |
|--------|------------|
| `typingModule` | Reference to Python's `typing` module (provides `Any`, `Never`, `Literal`, `Callable`, etc.) |
| `datetimeModule` | Reference to Python's `datetime` module |
| `decimalModule` | Reference to Python's `decimal` module |
| `abcModule` | Reference to Python's `abc` module |

### Name policy

Name policies for Python come from `@alloy-js/python`:
- `usePythonNamePolicy()` — use within a component
- `createPythonNamePolicy()` — create a policy instance to pass to `<Output namePolicy={...}>`

---

## `@typespec/emitter-framework/csharp`

C#-specific components.

### Components

| Export | Description |
|--------|------------|
| `TypeExpression` | Maps a TypeSpec type to a C# type expression. |
| `ClassDeclaration` | Emits a C# class declaration. |
| `EnumDeclaration` | Emits a C# enum declaration. |
| `PropertyDeclaration` | Emits a C# property declaration. |
| `JsonConverter` | Emits a System.Text.Json `JsonConverter<T>` implementation. |
| `JsonConverterResolver` | Emits a `JsonConverterFactory` for resolver-based conversion. |

---

## `@typespec/emitter-framework/testing`

Testing utilities for emitter snapshot tests.

### Scenario test harness

| Export | Description |
|--------|------------|
| `executeScenarios(tester, languageConfig, scenariosLocation, snippetExtractor)` | Discovers and runs all scenario `.md` files in a directory. Creates vitest `describe`/`it` blocks automatically. |

### Extractor configs

| Export | Description |
|--------|------------|
| `createTypeScriptExtractorConfig()` | Creates a `LanguageConfiguration` for TypeScript with prettier formatting and tree-sitter node types. Async. |
| `createPythonExtractorConfig()` | Creates a `LanguageConfiguration` for Python. Async. |
| `createCSharpExtractorConfig()` | Creates a `LanguageConfiguration` for C#. Async. |
| `createJavaExtractorConfig()` | Creates a `LanguageConfiguration` for Java. Async. |
| `createSnippetExtractor(languageConfig)` | Creates a tree-sitter based `SnippetExtractor` from a `LanguageConfiguration`. |

### SnippetExtractor interface

```ts
interface SnippetExtractor {
  getClass(source: string, name: string): string | null;
  getFunction(source: string, name: string): string | null;
  getInterface(source: string, name: string): string | null;
  getTypeAlias(source: string, name: string): string | null;
  getEnum(source: string, name: string): string | null;
}
```

### LanguageConfiguration interface

```ts
interface LanguageConfiguration {
  language: object;        // tree-sitter language parser
  format: (code: string) => Promise<string>;  // code formatter
  codeBlockTypes: string[]; // markdown code block identifiers
  nodeKinds: { ... };      // tree-sitter node kind mappings
}
```

---

## Scenario file format

### Code block heading syntax

```
<lang> <file-path> [type] [name]
```

| Field | Required | Description |
|-------|----------|-------------|
| `lang` | Yes | Language identifier: `ts`, `py`, `cs`, `java` |
| `file-path` | Yes | Path of the emitted file to check (e.g., `src/models/models.ts`) |
| `type` | No | Declaration type to query: `interface`, `class`, `function`, `type`, `enum` |
| `name` | No | Name of the declaration to extract (required if `type` is provided) |

### Examples

Full file comparison:
```
` ``ts src/index.ts
// entire file content expected here
` ``
```

Single declaration query:
```
` ``ts src/models/models.ts interface Widget
export interface Widget {
  id: string;
  weight: number;
}
` ``
```

(Note: backticks above are escaped for display.)

### Update mode

Set environment variables to auto-update expected output in scenario files:

- `RECORD=true` — updates all scenario files with actual output
- `SCENARIOS_UPDATE=true` — same behavior, alternative name
