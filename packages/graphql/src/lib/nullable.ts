import type { Program, Type } from "@typespec/compiler";
import { useStateSet } from "@typespec/compiler/utils";
import { GraphQLKeys } from "../lib.js";

const [getNullableState, setNullableState] = useStateSet<Type>(GraphQLKeys.nullable);

/**
 * Check if a type has been marked as nullable due to null-variant stripping.
 * For example, `Cat | Dog | null` becomes `union CatDog` marked as nullable.
 */
export function isNullable(program: Program, type: Type): boolean {
  return getNullableState(program, type);
}

/**
 * Mark a type as nullable. Called by the mutation engine when null variants
 * are stripped from a union during processing.
 */
export function setNullable(program: Program, type: Type): void {
  setNullableState(program, type);
}

const [getNullableElementsState, setNullableElementsState] = useStateSet<Type>(
  GraphQLKeys.nullableElements,
);

/**
 * Check if a property has been marked as having nullable array elements.
 * For example, `tags: (string | null)[]` — the property's element type was
 * originally `T | null`, which the mutation engine replaces with `T`.
 */
export function hasNullableElements(program: Program, type: Type): boolean {
  return getNullableElementsState(program, type);
}

/**
 * Mark a property as having nullable array elements. Called by the mutation
 * engine when the property's array element type is an inline `T | null` union.
 */
export function setNullableElements(program: Program, type: Type): void {
  setNullableElementsState(program, type);
}
