---
changeKind: fix
packages:
  - "@typespec/mutator-framework"
---

Mutate a model's template arguments. `$.type.clone` copies `templateMapper` by reference, so a mutated template instance kept pointing at the *source* argument types and its `getMappedType` answered from the source map. `ModelMutation` now mutates each type-valued `templateMapper.args` entry through a new template-argument edge, and `ModelMutationNode` rebuilds the mutated model's `TypeMapper` (`args`, `map`, `getMappedType`) so it references the mutated arguments. Values and indeterminate entities are left as-is.
