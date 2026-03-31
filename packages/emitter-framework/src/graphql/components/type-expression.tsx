import type { IntrinsicType, Scalar, Type } from "@typespec/compiler";
import type { Typekit } from "@typespec/compiler/typekit";
import type { TypeReference } from "@alloy-js/graphql";
import { Experimental_OverridableComponent } from "../../core/components/overrides/component-overrides.jsx";
import { useTsp } from "../../core/context/tsp-context.js";
import { reportGraphqlDiagnostic } from "../lib.js";

export interface TypeExpressionProps {
  type: Type;
}

export function TypeExpression(props: TypeExpressionProps) {
  const { $ } = useTsp();
  const type = props.type;

  return (
    <Experimental_OverridableComponent reference type={type}>
      {() => {
        switch (type.kind) {
          case "Scalar":
          case "Intrinsic":
            return <>{getScalarIntrinsicExpression($, type)}</>;
          case "Model":
            if ($.array.is(type)) {
              const elementType = type.indexer!.value;
              return <TypeExpression type={elementType} />;
            }
            if ($.record.is(type)) {
              reportGraphqlDiagnostic($.program, {
                code: "graphql-unsupported-type",
                target: type,
              });
              return <>String</>;
            }
            return <>{type.name}</>;
          case "Enum":
            return <>{type.name}</>;
          case "Union":
            return <>{type.name}</>;
          case "UnionVariant":
            return <TypeExpression type={type.type} />;
          case "ModelProperty":
            return <TypeExpression type={type.type} />;
          default:
            reportGraphqlDiagnostic($.program, {
              code: "graphql-unsupported-type",
              target: type,
            });
            return <>String</>;
        }
      }}
    </Experimental_OverridableComponent>
  );
}

const intrinsicNameToGraphQLType = new Map<string, string | null>([
  // Core types
  ["string", "String"],
  ["boolean", "Boolean"],
  ["null", null], // Not representable in GraphQL
  ["void", null], // Not representable in GraphQL
  ["never", null], // Not representable in GraphQL
  ["unknown", null], // Not representable in GraphQL
  ["bytes", "String"], // Base64 encoded

  // Numeric types - GraphQL Int is 32-bit signed
  ["numeric", "Int"], // Abstract parent type
  ["integer", "Int"], // Abstract parent type
  ["float", "Float"],
  ["decimal", "Float"], // No decimal in GraphQL
  ["decimal128", "Float"], // No decimal in GraphQL
  ["int64", "String"], // Too large for GraphQL Int
  ["int32", "Int"],
  ["int16", "Int"],
  ["int8", "Int"],
  ["safeint", "Int"],
  ["uint64", "String"], // Too large for GraphQL Int
  ["uint32", "Int"], // Borderline, keep as Int
  ["uint16", "Int"],
  ["uint8", "Int"],
  ["float32", "Float"],
  ["float64", "Float"],

  // Date and time types - custom scalars could override
  ["plainDate", "String"],
  ["plainTime", "String"],
  ["utcDateTime", "String"],
  ["offsetDateTime", "String"],
  ["duration", "String"],

  // String types
  ["url", "String"],
]);

function getScalarIntrinsicExpression($: Typekit, type: Scalar | IntrinsicType): string | null {
  let intrinsicName: string;
  if ($.scalar.is(type)) {
    intrinsicName = $.scalar.getStdBase(type)?.name ?? "";
  } else {
    intrinsicName = type.name;
  }

  const gqlType = intrinsicNameToGraphQLType.get(intrinsicName);

  if (gqlType === undefined) {
    reportGraphqlDiagnostic($.program, { code: "graphql-unsupported-scalar", target: type });
    return "String";
  }

  if (gqlType === null) {
    reportGraphqlDiagnostic($.program, { code: "graphql-unsupported-type", target: type });
    return null;
  }

  return gqlType;
}

/**
 * Returns a GraphQL TypeReference for use in Field/InputField type props.
 */
export function getTypeReference($: Typekit, type: Type): TypeReference {
  switch (type.kind) {
    case "Scalar":
    case "Intrinsic": {
      const gqlType = getScalarIntrinsicExpression($, type);
      return gqlType ?? "String";
    }
    case "Model":
      if ($.array.is(type)) {
        const elementType = type.indexer!.value;
        return { kind: "list", ofType: getTypeReference($, elementType) };
      }
      if ($.record.is(type)) {
        reportGraphqlDiagnostic($.program, {
          code: "graphql-unsupported-type",
          target: type,
        });
        return "String";
      }
      return type.name!;
    case "Enum":
      return type.name!;
    case "Union":
      return type.name!;
    case "UnionVariant":
      return getTypeReference($, type.type);
    case "ModelProperty":
      return getTypeReference($, type.type);
    default:
      reportGraphqlDiagnostic($.program, {
        code: "graphql-unsupported-type",
        target: type,
      });
      return "String";
  }
}

export function isDeclaration($: Typekit, type: Type): boolean {
  switch (type.kind) {
    case "Model":
      if ($.array.is(type) || $.record.is(type)) {
        return false;
      }
      return Boolean(type.name);
    case "Enum":
      return true;
    case "Union":
      return Boolean(type.name);
    default:
      return false;
  }
}
