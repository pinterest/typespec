# Mutator Framework API Reference

Complete API lookup for all `@typespec/mutator-framework` exports.

## Table of Contents

- [Engines](#engines)
- [Mutation options](#mutation-options)
- [Simple mutation classes](#simple-mutation-classes)
- [Base mutation classes](#base-mutation-classes)
- [Mutation nodes](#mutation-nodes)
- [Half-edges](#half-edges)
- [Types and interfaces](#types-and-interfaces)

## Engines

### `SimpleMutationEngine<TCustomMutations>`

Convenience engine with `Simple*` defaults. Recommended for most use cases.

```ts
import { SimpleMutationEngine } from "@typespec/mutator-framework";

const engine = new SimpleMutationEngine(typekit, {
  Model: MyModelMutation,      // Optional: override any type kind
  ModelProperty: MyPropMutation,
});
```

**Constructor:** `new SimpleMutationEngine($: Typekit, mutatorClasses: ConstructorsFor<TCustomMutations>)`

**Methods:**

| Method | Description |
|--------|-------------|
| `mutate(type, options?, halfEdge?)` | Mutate a type. Returns the mutation for that type kind. |
| `mutateReference(reference, options?, halfEdge?)` | Mutate through a ModelProperty/UnionVariant reference chain. |
| `replaceAndMutateReference(reference, newType, options?, halfEdge?)` | Replace a referenced type with a new one and mutate it. |
| `getMutationNode(type, options?)` | Get or create a mutation node for a type. |

**Properties:**

| Property | Description |
|----------|-------------|
| `$` | The Typekit instance |

### `MutationEngine<TCustomMutations>`

Low-level engine. Use `SimpleMutationEngine` unless you need custom base mutation classes.

Same methods as `SimpleMutationEngine`. Constructor takes raw mutation class constructors (not `Simple*` variants).

> **Source:** `packages/mutator-framework/src/mutation/mutation-engine.ts`

## Mutation options

### `SimpleMutationOptions`

Base options for simple mutations. Extend for custom configuration.

```ts
import { SimpleMutationOptions } from "@typespec/mutator-framework";

class MyOptions extends SimpleMutationOptions {
  constructor(readonly prefix: string) {
    super();
  }
  get mutationKey() {
    return this.prefix; // Must be unique per configuration
  }
}
```

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `mutationKey` | `string` (getter) | Cache key. Default: `""`. Override for parameterized mutations. |

### `MutationOptions`

Base class for all mutation options. `SimpleMutationOptions` extends this.

## Simple mutation classes

All `Simple*` classes implement `SingleMutationNode<T>`, providing `mutationNode` and `mutatedType`.

### `SimpleModelMutation<TOptions>`

```ts
class MyMutation extends SimpleModelMutation<MyOptions> {
  mutate() {
    this.mutationNode.mutate((type) => { /* modify type */ });
    super.mutate();
  }
}
```

**Properties:** `mutationNode: ModelMutationNode`, `mutatedType: Model`, `sourceType: Model`
**Half-edge methods:** `startBaseEdge()`, `startPropertyEdge()`, `startIndexerKeyEdge()`, `startIndexerValueEdge()`
**Traversal:** `properties` (Map of property mutations), `base` (base model mutation)
**Static:** `mutationInfo(engine, sourceType, referenceTypes, options, halfEdge?, traits?)` — Override for context-sensitive keys.

### `SimpleModelPropertyMutation<TOptions>`

**Properties:** `mutationNode: ModelPropertyMutationNode`, `mutatedType: ModelProperty`, `sourceType: ModelProperty`
**Half-edge methods:** `startTypeEdge()`
**Traversal:** `type` (mutation of the property's type)

### `SimpleUnionMutation<TOptions>`

**Properties:** `mutationNode: UnionMutationNode`, `mutatedType: Union`, `sourceType: Union`
**Half-edge methods:** `startVariantEdge()`
**Traversal:** `variants` (Map of variant mutations)

### `SimpleUnionVariantMutation<TOptions>`

**Properties:** `mutationNode: UnionVariantMutationNode`, `mutatedType: UnionVariant`, `sourceType: UnionVariant`
**Half-edge methods:** `startTypeEdge()`
**Traversal:** `type` (mutation of the variant's type)

### `SimpleOperationMutation<TOptions>`

**Properties:** `mutationNode: OperationMutationNode`, `mutatedType: Operation`, `sourceType: Operation`
**Half-edge methods:** `startParametersEdge()`, `startReturnTypeEdge()`
**Traversal:** `parameters` (model mutation), `returnType` (type mutation)

### `SimpleInterfaceMutation<TOptions>`

**Properties:** `mutationNode: InterfaceMutationNode`, `mutatedType: Interface`, `sourceType: Interface`
**Half-edge methods:** `startOperationEdge()`
**Traversal:** `operations` (Map of operation mutations)

### `SimpleScalarMutation<TOptions>`

**Properties:** `mutationNode: ScalarMutationNode`, `mutatedType: Scalar`, `sourceType: Scalar`
**Half-edge methods:** `startBaseScalarEdge()`

### `SimpleLiteralMutation<TOptions>`

Handles `StringLiteral`, `NumericLiteral`, `BooleanLiteral`.
**Properties:** `mutationNode: LiteralMutationNode`, `mutatedType: StringLiteral | NumericLiteral | BooleanLiteral`

### `SimpleIntrinsicMutation<TOptions>`

**Properties:** `mutationNode: IntrinsicMutationNode`, `mutatedType: IntrinsicType`

## Base mutation classes

Low-level abstract classes. Use `Simple*` variants unless building a custom engine.

| Class | Source file |
|-------|------------|
| `ModelMutation` | `packages/mutator-framework/src/mutation/model.ts` |
| `ModelPropertyMutation` | `packages/mutator-framework/src/mutation/model-property.ts` |
| `UnionMutation` | `packages/mutator-framework/src/mutation/union.ts` |
| `UnionVariantMutation` | `packages/mutator-framework/src/mutation/union-variant.ts` |
| `OperationMutation` | `packages/mutator-framework/src/mutation/operation.ts` |
| `InterfaceMutation` | `packages/mutator-framework/src/mutation/interface.ts` |
| `ScalarMutation` | `packages/mutator-framework/src/mutation/scalar.ts` |
| `EnumMutation` | `packages/mutator-framework/src/mutation/enum.ts` |
| `EnumMemberMutation` | `packages/mutator-framework/src/mutation/enum-member.ts` |
| `LiteralMutation` | `packages/mutator-framework/src/mutation/literal.ts` |
| `IntrinsicMutation` | `packages/mutator-framework/src/mutation/intrinsic.ts` |
| `Mutation` (abstract base) | `packages/mutator-framework/src/mutation/mutation.ts` |

## Mutation nodes

Mutation nodes represent a single type in the parallel mutation graph.

### Common interface: `SingleMutationNode<T>`

```ts
interface SingleMutationNode<T extends Type> {
  mutationNode: MutationNodeForType<T>;
  mutatedType: T;
}
```

### `mutationNode.mutate(fn)`

Apply a modification to the mutated type:

```ts
this.mutationNode.mutate((type) => {
  type.name = "NewName";
});
```

### `mutationNode.replace(newNode)`

Replace this mutation node with another in the engine cache.

## Half-edges

### `MutationHalfEdge<THead, TTail>`

Represents the head-end of a lazy connection between mutations.

```ts
import { MutationHalfEdge } from "@typespec/mutator-framework";

const edge = new MutationHalfEdge("property", headMutation, (tail) => {
  headMutation.mutationNode.connectProperty(tail.mutationNode);
});
```

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `head` | `THead` | The source mutation |
| `tail` | `TTail \| undefined` | The target mutation (set when resolved) |
| `kind` | `string` | Edge kind identifier |

**Methods:** `setTail(tail)` — Called by the engine when the target mutation resolves.

## Types and interfaces

### `MutationInfo`

```ts
interface MutationInfo {
  mutationKey: string;
  isSynthetic?: boolean;
  [key: string]: any;  // Custom fields accessible via this.mutationInfo
}
```

### `MutationTraits`

```ts
interface MutationTraits {
  isSynthetic?: boolean;
}
```

### `CustomMutationClasses`

```ts
type CustomMutationClasses = Partial<MutationRegistry>;
// e.g., { Model: typeof MyModelMutation, ModelProperty: typeof MyPropMutation }
```

> **Source:** `packages/mutator-framework/src/mutation/` (all source files)
