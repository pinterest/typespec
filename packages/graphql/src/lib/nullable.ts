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
