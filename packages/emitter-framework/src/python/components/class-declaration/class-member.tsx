import { typingModule } from "#python/builtins.js";
import { type Children } from "@alloy-js/core";
import * as py from "@alloy-js/python";
import { isNeverType, type ModelProperty, type Operation } from "@typespec/compiler";
import { useTsp } from "../../../core/context/tsp-context.js";
import { efRefkey } from "../../utils/refkey.js";
import { Atom } from "../atom/atom.jsx";
import { TypeExpression } from "../type-expression/type-expression.jsx";
import { ClassMethod } from "./class-method.jsx";

export interface ClassMemberProps {
  type: ModelProperty | Operation;
  doc?: Children;
  optional?: boolean;
  methodType?: "method" | "class" | "static";
  abstract?: boolean;
}

/**
 * Builds the primitive initializer from the default value.
 * @param defaultValue - The default value.
 * @returns The primitive initializer.
 */
function buildPrimitiveInitializerFromDefault(
  defaultValue: any,
  propertyType: any,
  $: ReturnType<typeof useTsp>["$"],
): Children | undefined {
  if (!defaultValue) return undefined;
  const valueKind = (defaultValue as any).valueKind ?? (defaultValue as any).kind;
  switch (valueKind) {
    case "StringValue":
    case "BooleanValue":
    case "NullValue":
      return <py.Atom jsValue={defaultValue.value} />;
    case "NumericValue": {
      // The Atom component converts NumericValue via asNumber(), which normalizes 100.0 to 100.
      // Atom also has no access to the field type (float vs int), so it can't decide when to keep a trailing .0.
      // Here we do have the propertyType so, for float/decimal fields, we render a raw value and append ".0"
      // when needed. For non-float fields, default to a plain numeric Atom.

      // Unwrap potential numeric wrapper shape and preserve float formatting
      let raw: any = (defaultValue as any).value;
      // Example: value is { value: "100", isInteger: true }
      if (raw && typeof raw === "object" && "value" in raw) raw = raw.value;

      // Float-ish property types should render as raw text with .0 if integral
      if ($.scalar.is(propertyType)) {
        const base = $.scalar.getStdBase(propertyType)?.name;
        const isFloatish =
          base === "float" ||
          base === "float32" ||
          base === "float64" ||
          base === "decimal" ||
          base === "decimal128";
        if (isFloatish) {
          // Example: raw is 42.5 or 42.0
          const s = typeof raw === "string" ? raw : String(raw);
          const needsDotZero = !s.includes(".") && !s.toLowerCase().includes("e");
          return <>{needsDotZero ? `${s}.0` : s}</>;
        }
      }

      // Otherwise output as a number atom
      return <py.Atom jsValue={Number(raw)} />;
    }
    case "ArrayValue":
      return <Atom value={defaultValue} />;
    default:
      return undefined;
  }
}

/**
 * Builds the type node for the property. This is used to handle union of string literals and union variant references.
 * If the type is a union of string literals, it returns a Literal["a", "b"] type.
 * If the type is a union variant reference, it returns a Literal[Color.MEMBER] type.
 * @param unpackedType - The unpacked type.
 * @returns The type node, or undefined if the type is not a union of string literals or union variant reference.
 */
function buildTypeNodeForProperty(unpackedType: any): Children | undefined {
  // Union variant reference - Literal[Color.MEMBER]
  if (unpackedType && unpackedType.kind === "UnionVariant" && unpackedType.union) {
    const unionType = unpackedType.union;
    const variantValue = unpackedType.type;
    const enumMemberName =
      variantValue && typeof variantValue.value === "string"
        ? variantValue.value
        : String(variantValue?.value ?? "");
    return (
      <>
        {typingModule["."]["Literal"]}[{efRefkey(unionType)}.{enumMemberName}]
      </>
    );
  }

  // Union of string literals - Literal["a", "b"]
  if (
    unpackedType &&
    unpackedType.kind === "Union" &&
    Array.isArray((unpackedType as any).options)
  ) {
    const opts: any[] = (unpackedType as any).options;
    const allStringLiterals = opts.every((opt) => opt && opt.kind === "String");
    if (allStringLiterals) {
      const literalValues = opts.map((opt) => JSON.stringify(opt.value)).join(", ");
      return <>{typingModule["."]["Literal"]}[{literalValues}]</>;
    }
  }

  return undefined;
}

/**
 * Creates the class member for the property.
 * @param props - The props for the class member.
 * @returns The class member.
 */
export function ClassMember(props: ClassMemberProps) {
  const { $ } = useTsp();
  const namer = py.usePythonNamePolicy();
  const name = namer.getName(props.type.name, "class-member");
  const doc = props.doc ?? $.type.getDoc(props.type);

  if ($.modelProperty.is(props.type)) {
    // Never type is not supported
    if (isNeverType(props.type.type)) {
      return null;
    }

    const unpackedType = props.type.type as any;
    const isOptional = props.optional ?? props.type.optional ?? false;
    const defaultValue: any = (props.type as any).defaultValue;
    const literalTypeNode = buildTypeNodeForProperty(unpackedType);
    const initializer = buildPrimitiveInitializerFromDefault(defaultValue, unpackedType, $);
    const typeNode: Children = literalTypeNode ?? <TypeExpression type={unpackedType} />;

    const interfaceMemberProps = {
      doc,
      name,
      optional: isOptional,
      type: typeNode,
      ...(initializer ? { initializer } : {}),
      omitNone: !isOptional,
    };
    return <py.VariableDeclaration {...interfaceMemberProps} />;
  }

  if ($.operation.is(props.type)) {
    return (
      <ClassMethod
        type={props.type}
        doc={doc}
        methodType={props.methodType}
        abstract={props.abstract}
      />
    );
  }
}
