/**
 * Nullable tracking for the GraphQL mutation pipeline.
 *
 * ## Why state maps?
 *
 * The GraphQL mutation engine strips `null` variants from unions before the
 * component layer renders SDL. By the time components see a type, the
 * structural evidence of nullability is gone — a `string | null` property's
 * type has already been replaced with the bare `string` scalar.
 *
 * State maps bridge this gap: the mutation engine records nullability facts
 * during transformation, and components query them at render time.
 *
 * (This differs from the C# emitter, which has no mutation engine and detects
 * `T | null` unions structurally at render time. That approach doesn't work
 * here because our mutation engine rewrites the type graph first.)
 *
 * ## Two tracking dimensions
 *
 * **Field nullability** (`isNullable`): The field/property itself is nullable.
 *
 *   Marked on different targets depending on the source:
 *   - *Property-level*: For inline `T | null` (e.g., `bio: string | null`),
 *     the union is replaced with the shared scalar singleton. Marking the
 *     singleton would poison every use of that scalar, so we mark the
 *     **ModelProperty** instead. Set by `GraphQLModelPropertyMutation`.
 *   - *Operation-level*: For `op getUser(): User | null`, the return type
 *     union is replaced with the inner type. We mark the **Operation**
 *     itself. Set by `GraphQLOperationMutation`.
 *   - *Type-level*: For named multi-variant unions with null (e.g.,
 *     `union Pet { Cat, Dog, null }`), the engine creates a new unique union
 *     object without the null variant. This new object is safe to mark
 *     directly. Set by `GraphQLUnionMutation`.
 *
 *   Components call `isNullable(program, property)`,
 *   `isNullable(program, operation)`, or `isNullable(program, type)` —
 *   all use the same state set.
 *
 * **Element nullability** (`hasNullableElements`): Array elements are nullable.
 *
 *   For `tags: (string | null)[]`, the mutation engine replaces the element
 *   union with the inner scalar but the array itself is non-null. We mark the
 *   **ModelProperty** so the component layer can emit `[String]` (nullable
 *   elements) instead of `[String!]`. Set by `GraphQLModelPropertyMutation`.
 */

import type { Program, Type } from "@typespec/compiler";
import { useStateSet } from "@typespec/compiler/utils";
import { GraphQLKeys } from "../lib.js";

const [getNullableState, setNullableState] = useStateSet<Type>(GraphQLKeys.nullable);

/**
 * Check whether a type or property was marked nullable by the mutation engine.
 *
 * Works on both type-level targets (named unions with null stripped) and
 * property-level targets (inline `T | null` on a ModelProperty).
 */
export function isNullable(program: Program, type: Type): boolean {
  return getNullableState(program, type);
}

/**
 * Mark a type or property as nullable. Called by the mutation engine when
 * null variants are stripped during processing.
 *
 * @see {@link GraphQLModelPropertyMutation} — marks ModelProperty for inline `T | null`
 * @see {@link GraphQLOperationMutation} — marks Operation for `op foo(): T | null`
 * @see {@link GraphQLUnionMutation} — marks the new union for named `Cat | Dog | null`
 */
export function setNullable(program: Program, type: Type): void {
  setNullableState(program, type);
}

const [getNullableElementsState, setNullableElementsState] = useStateSet<Type>(
  GraphQLKeys.nullableElements,
);

/**
 * Check whether a property's array elements were originally `T | null`.
 *
 * For `tags: (string | null)[]`, the mutation engine replaces the element
 * type with the bare scalar, but the component layer still needs to know
 * that elements should be emitted without `!` (e.g., `[String]` not `[String!]`).
 */
export function hasNullableElements(program: Program, type: Type): boolean {
  return getNullableElementsState(program, type);
}

/**
 * Mark a property as having nullable array elements.
 *
 * @see {@link GraphQLModelPropertyMutation} — detects `Array<T | null>` pattern
 */
export function setNullableElements(program: Program, type: Type): void {
  setNullableElementsState(program, type);
}
