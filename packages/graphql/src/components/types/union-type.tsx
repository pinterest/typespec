import { type Type, type Union, getDoc } from "@typespec/compiler";
import * as gql from "@alloy-js/graphql";
import { useTsp } from "@typespec/emitter-framework";
import { getUnionName, toTypeName } from "../../lib/type-utils.js";

export interface UnionTypeProps {
  /** The union type to render */
  type: Union;
}

/**
 * Check if a type is a scalar (built-in or custom)
 */
function isScalarType(type: Type): boolean {
  return type.kind === "Scalar" || type.kind === "Intrinsic";
}

/**
 * Renders a GraphQL union type declaration
 * Scalars are wrapped in object types since GraphQL unions can only contain object types
 * This wrapping is done by the mutation engine (see design.md)
 */
export function UnionType(props: UnionTypeProps) {
  const { program } = useTsp();
  const name = getUnionName(props.type, program);
  const doc = getDoc(program, props.type);
  const variants = Array.from(props.type.variants.values());

  // Build the union member list, using wrapper names for scalars
  // The wrapper models are created by the mutation engine
  const unionMembers = variants.map((variant) => {
    const variantName = typeof variant.name === "string" ? variant.name : String(variant.name);

    if (isScalarType(variant.type)) {
      // Reference the wrapper type for scalars (created by mutation engine)
      // Include union name to match wrapper model naming convention
      return toTypeName(name) + toTypeName(variantName) + "UnionVariant";
    } else {
      // For non-scalars, use the type name directly
      if (variant.type.kind === "Model") {
        return variant.type.name;
      } else if ("name" in variant.type && typeof variant.type.name === "string") {
        return variant.type.name;
      }
      throw new Error(
        `Unexpected union variant type kind "${variant.type.kind}" in union "${name}". ` +
        `This is a bug in the GraphQL emitter.`
      );
    }
  });

  return <gql.UnionType name={name} description={doc} members={unionMembers} />;
}
