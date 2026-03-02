# Emitter Framework: Adding a Language Target

Guide for extending `@typespec/emitter-framework` with a new language target (e.g., Go, Java, Rust, Swift). This adds a `src/<lang>/` directory alongside the existing `src/typescript/`, `src/python/`, and `src/csharp/` directories.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Directory structure](#directory-structure)
- [Refkey setup](#refkey-setup)
- [Diagnostics](#diagnostics)
- [Intrinsic type map](#intrinsic-type-map)
- [TypeExpression component](#typeexpression-component)
- [TypeDeclaration router](#typedeclaration-router)
- [Declaration components](#declaration-components)
- [Array and Record expressions](#array-and-record-expressions)
- [Built-in module references](#built-in-module-references-optional)
- [Barrel exports and package.json](#barrel-exports-and-packagejson)
- [Testing support](#testing-support)
- [Implementation checklist](#implementation-checklist)

## Prerequisites

Before starting, you need:

1. **A corresponding `@alloy-js/<lang>` package** — provides the language-specific AST primitives (declarations, references, name policies). This must already exist.
2. **A tree-sitter grammar** (`tree-sitter-<lang>`) — used by the testing infrastructure to extract code snippets from rendered output.

## Directory structure

The canonical layout under `packages/emitter-framework/src/<lang>/`:

### Required files

```
src/<lang>/
  index.ts                          # Barrel: re-exports components + utils
  lib.ts                            # Diagnostics via createTypeSpecLibrary()
  utils/
    index.ts                        # Barrel: re-exports refkey (and any helpers)
    refkey.ts                       # Namespaced efRefkey + declarationRefkeys
  components/
    index.ts                        # Barrel: re-exports all components
    type-expression.tsx             # Core: maps TypeSpec types to lang expressions
    type-declaration.tsx            # Router: dispatches type → declaration component
    <model-decl>.tsx                # Model→struct/class/interface (lang-dependent)
    enum-declaration.tsx            # Enum + Union-as-enum declarations
    type-alias-declaration.tsx      # Type alias declarations
    array-expression.tsx            # Array/list type syntax
    record-expression.tsx           # Record/dict/map type syntax
```

### Optional files

```
  builtins.ts                       # Module references for languages needing explicit imports (Python, Go, Rust)
  test-utils.tsx                    # Test helpers
  components/
    function-declaration.tsx        # Function/method declarations
    union-expression.tsx            # Union type expressions
    doc-element.tsx                 # Doc comment rendering
```

**Note:** Python uses subdirectories per component (e.g., `components/type-expression/type-expression.tsx`). TypeScript and C# use flat files. Either convention works — be consistent within your target.

## Refkey setup

Every language target needs its own namespaced refkeys to avoid collisions. The pattern is identical across all three targets — only the `Symbol.for` string changes.

Create `src/<lang>/utils/refkey.ts`:

```typescript
import { refkey as ayRefkey, type Refkey } from "@alloy-js/core";

const refKeyPrefix = Symbol.for("emitter-framework:<lang>");

export function efRefkey(...args: unknown[]): Refkey {
  if (args.length === 0) {
    return ayRefkey(); // Generates a unique refkey
  }
  return ayRefkey(refKeyPrefix, ...args);
}

export function declarationRefkeys(refkey?: Refkey | Refkey[], ...args: unknown[]): Refkey[] {
  if (refkey) {
    return [refkey, efRefkey(...args)].flat();
  }
  return [efRefkey(...args)];
}
```

Replace `<lang>` with the language name (e.g., `"emitter-framework:go"`). The `efRefkey` function wraps Alloy's `refkey` with a per-language prefix symbol so that a Go model's refkey never collides with a TypeScript model's. `declarationRefkeys` combines user-provided refkeys with the internal one.

Reference implementations:
- `src/typescript/utils/refkey.ts` — identical structure
- `src/python/utils/refkey.ts` — identical structure
- `src/csharp/components/utils/refkey.ts` — identical structure (note: C# nests under `components/utils/`)

## Diagnostics

Create `src/<lang>/lib.ts` with at minimum two diagnostic codes:

```typescript
import { createTypeSpecLibrary } from "@typespec/compiler";

export const $<lang>Lib = createTypeSpecLibrary({
  name: "emitter-framework",
  diagnostics: {
    "<lang>-unsupported-scalar": {
      severity: "warning",
      messages: {
        default: "Unsupported scalar type, falling back to <fallback>",
      },
    },
    "<lang>-unsupported-type": {
      severity: "error",
      messages: {
        default: "Unsupported type, falling back to <fallback>",
      },
      description: "This type is not supported by the <lang> emitter",
    },
  },
});

export const {
  reportDiagnostic: report<Lang>Diagnostic,
  createDiagnostic: create<Lang>Diagnostic,
} = $<lang>Lib;
```

Replace `<fallback>` with the language's "any" equivalent (e.g., `any` for Go/TS, `Any` for Python, `object` for C#).

**Existing diagnostic codes for reference:**
- TypeScript (`src/typescript/lib.ts`): 7 codes — `typescript-unsupported-scalar`, `typescript-unsupported-type`, `typescript-unsupported-model-discriminator`, `typescript-unsupported-type-transform`, `typescript-unsupported-nondiscriminated-union`, `typescript-extended-model-transform-nyi`, `typescript-spread-model-transformation-nyi`
- Python (`src/python/lib.ts`): 4 codes — `python-unsupported-scalar`, `python-unsupported-type`, `python-unsupported-model-discriminator`, `python-unsupported-type-transform`

Start with the two minimum codes. Add more as you implement transforms and discriminators.

**Note:** C# currently reuses `reportTypescriptDiagnostic` from the TypeScript lib rather than having its own. New targets should create their own diagnostic library.

## Intrinsic type map

The core of every language target is a `Map<string, string | null>` that maps TypeSpec's 29 intrinsic scalar names to their language equivalents.

### All 29 TypeSpec intrinsic names

Core: `unknown`, `string`, `boolean`, `null`, `void`, `never`, `bytes`
Numeric: `numeric`, `integer`, `float`, `decimal`, `decimal128`, `int64`, `int32`, `int16`, `int8`, `safeint`, `uint64`, `uint32`, `uint16`, `uint8`, `float32`, `float64`
Date/time: `plainDate`, `plainTime`, `utcDateTime`, `offsetDateTime`, `duration`
String: `url`

### Comparison across existing targets

| TypeSpec Intrinsic | TypeScript | Python | C# |
|---|---|---|---|
| `unknown` | `unknown` | `Any` | `object` |
| `string` | `string` | `str` | `string` |
| `boolean` | `boolean` | `bool` | `bool` |
| `null` | `null` | `None` | `null` |
| `void` | `void` | `None` | `void` |
| `never` | `never` | `Never` | `null` (no equivalent) |
| `bytes` | `Uint8Array` | `bytes` | `byte[]` |
| `numeric` | `number` | `number` | `decimal` |
| `integer` | `number` | `int` | `int` |
| `float` | `number` | `float` | `float` |
| `decimal` | `number` | `Decimal` | `decimal` |
| `decimal128` | `number` | `Decimal` | `decimal` |
| `int64` | `bigint` | `int` | `long` |
| `int32` | `number` | `int` | `int` |
| `int16` | `number` | `int` | `short` |
| `int8` | `number` | `int` | `sbyte` |
| `safeint` | `number` | `int` | `int` |
| `uint64` | `bigint` | `int` | `ulong` |
| `uint32` | `number` | `int` | `uint` |
| `uint16` | `number` | `int` | `ushort` |
| `uint8` | `number` | `int` | `byte` |
| `float32` | `number` | `float` | `float` |
| `float64` | `number` | `float` | `double` |
| `plainDate` | `string` | `str` | `DateOnly` |
| `plainTime` | `string` | `str` | `TimeOnly` |
| `utcDateTime` | `Date` | `datetime` | `DateTimeOffset` |
| `offsetDateTime` | `string` | `str` | `DateTimeOffset` |
| `duration` | `string` | `str` | `TimeSpan` |
| `url` | `string` | `str` | `Uri` |

### The `getScalarIntrinsicExpression()` helper

Every target implements this function. The pattern:

```typescript
function getScalarIntrinsicExpression($: Typekit, type: Scalar | IntrinsicType): string | null {
  let intrinsicName: string;

  // Special handling for utcDateTime — check encoding
  if ($.scalar.isUtcDateTime(type) || $.scalar.extendsUtcDateTime(type)) {
    const encoding = $.scalar.getEncoding(type);
    // Choose type based on encoding (unixTimestamp, rfc7231, rfc3339, etc.)
    return "<datetime-type>";
  }

  if ($.scalar.is(type)) {
    intrinsicName = $.scalar.getStdBase(type)?.name ?? "";
  } else {
    intrinsicName = type.name;
  }

  const langType = intrinsicNameTo<Lang>Type.get(intrinsicName);

  if (!langType) {
    report<Lang>Diagnostic($.program, { code: "<lang>-unsupported-scalar", target: type });
    return "<fallback>";
  }

  return langType;
}
```

The `utcDateTime` special case exists because its encoding can affect the emitted type. In TypeScript it always maps to `Date`, in C# to `DateTimeOffset`, but a language like Go might map `rfc3339` to `time.Time` and `unixTimestamp` to `int64`.

### Languages with imports for stdlib types

Python needs explicit imports for types like `datetime`, `Decimal`, `Any`. It maps certain intrinsic type names to module references via `pythonTypeToImport`:

```typescript
const pythonTypeToImport = new Map<string, any>([
  ["Any", typingModule["."]["Any"]],
  ["Never", typingModule["."]["Never"]],
  ["datetime", datetimeModule["."]["datetime"]],
  ["Decimal", decimalModule["."]["Decimal"]],
]);
```

If your language has similar stdlib import requirements (Go, Rust), you'll need a `builtins.ts` and a similar import-resolution map. See the "Built-in module references" section below.

## TypeExpression component

The core component that converts any TypeSpec `Type` into a language expression. This is the most important component in each target.

### Props

```typescript
export interface TypeExpressionProps {
  type: Type;
  noReference?: boolean;  // Force inline emission, skip declaration references
}
```

### Structure

```tsx
export function TypeExpression(props: TypeExpressionProps) {
  const { $ } = useTsp();
  const type = props.type;

  return (
    <Experimental_OverridableComponent reference type={type}>
      {() => {
        // 1. Check if this type should be a reference to a declaration
        if (!props.noReference && isDeclaration($, type)) {
          return <Reference refkey={efRefkey(type)} />;
        }

        // 2. Switch on type.kind
        switch (type.kind) {
          case "Scalar":
          case "Intrinsic":
            return <>{getScalarIntrinsicExpression($, type)}</>;

          case "Boolean":
          case "Number":
          case "String":
            // Literal values — language-specific literal syntax
            return /* ... */;

          case "Union":
            return /* union expression */;
          case "UnionVariant":
            return <TypeExpression type={type.type} />;
          case "Tuple":
            return /* tuple syntax */;
          case "ModelProperty":
            return <TypeExpression type={type.type} />;

          case "Model":
            if ($.array.is(type)) {
              return <ArrayExpression elementType={type.indexer!.value} />;
            }
            if ($.record.is(type)) {
              return <RecordExpression elementType={type.indexer!.value} />;
            }
            return /* inline model expression or reference */;

          case "Operation":
            return /* function type syntax */;

          default:
            report<Lang>Diagnostic($.program, {
              code: "<lang>-unsupported-type",
              target: type,
            });
            return "<fallback>";
        }
      }}
    </Experimental_OverridableComponent>
  );
}
```

### Key imports

```typescript
import { Experimental_OverridableComponent } from "../../core/components/overrides/component-overrides.jsx";
import { useTsp } from "../../core/context/tsp-context.js";
```

Or using the `#core` import alias:

```typescript
import { Experimental_OverridableComponent } from "#core/components/index.js";
import { useTsp } from "#core/context/index.js";
```

### `Experimental_OverridableComponent` wrapper

This wraps the component to allow emitter consumers to override how specific types are rendered. The `reference` prop indicates this component produces reference-able output. The `type` prop identifies which TypeSpec type is being expressed.

### `isDeclaration()` helper

Determines whether a type should be referenced (by refkey) rather than emitted inline. Differences between targets:

| type.kind | TypeScript | Python | C# |
|---|---|---|---|
| `Namespace` | `true` | `false` | `true` |
| `Interface` | `true` | `false` | `true` |
| `Enum` | `true` | `false` | `true` |
| `Operation` | `true` | `false` | `true` |
| `EnumMember` | `true` | `false` | `true` |
| `UnionVariant` | `false` | `false` | `false` |
| `Model` (named, non-array/record) | `true` (if has name) | `true` (if has name) | `true` |
| `Union` (named) | `true` (if has name) | `true` (if has name) | `true` (if has name) |

Python is more conservative — it only treats `Model` and `Union` as declarations. TypeScript and C# also treat `Namespace`, `Interface`, `Enum`, `Operation`, and `EnumMember` as declarations.

Choose based on your language's semantics: does the language have first-class support for referencing enums, interfaces, etc. by name?

### Reference implementations

- `src/typescript/components/type-expression.tsx` — most complete, covers all type kinds including `FunctionType` and `UnionExpression`
- `src/python/components/type-expression/type-expression.tsx` — handles `Literal[...]` syntax, `typing.Callable`, and imports
- `src/csharp/components/type-expression.tsx` — simplest, uses `code` template literals, handles nullable unions specially

## TypeDeclaration router

The `TypeDeclaration` component acts as a dispatcher — given a TypeSpec `Type`, it routes to the correct declaration component based on `type.kind`.

### Routing table comparison

| `type.kind` | TypeScript maps to | Python maps to | C# |
|---|---|---|---|
| `Model` | `InterfaceDeclaration` | (falls through to `TypeAliasDeclaration`) | no router — `ClassDeclaration` used directly |
| `Union` | `UnionDeclaration` | (falls through to `TypeAliasDeclaration`) | no router |
| `Enum` | `EnumDeclaration` | `EnumDeclaration` | no router |
| `Scalar` | `TypeAliasDeclaration` | (falls through to `TypeAliasDeclaration`) | no router |
| `Operation` | `TypeAliasDeclaration` | (falls through to `TypeAliasDeclaration`) | no router |

### Pattern (TypeScript example)

```tsx
export function TypeDeclaration(props: TypeDeclarationProps) {
  const { $ } = useTsp();
  const { type, ...restProps } = props;
  const doc = props.doc ?? $.type.getDoc(type);

  switch (type.kind) {
    case "Model":
      return <InterfaceDeclaration doc={doc} type={type} {...restProps} />;
    case "Union":
      return <UnionDeclaration doc={doc} type={type} {...restProps} />;
    case "Enum":
      return <EnumDeclaration doc={doc} type={type} {...restProps} />;
    case "Scalar":
      return <TypeAliasDeclaration doc={doc} type={type} {...restProps} />;
    case "Operation":
      return <TypeAliasDeclaration doc={doc} type={type} {...restProps} />;
  }
}
```

### Pattern (Python — simplest)

```tsx
export function TypeDeclaration(props: TypeDeclarationProps) {
  const { $ } = useTsp();
  const { type, ...restProps } = props;
  const doc = props.doc ?? $.type.getDoc(type);

  switch (type.kind) {
    case "Enum":
      return <EnumDeclaration doc={doc} type={type} {...restProps} />;
    default:
      return <TypeAliasDeclaration doc={doc} type={type} {...restProps} />;
  }
}
```

Note: C# does not have a `TypeDeclaration` router — it uses `ClassDeclaration` and `EnumDeclaration` directly.

## Declaration components

### Model declaration (struct/class/interface)

The choice of construct depends on the target language:
- **TypeScript:** `InterfaceDeclaration` — models become interfaces
- **Python:** `ClassDeclaration` — models become dataclasses
- **C#:** `ClassDeclaration` — models become classes

All follow the same pattern:

1. **Name policy** — use the language's name policy from Alloy-JS (`ts.useTSNamePolicy()`, `py.usePythonNamePolicy()`, `cs.useCSharpNamePolicy()`)
2. **Refkeys** — `declarationRefkeys(props.refkey, props.type)` for reference tracking
3. **Doc comments** — `props.doc ?? $.type.getDoc(type)` for documentation
4. **Properties** — `$.model.getProperties(type)` returns properties to render as fields/members

```tsx
// Simplified pattern (TypeScript target)
export function InterfaceDeclaration(props: { type: Model; name?: string; refkey?: Refkey }) {
  const { $ } = useTsp();
  const namePolicy = ts.useTSNamePolicy();
  const name = props.name ?? namePolicy.getName(props.type.name, "interface");
  const refkeys = declarationRefkeys(props.refkey, props.type);
  const doc = $.type.getDoc(props.type);

  return (
    <ts.InterfaceDeclaration name={name} refkey={refkeys} doc={doc}>
      <For each={$.model.getProperties(props.type)} semicolon line>
        {(member) => <InterfaceMember type={member} />}
      </For>
    </ts.InterfaceDeclaration>
  );
}
```

The name policy kind argument varies by language construct: `"interface"` for TS interfaces, `"class"` for Python/C# classes, `"struct"` for Go structs, etc.

### Enum declaration

All three targets follow the same pattern for enums:

1. Accept both `Enum` and `Union` types
2. Convert unions to enums via `$.enum.createFromUnion()` (with `$.union.isValidEnum()` guard)
3. Use `declarationRefkeys` and language name policy
4. Iterate members and create language-appropriate enum member syntax
5. Handle refkeys: for union types use `efRefkey(props.type.variants.get(key))`, for enum types use `efRefkey(value)`

```tsx
// Simplified pattern
export function EnumDeclaration(props: { type: Union | Enum; name?: string }) {
  const { $ } = useTsp();
  let type: Enum;
  if ($.union.is(props.type)) {
    if (!$.union.isValidEnum(props.type)) {
      throw new Error("The provided union type cannot be represented as an enum");
    }
    type = $.enum.createFromUnion(props.type);
  } else {
    type = props.type;
  }

  const refkeys = declarationRefkeys(props.refkey, props.type);
  const name = namePolicy.getName(props.type.name!, "<enum-kind>");
  const members = Array.from(type.members.entries());
  const doc = props.doc ?? $.type.getDoc(type);

  return (
    <lang.EnumDeclaration name={name} refkey={refkeys} doc={doc}>
      <For each={members} joiner={",\n"}>
        {([key, value]) => (
          <lang.EnumMember
            name={value.name}
            value={value.value ?? value.name}
            refkey={
              $.union.is(props.type) ? efRefkey(props.type.variants.get(key)) : efRefkey(value)
            }
          />
        )}
      </For>
    </lang.EnumDeclaration>
  );
}
```

### TypeAlias declaration

Type aliases use `noReference` on the inner `TypeExpression` to force inline emission:

```tsx
export function TypeAliasDeclaration(props: { type: Type; name?: string }) {
  const { $ } = useTsp();
  const name = namePolicy.getName(originalName, "<alias-kind>");
  const refkeys = declarationRefkeys(props.refkey, props.type);
  const doc = props.doc ?? $.type.getDoc(props.type);

  return (
    <lang.TypeDeclaration name={name} refkey={refkeys} doc={doc}>
      <TypeExpression type={props.type} noReference />
    </lang.TypeDeclaration>
  );
}
```

Python has extra logic for template instances — it emits a dataclass instead of a type alias for Model template instances, since Python lacks parameterized type aliases.

## Array and Record expressions

Simple one-liner components. Syntax varies per language:

**TypeScript:**
```tsx
// ArrayExpression
code`Array<${(<TypeExpression type={elementType} />)}>`

// RecordExpression
code`Record<string, ${(<TypeExpression type={elementType} />)}>`
```

**Python:**
```tsx
// ArrayExpression
<>list[<TypeExpression type={elementType} />]</>

// RecordExpression
<>dict[str, <TypeExpression type={elementType} />]</>
```

**C# (inline in TypeExpression):**
```tsx
// Array
code`${(<TypeExpression type={type.indexer.value} />)}[]`

// Record
code`IDictionary<string, ${(<TypeExpression type={type.indexer.value} />)}>`
```

For your language, create equivalent components or inline them in TypeExpression:

```tsx
// Go example
export function ArrayExpression({ elementType }: { elementType: Type }) {
  return code`[]${(<TypeExpression type={elementType} />)}`;
}

export function RecordExpression({ elementType }: { elementType: Type }) {
  return code`map[string]${(<TypeExpression type={elementType} />)}`;
}
```

## Built-in module references (optional)

For languages that require explicit imports for standard library types (Python, Go, Rust), you need a `builtins.ts` that declares module references using `createModule()` from the Alloy-JS language package.

**When needed:** Python, Go, Rust — these languages require import statements for stdlib types.
**When NOT needed:** TypeScript, C# — these languages have globally available primitive types.

### Python pattern (`src/python/builtins.ts`)

```typescript
import { createModule } from "@alloy-js/python";

export const datetimeModule = createModule({
  name: "datetime",
  descriptor: {
    ".": ["datetime", "date", "time", "timedelta", "timezone"],
  },
});

export const decimalModule = createModule({
  name: "decimal",
  descriptor: {
    ".": ["Decimal"],
  },
});

export const typingModule = createModule({
  name: "typing",
  descriptor: {
    ".": ["Any", "Callable", "Generic", "Literal", "Never", "Optional", "Protocol", "TypeAlias", "TypeVar"],
  },
});
```

These module references are used in `TypeExpression` and the intrinsic type map. When you reference `typingModule["."]["Any"]`, Alloy-JS automatically generates the corresponding `from typing import Any` statement.

For Go, you'd create similar modules for `time`, `math/big`, etc. The `createModule` function must come from `@alloy-js/<lang>`.

## Barrel exports and package.json

### Barrel files

`src/<lang>/index.ts`:
```typescript
export * from "./components/index.js";
export * from "./utils/index.js";
// If you have builtins.ts:
// export * from "./builtins.js";
```

`src/<lang>/components/index.ts` — export all components:
```typescript
export * from "./type-expression.jsx";
export * from "./type-declaration.js";
export * from "./<model-decl>.js";
export * from "./enum-declaration.js";
export * from "./type-alias-declaration.js";
export * from "./array-expression.jsx";
export * from "./record-expression.jsx";
```

`src/<lang>/utils/index.ts`:
```typescript
export * from "./refkey.js";
```

### package.json additions

Three additions to `packages/emitter-framework/package.json`:

**1. `exports` — add the public entry point:**
```json
{
  "exports": {
    "./<lang>": {
      "import": "./dist/src/<lang>/index.js"
    }
  }
}
```

**2. `imports` — add the internal alias for `#<lang>/*`:**
```json
{
  "imports": {
    "#<lang>/*": {
      "development": "./src/<lang>/*",
      "default": "./dist/src/<lang>/*"
    }
  }
}
```

**3. Dependencies — add the Alloy-JS language package and tree-sitter grammar:**

In `peerDependencies`:
```json
{
  "@alloy-js/<lang>": "^<version>"
}
```

In `devDependencies`:
```json
{
  "@alloy-js/<lang>": "^<version>",
  "tree-sitter-<lang>": "^<version>"
}
```

### Current dependency versions for reference

```json
{
  "peerDependencies": {
    "@alloy-js/core": "^0.22.0",
    "@alloy-js/csharp": "^0.22.0",
    "@alloy-js/python": "^0.3.0",
    "@alloy-js/typescript": "^0.22.0"
  },
  "devDependencies": {
    "tree-sitter-c-sharp": "^0.23.0",
    "tree-sitter-java": "^0.23.2",
    "tree-sitter-python": "^0.25.0",
    "tree-sitter-typescript": "^0.23.0"
  }
}
```

## Testing support

Add a `create<Lang>ExtractorConfig()` function to `src/testing/scenario-test/snippet-extractor.ts`.

### Step 1: Add WASM map entry

```typescript
const wasmMap = {
  "tree-sitter-c-sharp": "tree-sitter-c-sharp/tree-sitter-c_sharp.wasm",
  "tree-sitter-java": "tree-sitter-java/tree-sitter-java.wasm",
  "tree-sitter-python": "tree-sitter-python/tree-sitter-python.wasm",
  "tree-sitter-typescript": "tree-sitter-typescript/tree-sitter-typescript.wasm",
  // Add:
  "tree-sitter-<lang>": "tree-sitter-<lang>/tree-sitter-<lang>.wasm",
};
```

### Step 2: Add extractor config function

```typescript
export async function create<Lang>ExtractorConfig(): Promise<LanguageConfiguration> {
  return {
    codeBlockTypes: ["<lang>"],  // markdown code block identifiers
    format: async (content: string) => content,  // or use a formatter
    language: await loadLanguage("tree-sitter-<lang>"),
    nodeKindMapping: {
      classNodeType: "<tree-sitter-class-node>",
      functionNodeType: "<tree-sitter-function-node>",
      interfaceNodeType: "<tree-sitter-interface-node>",  // if applicable
      typeAliasNodeType: "<tree-sitter-type-alias-node>",  // if applicable
      enumNodeType: "<tree-sitter-enum-node>",  // if applicable
    },
  };
}
```

### Existing `nodeKindMapping` values for reference

| Language | class | function | interface | typeAlias | enum |
|---|---|---|---|---|---|
| TypeScript | `class_declaration` | `function_declaration` | `interface_declaration` | `type_alias_declaration` | `enum_declaration` |
| C# | `class_declaration` | `local_function_statement` | `interface_declaration` | — | `enum_declaration` |
| Java | `class_declaration` | `method_declaration` | `interface_declaration` | — | `enum_declaration` |
| Python | `class_definition` | `function_definition` | — | — | — |

These values come from each language's tree-sitter grammar. Check the grammar's `node-types.json` for the correct node type names.

### LanguageConfiguration interface

```typescript
export interface LanguageConfiguration {
  language: Language;
  format: (content: string) => Promise<string>;
  codeBlockTypes: string[];
  nodeKindMapping: {
    classNodeType?: string;
    functionNodeType?: string;
    interfaceNodeType?: string;
    typeAliasNodeType?: string;
    enumNodeType?: string;
  };
}
```

### Step 3: Export from testing index

The new function is automatically exported via `src/testing/scenario-test/index.ts` which re-exports `"./snippet-extractor.js"`.

## Implementation checklist

### Infrastructure
- [ ] Create `src/<lang>/utils/refkey.ts` with `efRefkey` and `declarationRefkeys` using `Symbol.for("emitter-framework:<lang>")`
- [ ] Create `src/<lang>/lib.ts` with `<lang>-unsupported-scalar` and `<lang>-unsupported-type` diagnostics
- [ ] Create `src/<lang>/utils/index.ts` barrel
- [ ] Create `src/<lang>/index.ts` barrel
- [ ] Create `src/<lang>/components/index.ts` barrel

### Core components
- [ ] `type-expression.tsx` — intrinsic type map, `getScalarIntrinsicExpression()`, `isDeclaration()`, switch on all `type.kind` values
- [ ] `type-declaration.tsx` — router dispatching to declaration components
- [ ] Model declaration component (struct/class/interface) — name policy, refkeys, doc, properties
- [ ] `enum-declaration.tsx` — handle both `Enum` and `Union` types
- [ ] `type-alias-declaration.tsx` — `noReference` on inner `TypeExpression`
- [ ] `array-expression.tsx` — language-specific array/list syntax
- [ ] `record-expression.tsx` — language-specific map/dict syntax

### Optional components
- [ ] `builtins.ts` — if the language requires explicit imports for stdlib types
- [ ] `function-declaration.tsx` — function/method declarations
- [ ] Union expression/declaration components
- [ ] Doc comment rendering

### Package integration
- [ ] Add `exports["./<lang>"]` to `package.json`
- [ ] Add `imports["#<lang>/*"]` to `package.json`
- [ ] Add `@alloy-js/<lang>` to `peerDependencies` and `devDependencies`
- [ ] Add `tree-sitter-<lang>` to `devDependencies`

### Testing
- [ ] Add WASM map entry in `src/testing/scenario-test/snippet-extractor.ts`
- [ ] Add `create<Lang>ExtractorConfig()` function with correct `nodeKindMapping`
- [ ] Write tests for each component using the scenario test harness
