import type { Model, Program } from "@typespec/compiler";
import { useStateMap } from "@typespec/compiler/utils";
import { GraphQLKeys } from "../lib.js";

const [getOneOfState, setOneOfState] = useStateMap<Model, boolean>(GraphQLKeys.oneOf);

/**
 * Check if a model has been marked as a @oneOf input object.
 * These are synthetic models created by the union mutation when a union
 * is used in input context — GraphQL unions are output-only, so input
 * unions become @oneOf input objects.
 */
export function isOneOf(program: Program, model: Model): boolean {
  return getOneOfState(program, model) === true;
}

/**
 * Mark a model as a @oneOf input object.
 */
export function setOneOf(program: Program, model: Model): void {
  setOneOfState(program, model, true);
}
