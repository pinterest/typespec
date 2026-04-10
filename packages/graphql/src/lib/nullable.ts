/**
 * Nullable tracking for the GraphQL mutation pipeline.
 *
 * The mutation engine strips `null` variants from unions before components
 * render SDL, so structural nullability evidence is gone by render time.
 * State maps bridge this gap: mutations record nullability, components query it.
 *
 * ## `isNullable` — field/type nullability
 *
 * Marked on different targets depending on context:
 * - **ModelProperty**: inline `T | null` (can't mark the shared scalar singleton)
 * - **Operation**: return type `T | null`
 * - **Union**: named unions like `Cat | Dog | null` (safe — new unique object)
 *
 * ## `hasNullableElements` — array element nullability
 *
 * For `(string | null)[]`, marks the ModelProperty so components emit
 * `[String]` instead of `[String!]`.
 */

import type { Program, Type } from "@typespec/compiler";
import { useStateSet } from "@typespec/compiler/utils";
import { GraphQLKeys } from "../lib.js";

const [getNullableState, setNullableState] = useStateSet<Type>(GraphQLKeys.nullable);

/** Check whether a type, property, or operation was marked nullable. */
export function isNullable(program: Program, type: Type): boolean {
  return getNullableState(program, type);
}

/** Mark a type, property, or operation as nullable. */
export function setNullable(program: Program, type: Type): void {
  setNullableState(program, type);
}

const [getNullableElementsState, setNullableElementsState] = useStateSet<Type>(
  GraphQLKeys.nullableElements,
);

/** Check whether a property's array elements were originally `T | null`. */
export function hasNullableElements(program: Program, type: Type): boolean {
  return getNullableElementsState(program, type);
}

/** Mark a property as having nullable array elements. */
export function setNullableElements(program: Program, type: Type): void {
  setNullableElementsState(program, type);
}
