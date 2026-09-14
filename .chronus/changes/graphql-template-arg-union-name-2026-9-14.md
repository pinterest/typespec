---
changeKind: fix
packages:
  - "@typespec/graphql"
---

Name anonymous unions written as template arguments (`Foo<Bar | Baz>`, `op get is base<Bar | Baz>`) after the declaration that encloses the template reference, instead of reporting `unrecognized-union`. Sibling anonymous unions in one argument list get a positional suffix.
