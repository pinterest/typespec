import {
  type Type,
  type Scalar,
  type ModelProperty,
  getEncode,
  isUnknownType,
} from "@typespec/compiler";
import { type Children, useContext } from "@alloy-js/core";
import { useTsp } from "@typespec/emitter-framework";
import { GraphQLTypeResolutionContext, useGraphQLSchema } from "../../context/index.js";
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
  /** Whether this type was marked nullable (from property-level tracking) */
  isNullable?: boolean;
  /** Whether this property's array elements were originally T | null (from property-level tracking) */
  hasNullableElements?: boolean;
  /** The property or parameter that contains the type (for @encode checking) */
  targetType?: Type;
  key?: string;
  children: (typeInfo: GraphQLTypeInfo) => Children;
}

/**
 * Resolves a TypeSpec type to GraphQL type information.
 *
 * Follows the emitter framework's TypeExpression component pattern: a single
 * component that encapsulates type resolution logic, using context hooks for
 * program/typekit access and Typekit predicates for type narrowing.
 *
 * Uses render props (children function) because GraphQL SDL rendering components
 * (`gql.Field`, `gql.InputField`) consume structured data, not raw type strings.
 *
 * Nullability comes from two sources:
 * 1. Property-level: `isNullable` prop, set by the Field component when the
 *    mutation engine marked the property as nullable (for inline T | null unions).
 * 2. Type-level: `isNullable(program, type)` state map check, used for named
 *    multi-variant unions (Cat | Dog | null) where the engine creates a new
 *    unique union object.
 */
export function GraphQLTypeExpression(props: GraphQLTypeExpressionProps) {
  const { $, program } = useTsp();
  const { modelVariants } = useGraphQLSchema();
  const resolutionContext = useContext(GraphQLTypeResolutionContext);
  const mode = resolutionContext?.mode ?? "output";

  // Nullability from property-level tracking (inline T | null) or
  // type-level state map (named multi-variant unions with null stripped).
  // See nullable.ts for the full architectural explanation.
  const nullable = props.isNullable || isNullable(program, props.type);

  // GraphQL non-null rules:
  // - Output fields: non-null unless optional (?) or nullable (| null)
  // - Input fields: always non-null unless nullable (| null); optionality is
  //   expressed via default values, not nullability
  const isNonNull = nullable ? false : mode === "input" || !props.isOptional;

  // Unwrap inline T | null unions that haven't been processed by the mutation engine.
  // This handles cases where the type reaches us still as a union (e.g., array elements
  // like Array<string | null>, or operation parameters).
  if ($.union.is(props.type)) {
    const innerType = unwrapNullableUnion(props.type);
    if (innerType) {
      return (
        <GraphQLTypeExpression
          type={innerType}
          isOptional={props.isOptional}
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

  // Arrays — recurse for element type
  if ($.array.is(props.type)) {
    const elementType = $.array.getElementType(props.type);
    // Check if the element type is nullable from three sources:
    // 1. Property-level: hasNullableElements prop (mutation engine detected Array<T | null>
    //    and marked the property before the union was replaced with the inner type)
    // 2. Type-level: isNullable state map on the element type itself
    // 3. Inline union: element type is still a T | null union (not yet processed)
    const elementIsNullable =
      props.hasNullableElements ||
      isNullable(program, elementType) ||
      ($.union.is(elementType) && unwrapNullableUnion(elementType) !== undefined);

    return (
      <GraphQLTypeExpression
        type={elementType}
        isOptional={false}
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

  // Resolve base type name
  const typeName = resolveBaseTypeName();

  return props.children({
    typeName,
    isList: false,
    isNonNull,
    itemNonNull: false,
  });

  /**
   * Resolve the base type name using Typekit predicates for type narrowing.
   */
  function resolveBaseTypeName(): string {
    const type = props.type;

    // Intrinsic unknown
    if (isUnknownType(type)) {
      return "Unknown";
    }

    // Scalars
    if ($.scalar.is(type)) {
      const builtinName = getGraphQLBuiltinName(program, type);
      if (builtinName) return builtinName;

      // Standard library scalars with encoding-specific mappings
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

    // Models — check whether "Input" suffix is needed
    if ($.model.is(type)) {
      // Name-based lookup: modelVariants maps are keyed by name because both
      // input and output variants share the same source model identity — the
      // distinction is purely nominal at the GraphQL output level.
      const hasOutputVariant = modelVariants.outputModels.has(type.name);
      const hasInputVariant = modelVariants.inputModels.has(type.name);

      if (mode === "input" && hasOutputVariant && hasInputVariant) {
        return `${type.name}Input`;
      }
      return type.name;
    }

    // Enums
    if ($.enum.is(type)) {
      return type.name;
    }

    // Unions
    if ($.union.is(type)) {
      return getUnionName(type, program);
    }

    throw new Error(
      `Unexpected type kind "${type.kind}" in resolveBaseTypeName. ` +
        `This is a bug in the GraphQL emitter.`,
    );
  }
}
