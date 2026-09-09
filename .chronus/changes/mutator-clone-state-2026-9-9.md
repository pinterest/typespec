---
changeKind: feature
packages:
  - "@typespec/compiler"
  - "@typespec/mutator-framework"
---

Carry auto decorator state onto mutated clones. Auto decorator markers applied programmatically with `setAutoDecorator` live in program state maps keyed by the target type, so a type cloned by the mutator framework started out without them (markers written as decorators in source were re-applied by `finishType`, programmatic ones were not). The compiler gains `copyAutoDecorators(program, source, target)`, and `MutationNode.mutate()` calls it right after cloning so mutated types keep markers such as `@typespec/graphql`'s `nullable` and `inputType`.
