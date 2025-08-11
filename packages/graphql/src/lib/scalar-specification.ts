import {
  type DecoratorContext,
  type Program,
  type Scalar,
  validateDecoratorUniqueOnNode,
} from "@typespec/compiler";
import { useStateMap } from "@typespec/compiler/utils";
import { GraphQLKeys, NAMESPACE } from "../lib.js";

// This will set the namespace for decorators implemented in this file
export const namespace = NAMESPACE;

const [getSpecifiedByUrl, setSpecifiedByUrl] = useStateMap<Scalar, string>(
  GraphQLKeys.specifiedBy
);

/**
 * Sets the specification URL for a custom scalar type.
 */
export const $specifiedBy = (
  context: DecoratorContext,
  target: Scalar,
  url: string
) => {
  validateDecoratorUniqueOnNode(context, target, $specifiedBy);
  
  setSpecifiedByUrl(context.program, target, url);
};

/**
 * Gets the specification URL for a custom scalar type.
 *
 * @param program The TypeSpec program
 * @param scalar The scalar to get the specification for
 * @returns The specification URL or undefined if not specified
 */
export function getSpecificationUrl(program: Program, scalar: Scalar): string | undefined {
  return getSpecifiedByUrl(program, scalar);
}
