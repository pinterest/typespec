# GraphQL Emitter Follow-up Items

## ~~Input Type Nullability Bug~~ (RESOLVED)

**Status**: Fixed in PR #77 (commit ea85714d2)

**Original issue**: Optional fields in input types were being made non-null.

**Resolution**: Per the GraphQL spec, "nullability directly determines whether a field is required." Optional fields (`?`) should be nullable in both input and output contexts. This also enables circular references in input types (e.g., `Author.friend?: Author` → `friend: AuthorInput` is valid because it's nullable).

**Correct behavior** (now implemented):

| TypeSpec           | Output   | Input    |
|--------------------|----------|----------|
| a: string          | String!  | String!  |
| b?: string         | String   | String   |
| c: string \| null  | String   | String   |

---

## @oneOf Input Union Bug (Priority: Medium)

**Issue**: Unions used in input context (e.g., mutation parameters) should be converted to `@oneOf` input objects per the GraphQL spec, but the emitter crashes with "Unknown GraphQL type" when attempting this.

**Test case that exposes the bug**:
```typespec
@schema
namespace TestNamespace {
  model TextContent {
    text: string;
  }

  model ImageContent {
    url: string;
  }

  union Content {
    text: TextContent,
    image: ImageContent,
  }

  model Post {
    id: string;
    content: Content;
  }

  @query
  op getPost(id: string): Post;

  @mutation
  op createPost(content: Content): Post;
}
```

**Error**:
```
Error: Unknown GraphQL type "ContentInput".
    at resolveNamedType (src/schema/build/types.ts:100:11)
```

**Root cause**: The `GraphQLUnionMutation.mutateAsOneOfInput()` correctly creates the `@oneOf` input model (e.g., `ContentInput`), but this synthetic model is not being registered in the type registry that `buildArgsMap` uses to resolve argument types.

**Expected behavior**:
- In output context: `union Content = TextContent | ImageContent`
- In input context: `input ContentInput @oneOf { text: TextContentInput, image: ImageContentInput }`

**Files to investigate**:
- `src/mutation-engine/mutations/union.ts` - `mutateAsOneOfInput()` creates the @oneOf model
- `src/schema/build/types.ts` - where the type registry is built and `resolveNamedType` fails
- `src/mutation-engine/schema-mutator.ts` - may need to register synthetic types

**Related**: Similar bug exists for complex input types used in `@operationFields` arguments (the `FilterOptions` model isn't discovered when used only as an operation field argument type).
