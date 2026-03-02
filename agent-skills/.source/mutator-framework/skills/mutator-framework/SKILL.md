---
name: mutator-framework
description: "Guide for using the TypeSpec mutator framework (@typespec/mutator-framework) to transform TypeSpec types before emission. Use when the agent needs to (1) create type graph mutations (renaming, wrapping, substituting types), (2) implement custom mutation classes for models, properties, unions, scalars, or other type kinds, (3) understand mutation caching, half-edges, and the mutationInfo protocol, (4) integrate mutated types with the emitter framework, or (5) debug or extend existing mutation logic."
---

# Mutator Framework

> **WARNING:** This package is experimental and will change.

Transform TypeSpec types before emission using `@typespec/mutator-framework`.

## Overview

```
Original types ──> MutationEngine ──> Mutated types ──> Emitter
  (type graph)    (SimpleMutationEngine   (parallel        (emitter-framework
                   + custom mutations)     type graph)      components)
```

The mutator framework creates a parallel type graph with modifications. Original types are never changed — mutations produce new views of the type graph.

## Core concepts

- **`SimpleMutationEngine`** — Convenience engine that orchestrates mutations with `Simple*` mutation classes. Created with a Typekit and optional custom mutation classes.
- **Mutation classes** — One per type kind. Override `mutate()` to transform types. Default classes traverse without modification.
- **`SimpleMutationOptions`** — Controls mutation behavior. Override `mutationKey` getter for cache differentiation.
- **Mutation caching** — Mutations are cached per `(type, mutationKey)` pair. Same type + same key = same mutation instance.
- **Half-edges** — Lazy connections between parent and child mutations via `startXEdge()` methods.

## Getting started

### Rename example

```ts
import { Model } from "@typespec/compiler";
import { $ } from "@typespec/compiler/typekit";
import {
  SimpleModelMutation,
  SimpleMutationEngine,
  SimpleMutationOptions,
} from "@typespec/mutator-framework";

// 1. Define custom options with a mutationKey
class RenameMutationOptions extends SimpleMutationOptions {
  constructor(readonly suffix: string) {
    super();
  }
  get mutationKey() {
    return this.suffix;
  }
}

// 2. Define a custom mutation
class RenameModelMutation extends SimpleModelMutation<RenameMutationOptions> {
  mutate() {
    if ("name" in this.sourceType && typeof this.sourceType.name === "string") {
      this.mutationNode.mutate(
        (type) => (type.name = `${this.sourceType.name}${this.options.suffix}`),
      );
    }
    super.mutate(); // Continue default traversal
  }
}

// 3. Create engine and run
const tk = $(program);
const engine = new SimpleMutationEngine(tk, {
  Model: RenameModelMutation,
});

const options = new RenameMutationOptions("Dto");
const fooMutation = engine.mutate(fooModel, options);
console.log(fooMutation.mutatedType.name); // "FooDto"
```

## Writing custom mutations

### The `mutate()` method

Every custom mutation class overrides `mutate()`. Available in context:

- `this.sourceType` — The original TypeSpec type
- `this.mutationNode` — The mutation node (call `.mutate(fn)` to modify the mutated type)
- `this.options` — The mutation options
- `this.engine` — The engine (for traversing to related types)

```ts
class MyModelMutation extends SimpleModelMutation<MyOptions> {
  mutate() {
    // Modify the mutated type
    this.mutationNode.mutate((type) => {
      type.name = `${this.sourceType.name}Modified`;
    });

    // IMPORTANT: call super.mutate() to continue default traversal
    // (iterates properties, base, indexer). Skip only for full control.
    super.mutate();
  }
}
```

### Available mutation classes

| TypeSpec kind | Simple class | Half-edge methods |
|---------------|-------------|-------------------|
| `Model` | `SimpleModelMutation` | `startBaseEdge()`, `startPropertyEdge()`, `startIndexerKeyEdge()`, `startIndexerValueEdge()` |
| `ModelProperty` | `SimpleModelPropertyMutation` | `startTypeEdge()` |
| `Union` | `SimpleUnionMutation` | `startVariantEdge()` |
| `UnionVariant` | `SimpleUnionVariantMutation` | `startTypeEdge()` |
| `Operation` | `SimpleOperationMutation` | `startParametersEdge()`, `startReturnTypeEdge()` |
| `Interface` | `SimpleInterfaceMutation` | `startOperationEdge()` |
| `Scalar` | `SimpleScalarMutation` | `startBaseScalarEdge()` |
| `String/Number/Boolean` | `SimpleLiteralMutation` | — |
| `Intrinsic` | `SimpleIntrinsicMutation` | — |

Each `Simple*` class provides:
- `mutationNode` — Access the underlying mutation node
- `mutatedType` — Access the mutated TypeSpec type
- `sourceType` — The original type
- `kind` — The type kind string

### The `mutationInfo` protocol

Override the static `mutationInfo` method for context-sensitive mutation keys:

