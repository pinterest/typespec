import {
  type Type,
  type Scalar,
  type ModelProperty,
  getEncode,
  isUnknownType,
} from "@typespec/compiler";
import { type Children } from "@alloy-js/core";
import { useTsp } from "@typespec/emitter-framework";
import { useGraphQLSchema } from "../../context/index.js";
import { isNullable } from "../../lib/nullable.js";
import { unwrapNullableUnion, getUnionName } from "../../lib/type-utils.js";
import { getGraphQLBuiltinName, getScalarMapping } from "../../lib/scalar-mappings.js";

/**
 * Information about a resolved GraphQL type
 */
export interface GraphQLTypeInfo {
  /** The base type name (without wrappers) */
  typeName: string;
  /** Whether this is a list type */
  isList: boolean;
  /** Whether the field itself is non-null */
  isNonNull: boolean;
  /** Whether list items are non-null (only meaningful if isList is true) */
  itemNonNull: boolean;
}

export interface GraphQLTypeExpressionProps {
  type: Type;
  isOptional: boolean;
  /** Whether this type is in an input position (operation parameter or input model field) */
  isInput: boolean;
  /** Whether this type was marked nullable (from property-level tracking) */
  isNullable?: boolean;
  /** Whether this property's array elements were originally T | null (from property-level tracking) */
  hasNullableElements?: boolean;
  /** The property or parameter that contains the type (for @encode checking) */
  targetType?: Type;
  children: (typeInfo: GraphQLTypeInfo) => Children;
}

export function GraphQLTypeExpression(props: GraphQLTypeExpressionProps) {
  const { $, program } = useTsp();
  const { modelVariants } = useGraphQLSchema();

  const nullable = props.isNullable || isNullable(props.type);

  // Input fields are non-null unless nullable; optionality is expressed via
  // default values. Output fields are non-null unless optional or nullable.
  const isNonNull = nullable ? false : props.isInput || !props.isOptional;

  // Unwrap T | null unions the mutation engine didn't process (e.g., array
  // elements, operation parameters that arrive here still wrapped).
  if ($.union.is(props.type)) {
    const innerType = unwrapNullableUnion(props.type);
    if (innerType) {
      return (
        <GraphQLTypeExpression
          type={innerType}
          isOptional={props.isOptional}
          isInput={props.isInput}
          isNullable={true}
          targetType={props.targetType}
        >
          {(innerInfo) =>
            props.children({
              ...innerInfo,
              isNonNull: false,
            })
          }
        </GraphQLTypeExpression>
      );
    }
  }

  if ($.array.is(props.type)) {
    const elementType = $.array.getElementType(props.type);
    // Element nullability: from mutation engine property-level tracking, from the
    // element type's own state map, or from an inline T | null union still present.
    const elementIsNullable =
      props.hasNullableElements ||
      isNullable(elementType) ||
      ($.union.is(elementType) && unwrapNullableUnion(elementType) !== undefined);

    return (
      <GraphQLTypeExpression
        type={elementType}
        isOptional={false}
        isInput={props.isInput}
        isNullable={elementIsNullable}
        targetType={props.targetType}
      >
        {(elementInfo) =>
          props.children({
            typeName: elementInfo.typeName,
            isList: true,
            isNonNull,
            itemNonNull: !elementIsNullable,
          })
        }
      </GraphQLTypeExpression>
    );
  }

  const typeName = resolveBaseTypeName();

  return props.children({
    typeName,
    isList: false,
    isNonNull,
    itemNonNull: false,
  });

  function resolveBaseTypeName(): string {
    const type = props.type;

    if (isUnknownType(type)) {
      return "Unknown";
    }

    if ($.scalar.is(type)) {
      const builtinName = getGraphQLBuiltinName(program, type);
      if (builtinName) return builtinName;

      // Std scalars with encoding-specific mappings (e.g., bytes + base64 -> Bytes)
      if (program.checker.isStdType(type)) {
        if (
          props.targetType &&
          ($.scalar.is(props.targetType) || props.targetType.kind === "ModelProperty")
        ) {
          const encodeData = getEncode(
            program,
            props.targetType as Scalar | ModelProperty,
          );
          const mapping = getScalarMapping(program, type, encodeData?.encoding);
          if (mapping) return mapping.graphqlName;
        }

        const mapping = getScalarMapping(program, type);
        if (mapping) return mapping.graphqlName;
      }

      return type.name;
    }

    if ($.model.is(type)) {
      // Both input and output variants share the same source model identity,
      // so we use name-based lookup to determine if both variants exist.
      const hasOutputVariant = modelVariants.outputModels.has(type.name);
      const hasInputVariant = modelVariants.inputModels.has(type.name);

      if (props.isInput && hasOutputVariant && hasInputVariant) {
        return `${type.name}Input`;
      }
      return type.name;
    }

    if ($.enum.is(type)) {
      return type.name;
    }

    if ($.union.is(type)) {
      return getUnionName(type, program);
    }

    throw new Error(
      `Unexpected type kind "${type.kind}" in resolveBaseTypeName. ` +
        `This is a bug in the GraphQL emitter.`,
    );
  }
}
