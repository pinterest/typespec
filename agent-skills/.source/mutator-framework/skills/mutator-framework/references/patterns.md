# Mutator Framework Patterns

Common patterns with code examples for TypeSpec type mutations.

## Table of Contents

- [Rename types](#rename-types)
- [Context-sensitive mutations](#context-sensitive-mutations)
- [Type substitution (wrapping in unions)](#type-substitution-wrapping-in-unions)
- [Nullable wrapping via mutationInfo](#nullable-wrapping-via-mutationinfo)
- [Composing multiple mutation classes](#composing-multiple-mutation-classes)
- [Integration with emitter components](#integration-with-emitter-components)

## Rename types

Add a suffix (or prefix) to all model names:

```ts
class RenameMutationOptions extends SimpleMutationOptions {
  constructor(readonly suffix: string) { super(); }
  get mutationKey() { return this.suffix; }
}

class RenameModelMutation extends SimpleModelMutation<RenameMutationOptions> {
  mutate() {
    if ("name" in this.sourceType && typeof this.sourceType.name === "string") {
      this.mutationNode.mutate(
        (type) => (type.name = `${this.sourceType.name}${this.options.suffix}`),
      );
    }
    super.mutate();
  }
}

// Usage
const engine = new SimpleMutationEngine(tk, { Model: RenameModelMutation });
const mutation = engine.mutate(fooModel, new RenameMutationOptions("Dto"));
// mutation.mutatedType.name === "FooDto"
// Properties' model references also renamed
```

**Key points:**
- `super.mutate()` continues traversal to properties, which traverses to their types
- Referenced models (e.g., `Bar` in `prop: Bar`) get renamed too because the engine traverses through properties

## Context-sensitive mutations

Mutate differently based on how a type was reached:

```ts
class ContextModelMutation extends SimpleModelMutation<SimpleMutationOptions> {
  static mutationInfo(engine, sourceType, referenceTypes, options, halfEdge, traits) {
    if (referenceTypes.length === 0) {
      return { mutationKey: options.mutationKey + "-root", hasReference: false, isSynthetic: traits?.isSynthetic };
    }
    return { mutationKey: options.mutationKey + "-ref", hasReference: true, isSynthetic: traits?.isSynthetic };
  }

  mutate() {
    if (this.mutationInfo.hasReference) {
      this.mutationNode.mutate((type) => (type.name = `${this.sourceType.name}Reference`));
    }
    // Root types keep original name
    super.mutate();
  }
}
```

**When to use:** When the same type should look different depending on context — e.g., `Bar` at the root vs. `BarReference` when used as a property type.

**How it works:** The `referenceTypes` parameter contains the chain of `ModelProperty` / `UnionVariant` that led to this type. Empty means it was mutated directly (root).

## Type substitution (wrapping in unions)

Replace a property's type with a union wrapping the original:

```ts
class UnionifyProperty extends SimpleModelPropertyMutation<SimpleMutationOptions> {
  mutate() {
    if (!this.engine.$.union.is(this.sourceType.type)) {
      // Create synthetic union
      const newUnion = this.engine.$.union.create({
        name: "DynamicUnion",
        variants: [
          this.engine.$.unionVariant.create({ type: this.sourceType.type }),
          this.engine.$.unionVariant.create({ type: this.engine.$.builtin.string }),
        ],
      });

      // Update the mutation node
      this.mutationNode.mutate((prop) => { prop.type = newUnion; });

      // Replace the reference so traversal continues into the union
      this.type = this.engine.replaceAndMutateReference(
        this.sourceType, newUnion, this.options, this.startTypeEdge(),
      );
    } else {
      super.mutate();
    }
  }
}

// Usage
const engine = new SimpleMutationEngine(tk, { ModelProperty: UnionifyProperty });
const mutation = engine.mutate(fooModel);
// mutation.properties.get("prop").mutatedType.type.kind === "Union"
```

**Key points:**
- `replaceAndMutateReference` substitutes the type and continues mutation traversal
- The synthetic union and its variants get their own mutations
- `this.type` is updated so the mutation graph reflects the new structure

## Nullable wrapping via mutationInfo

Wrap referenced models in a nullable union by returning a mutation from `mutationInfo`:

```ts
class NullableRefModel extends SimpleModelMutation<SimpleMutationOptions> {
  static mutationInfo(engine, sourceType, referenceTypes, options, halfEdge, traits) {
    // Only wrap when reached via a ModelProperty reference
    if (referenceTypes.length > 0 && referenceTypes[0].kind === "ModelProperty") {
      const nullableUnion = engine.$.union.create({
        name: `${sourceType.name ?? "Anonymous"}Nullable`,
        variants: [
          engine.$.unionVariant.create({ name: "Value", type: sourceType }),
          engine.$.unionVariant.create({ name: "Null", type: engine.$.intrinsic.null }),
        ],
      });

      // Return a mutation directly — reshapes the graph
      return engine.replaceAndMutateReference(
        referenceTypes[0], nullableUnion, options, halfEdge,
      );
    }
    return super.mutationInfo(engine, sourceType, referenceTypes, options, halfEdge, traits);
  }
}
```

**When to use:** When types should be automatically wrapped (e.g., nullable, optional) when referenced from specific contexts.

**How it works:** Returning a `Mutation` from `mutationInfo` completely substitutes that mutation. The graph looks as if the source type was the union, not the model.

## Composing multiple mutation classes

Provide multiple custom mutation classes to handle different type kinds:

```ts
interface MyMutations {
  Model: RenameModelMutation;
  ModelProperty: AddMetadataProperty;
  Union: FlattenUnionMutation;
}

class AddMetadataProperty extends SimpleModelPropertyMutation<MyOptions> {
  mutate() {
    // Custom property logic
    this.mutationNode.mutate((prop) => {
      // Add metadata to the property
    });
    super.mutate();
  }
}

class FlattenUnionMutation extends SimpleUnionMutation<MyOptions> {
  mutate() {
    // Custom union logic
    super.mutate();
  }
}

const engine = new SimpleMutationEngine<MyMutations>(tk, {
  Model: RenameModelMutation,
  ModelProperty: AddMetadataProperty,
  Union: FlattenUnionMutation,
});
```

Unspecified type kinds use the default `Simple*` mutation classes (pass-through traversal).

## Integration with emitter components

### Pattern: mutate in $onEmit, pass to components

```tsx
// emitter.tsx
import { SimpleMutationEngine } from "@typespec/mutator-framework";
import { writeOutput } from "@typespec/emitter-framework";
import { Output } from "./components/output.jsx";

export async function $onEmit(context: EmitContext) {
  const tk = $(context.program);
  const engine = new SimpleMutationEngine(tk, {
    Model: MyModelMutation,
  });

  writeOutput(
    context.program,
    <Output program={context.program} engine={engine} />,
    context.emitterOutputDir,
  );
}
```

### Pattern: mutate types before rendering

```tsx
// components/models.tsx
function Models(props: { engine: SimpleMutationEngine<any> }) {
  const { $ } = useTsp();
  const models = getRelevantModels($);

  return models.map((model) => {
    const mutation = props.engine.mutate(model);
    return (
      <ts.SourceFile path={`${mutation.mutatedType.name}.ts`}>
        <TypeDeclaration type={mutation.mutatedType} />
      </ts.SourceFile>
    );
  });
}
```

### Decision tree: mutator vs. component logic

Use **mutator** when:
- Transformation is global (affects all types of a kind)
- Multiple components need the same simplified types
- You need to reshape the type graph (e.g., flatten spreads, normalize nullables)
- The transformation is reusable across emitters

Use **component logic** when:
- Transformation is local to one component
- Output formatting is specific to one rendering context
- No other component needs the same transformation

> **Source:** `packages/mutator-framework/src/mutation/simple-mutation-engine.test.ts`
