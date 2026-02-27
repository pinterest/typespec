# Emitter Framework Concepts

Conceptual overview of the TypeSpec emitter framework architecture.

## Table of Contents

- [Architecture](#architecture)
- [Component model](#component-model)
- [The rendering pipeline](#the-rendering-pipeline)
- [Type system bridge](#type-system-bridge)
- [Language support](#language-support)
- [Mutator framework](#mutator-framework)

## Architecture

The emitter framework sits between the TypeSpec compiler and Alloy-JS:

```
TypeSpec Compiler ──> Emitter Framework ──> Alloy-JS ──> Output Files
   (type graph)     (context, hooks,      (rendering,
                     type mapping)         file output)
```

- **TypeSpec compiler** provides the type graph — models, operations, enums, unions, scalars, etc.
- **Emitter framework** provides the `Output` component (TypeSpec-aware wrapper around Alloy-JS), the `useTsp()` hook for accessing the type graph, and language-specific components for mapping types to code.
- **Alloy-JS** handles the rendering pipeline: JSX evaluation, cross-file reference resolution, import generation, and file system output.

## Component model

The framework uses a JSX-based, compositional component model. Components are plain functions that return JSX — there is no class inheritance.

```tsx
function MyComponent(props: { type: Model }) {
  const { $ } = useTsp();
  return <InterfaceDeclaration type={props.type} />;
}
```

The framework provides language-specific components that wrap Alloy-JS primitives with TypeSpec-aware behavior. For example, `TypeExpression` from `@typespec/emitter-framework/typescript` wraps Alloy-JS's `Reference` and `ValueExpression` with logic that maps TypeSpec scalar types to TypeScript types.

### Component categories

1. **Core components** — `Output`, `Experimental_ComponentOverrides` (from `@typespec/emitter-framework`)
2. **Language-specific type components** — `TypeExpression`, `TypeDeclaration` (from `@typespec/emitter-framework/typescript`, `/python`, `/csharp`)
3. **Language-specific declaration components** — `InterfaceDeclaration`, `ClassDeclaration`, `EnumDeclaration`, etc.
4. **Alloy-JS primitives** — `SourceDirectory`, `SourceFile`, `Reference`, `For`, `List` (from `@alloy-js/core` and language packages)

## The rendering pipeline

The full rendering pipeline from `$onEmit` to files on disk:

1. **`$onEmit(context)`** — Your entry point. Build a JSX tree.
2. **JSX tree construction** — Components compose into a tree describing output structure.
3. **`writeOutput(program, tree, dir)`** — Calls Alloy-JS `renderAsync()`.
4. **`renderAsync()`** — Evaluates the JSX tree asynchronously. Resolves refkeys, generates imports, applies name policies.
5. **File system write** — Walks the rendered `OutputDirectory` tree and calls `emitFile()` for each file.

The tree is rendered asynchronously because some components may need to perform async operations during rendering.

## Type system bridge

### Typekit (`$`)

The Typekit, accessed via `useTsp()`, provides introspection utilities for TypeSpec types:

```tsx
const { $, program } = useTsp();

$.model.getProperties(model);  // Get model properties
$.scalar.is(type);             // Check if type is a scalar
$.array.is(type);              // Check if type is an array
$.record.is(type);             // Check if type is a record
$.scalar.getStdBase(scalar);   // Get the standard library base scalar
$.type.getDoc(type);           // Get documentation string
```

### TypeExpression

`TypeExpression` maps TypeSpec types to target language type expressions. Each language has its own `TypeExpression` component with a complete intrinsic type map. When a type is a named declaration, `TypeExpression` emits a reference (via `efRefkey`) instead of inlining.

### TypeDeclaration

`TypeDeclaration` routes a TypeSpec type to the correct declaration component based on `type.kind`. For TypeScript: Model -> `InterfaceDeclaration`, Union -> `UnionDeclaration`, Enum -> `EnumDeclaration`, Scalar/Operation -> `TypeAliasDeclaration`.

### SCCSet — topological ordering

`SCCSet<T>` maintains a growing directed graph and exposes its strongly connected components (SCCs) using an incremental variant of Tarjan's algorithm.

This is used for ordering type declarations so that dependencies come before dependents. When circular dependencies exist, the SCC groups them into a single component that can be emitted together in the same file.

```tsx
import { SCCSet, typeDependencyConnector } from "@typespec/emitter-framework";

const scc = new SCCSet(typeDependencyConnector);
scc.addAll(types);
// scc.items — topologically ordered types
// scc.components — SCCs with dependency/dependent edges
```

Key properties:
- `items: T[]` — Flattened, topologically ordered list of all added nodes
- `components: SCCComponent<T>[]` — Ordered SCCs with `references` and `referencedBy` sets for walking the component graph

> **Reference:** `packages/emitter-framework/src/core/scc-set.ts`
> **Reference:** `packages/emitter-framework/src/core/type-connector.ts`

### Type dependency connector

`typeDependencyConnector` is the connector function for `SCCSet` that maps TypeSpec types to their dependency edges:

- Model depends on: base model, property types, indexer key/value
- Operation depends on: parameters, return type
- Union depends on: variant types
- Interface depends on: operations
- Enum depends on: members
- Scalar depends on: base scalar

## Language support

Three built-in target languages, each backed by an `@alloy-js/*` package:

### TypeScript (`@typespec/emitter-framework/typescript`)

- Backed by `@alloy-js/typescript`
- Intrinsic type map: `int32` -> `number`, `int64` -> `bigint`, `utcDateTime` -> `Date`, etc.
- Declarations: `InterfaceDeclaration`, `EnumDeclaration`, `TypeAliasDeclaration`, `UnionDeclaration`, `FunctionDeclaration`
- Name policy from `@alloy-js/typescript` (PascalCase types, camelCase members)

### Python (`@typespec/emitter-framework/python`)

- Backed by `@alloy-js/python`
- Intrinsic type map: `int32` -> `int`, `string` -> `str`, `utcDateTime` -> `datetime`, etc.
- Declarations: `ClassDeclaration`, `EnumDeclaration`, `TypeAliasDeclaration`, `FunctionDeclaration`
- Built-in module references: `abc`, `datetime`, `typing`, `decimal`
- Name policy from `@alloy-js/python` (PascalCase classes, snake_case functions/members)

### C# (`@typespec/emitter-framework/csharp`)

- Backed by `@alloy-js/csharp`
- Declarations: `ClassDeclaration`, `EnumDeclaration`, `PropertyDeclaration`
- Includes `JsonConverter` and `JsonConverterResolver` components for System.Text.Json support

## Mutator framework

The `@typespec/mutator-framework` is a complementary system for transforming TypeSpec types before emission. While the emitter framework maps types to code, the mutator framework transforms the types themselves.

### Core concepts

- **MutationEngine** — Orchestrates type mutations. Created with a Typekit and optional custom mutation classes. Provides `mutate()` and `mutateReference()` methods.
- **Mutation classes** — One per type kind (ModelMutation, OperationMutation, UnionMutation, etc.). Each defines how to transform its type kind.
- **MutationOptions** — Controls mutation behavior and provides cache keys for deduplication.
- **MutationHalfEdge** — Links parent and child mutations together, enabling graph-based change propagation.
- **MutationNode** — Represents a single node in the mutation graph; tracks source type and mutation key.

### Default mutation classes

The engine provides default mutation classes for all TypeSpec type kinds:
`Operation`, `Interface`, `Model`, `Scalar`, `ModelProperty`, `Union`, `UnionVariant`, `Enum`, `EnumMember`, `String`, `Number`, `Boolean`, `Intrinsic`

Custom mutation classes can override any of these to add domain-specific transformation logic.

### Usage pattern

```tsx
const engine = new MutationEngine($, {
  Model: MyCustomModelMutation,
  // ... other custom mutations
});

const mutated = engine.mutate(someType, new MyOptions());
```

> **Reference:** `packages/mutator-framework/src/mutation/mutation-engine.ts`
