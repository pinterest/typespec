---
changeKind: fix
packages:
  - "@typespec/mutator-framework"
  - "@typespec/graphql"
---

Keep `derivedModels` in sync on mutated models. `$.type.clone` copies `derivedModels` as a shallow array, so a mutated base model kept listing the *source* derived models; the base-model edge now swaps in the mutated derived model (and drops it again on deletion). The GraphQL mutation engine's inheritance flatten now also removes the flattened derived model from its base's `derivedModels`, since the flattened graph has no inheritance.