```ts
class ContextSensitiveModelMutation extends SimpleModelMutation<SimpleMutationOptions> {
  static mutationInfo(
    engine: SimpleMutationEngine<any>,
    sourceType: Model,
    referenceTypes: MemberType[],  // How we got here (ModelProperty, UnionVariant chain)
    options: SimpleMutationOptions,
    halfEdge?: MutationHalfEdge,
    traits?: MutationTraits,
  ): MutationInfo {
    // Different key based on whether reached via a reference
    if (referenceTypes.length === 0) {
      return { mutationKey: options.mutationKey + "-root", isSynthetic: traits?.isSynthetic };
    }
    return { mutationKey: options.mutationKey + "-ref", isSynthetic: traits?.isSynthetic };
  }
}
```

The `referenceTypes` array contains the chain of `ModelProperty` or `UnionVariant` types that led to this mutation. Use this for context-dependent transformations (e.g., rename differently when referenced vs. root).

### Half-edges and lazy connections

Connections between mutations are built lazily. Call `startXEdge()` to create a half-edge, then pass it to `engine.mutate()`:

```ts
class MyModelMutation extends SimpleModelMutation<MyOptions> {
  mutate() {
    for (const prop of this.sourceType.properties.values()) {
      // The half-edge connects when the property mutation resolves
      this.engine.mutate(prop, this.options, this.startPropertyEdge());
    }
  }
}
```

### Replacing referenced types

Use `engine.replaceAndMutateReference()` to substitute a type while preserving the reference chain:

```ts
class WrapInUnionProperty extends SimpleModelPropertyMutation<SimpleMutationOptions> {
  mutate() {
    if (!this.engine.$.union.is(this.sourceType.type)) {
      const unionType = this.engine.$.union.create({
        name: "Wrapped",
        variants: [
          this.engine.$.unionVariant.create({ type: this.sourceType.type }),
          this.engine.$.unionVariant.create({ type: this.engine.$.builtin.string }),
        ],
      });

      this.mutationNode.mutate((prop) => { prop.type = unionType; });

      this.type = this.engine.replaceAndMutateReference(
        this.sourceType, unionType, this.options, this.startTypeEdge(),
      );
    } else {
      super.mutate();
    }
  }
}
```

### Returning mutations from `mutationInfo`

Return a `Mutation` directly from `mutationInfo` to substitute a completely different mutation. This makes the mutation graph look "as if" the source type graph had a different shape:

```ts
class NullableRefModel extends SimpleModelMutation<SimpleMutationOptions> {
  static mutationInfo(engine, sourceType, referenceTypes, options, halfEdge, traits) {
    if (referenceTypes.length > 0 && referenceTypes[0].kind === "ModelProperty") {
      const nullableUnion = engine.$.union.create({
        name: `${sourceType.name}Nullable`,
        variants: [
          engine.$.unionVariant.create({ name: "Value", type: sourceType }),
          engine.$.unionVariant.create({ name: "Null", type: engine.$.intrinsic.null }),
        ],
      });
      return engine.replaceAndMutateReference(referenceTypes[0], nullableUnion, options, halfEdge);
    }
    return super.mutationInfo(engine, sourceType, referenceTypes, options, halfEdge, traits);
  }
}
```

**Note on `replace` vs. `mutationInfo` return:** Returning a mutation from `mutationInfo` reshapes the mutation graph as if the source types were different (useful for normalizations). Using `mutationNode.replace()` keeps the same mutation but swaps the mutated type (useful for renaming, scalar substitution where you want to compare source vs. mutated).

## Mutation caching

Mutations are automatically cached per `(type, mutationKey)`:

```ts
const bar1 = engine.mutate(Bar, new RenameMutationOptions("X"));
const foo = engine.mutate(Foo, new RenameMutationOptions("X"));
// When Foo traverses to its Bar property, it gets the same bar1 mutation
```

Ensure `mutationKey` is unique for different mutation configurations. The default `SimpleMutationOptions` returns `""` as the key.

## Integration with emitter framework

Create a `SimpleMutationEngine` in your emitter, mutate types, then pass mutated types to emitter framework components:

```tsx
import { SimpleMutationEngine } from "@typespec/mutator-framework";
import { TypeExpression, TypeDeclaration } from "@typespec/emitter-framework/typescript";

export async function $onEmit(context: EmitContext) {
  const engine = new SimpleMutationEngine($(context.program), {
    Model: MyModelMutation,
  });

  // Mutate types, then use mutatedType in components
  const mutation = engine.mutate(someModel, options);
  // Pass mutation.mutatedType to TypeExpression / TypeDeclaration
}
```

For comprehensive patterns, see [references/patterns.md](references/patterns.md). For the complete API, see [references/api-reference.md](references/api-reference.md).

## Key source locations

| Area | Path |
|------|------|
| SimpleMutationEngine | `packages/mutator-framework/src/mutation/simple-mutation-engine.ts` |
| MutationEngine | `packages/mutator-framework/src/mutation/mutation-engine.ts` |
| Mutation base class | `packages/mutator-framework/src/mutation/mutation.ts` |
| Model mutation | `packages/mutator-framework/src/mutation/model.ts` |
| Test examples | `packages/mutator-framework/src/mutation/simple-mutation-engine.test.ts` |
| Package README | `packages/mutator-framework/README.md` |

## Related skills

- **typespec-emitter** — End-to-end emitter lifecycle, including when and why to use mutations
- **emitter-framework** — JSX-based component model that consumes mutated types
- **typespec-library** — Library package setup, diagnostics, testing infrastructure
