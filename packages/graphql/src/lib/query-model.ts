import {
  type DecoratorContext,
  type Model,
  type Program,
  validateDecoratorUniqueOnNode,
} from "@typespec/compiler";
import { useStateSet } from "@typespec/compiler/utils";
import { GraphQLKeys, NAMESPACE } from "../lib.js";

// This will set the namespace for decorators implemented in this file
export const namespace = NAMESPACE;

const [getUseAsQueryState, setUseAsQueryState] = useStateSet<Model>(
  GraphQLKeys.useAsQuery
);

/**
 * Marks a model to be used as a custom query type.
 */
export const $useAsQuery = (context: DecoratorContext, target: Model) => {
  validateDecoratorUniqueOnNode(context, target, $useAsQuery);
  setUseAsQueryState(context.program, target);
};

/**
 * Checks if a model is marked to be used as a custom query type.
 *
 * @param program The TypeSpec program
 * @param model The model to check
 * @returns True if the model is marked as a custom query model
 */
export function isCustomQueryModel(program: Program, model: Model): boolean {
  return !!getUseAsQueryState(program, model);
}
