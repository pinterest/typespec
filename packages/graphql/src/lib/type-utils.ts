import {
  type ArrayModelType,
  type Enum,
  getDoc,
  getTypeName,
  type IndeterminateEntity,
  isNeverType,
  isTemplateInstance,
  type Model,
  type Program,
  type RecordModelType,
  type Scalar,
  type Type,
  type Union,
  type Value,
  walkPropertiesInherited,
} from "@typespec/compiler";
import {
  type AliasStatementNode,
  type IdentifierNode,
  type ModelPropertyNode,
  type ModelStatementNode,
  type Node,
  SyntaxKind,
  type UnionStatementNode,
} from "@typespec/compiler/ast";
import { camelCase, constantCase, pascalCase, split, splitSeparateNumbers } from "change-case";
import { reportDiagnostic } from "../lib.js";

/**
 * Check if a union represents a nullable type (e.g., string | null).
 * @returns The non-null variant type if this is a nullable union, otherwise undefined.
 */
export function getNullableUnionType(union: Union): Type | undefined {
  if (union.variants.size !== 2) return undefined;

  const variants = Array.from(union.variants.values());
  const nullVariant = variants.find(
    (v) => v.type.kind === "Intrinsic" && v.type.name === "null"
  );

  if (!nullVariant) return undefined;

  return variants.find((v) => v !== nullVariant)?.type;
}

/** Generate a GraphQL type name for a templated model (e.g., `ListOfString`). */
export function getTemplatedModelName(model: Model): string {
  const name = getTypeName(model, {});
  const baseName = toTypeName(name.replace(/<[^>]*>/g, ""));
  const templateString = getTemplateString(model);
  return templateString ? `${baseName}Of${templateString}` : baseName;
}

function splitWithAcronyms(
  split: (name: string) => string[],
  skipStart: boolean,
  name: string,
): string[] {
  const parts = split(name);

  if (name === name.toUpperCase()) {
    return parts;
  }
  // Preserve strings of capital letters, e.g. "API" should be treated as three words ["A", "P", "I"] instead of one word
  return parts.flatMap((part, index) => {
    const isFirst = index === 0;
    return !(skipStart && isFirst) && part.match(/^[A-Z]+$/) ? part.split("") : part;
  });
}

/** Convert a name to PascalCase for GraphQL type names. */
export function toTypeName(name: string): string {
  const sanitized = sanitizeNameForGraphQL(getNameWithoutNamespace(name));
  // Preserve all-caps names (acronyms like API, HTTP, URL)
  if (/^[A-Z]+$/.test(sanitized)) {
    return sanitized;
  }
  return pascalCase(sanitized, {
    split: splitWithAcronyms.bind(null, split, false),
  });
}

/**
 * Names reserved by the GraphQL specification that cannot be used as identifiers.
 * - `true`, `false`, `null` are keyword literals in GraphQL
 * - Names starting with `__` are reserved for the introspection system
 */
const GRAPHQL_RESERVED_NAMES = new Set(["true", "false", "null"]);

/** Sanitize a name to be a valid GraphQL identifier. */
export function sanitizeNameForGraphQL(name: string, prefix: string = ""): string {
  name = name.replace("[]", "Array");
  name = name.replaceAll(/\W/g, "_");
  if (!/^[_a-zA-Z]/.test(name)) {
    name = `${prefix}_${name}`;
  }
  // Guard against GraphQL reserved keywords
  if (GRAPHQL_RESERVED_NAMES.has(name.toLowerCase())) {
    name = `${prefix || "_"}${name}`;
  }
  return name;
}

/**
 * Convert a numeric enum value to a valid GraphQL identifier.
 * Examples:
 * - 0 → _0
 * - 0.25 → _0_25
 * - -1 → _NEGATIVE_1
 */
export function convertNumericEnumValue(value: number): string {
  if (value < 0) {
    // Negative numbers: -1 → _NEGATIVE_1, -2.5 → _NEGATIVE_2_5
    return `_NEGATIVE_${Math.abs(value).toString().replace(/\./g, "_")}`;
  } else {
    // Non-negative numbers: 0 → _0, 0.25 → _0_25
    return `_${value.toString().replace(/\./g, "_")}`;
  }
}

/** Convert a name to CONSTANT_CASE for GraphQL enum members. */
export function toEnumMemberName(enumName: string, name: string) {
  return constantCase(sanitizeNameForGraphQL(name, enumName), {
    split: splitSeparateNumbers,
    prefixCharacters: "_",
  });
}

/** Convert a name to camelCase for GraphQL field names. */
export function toFieldName(name: string): string {
  return camelCase(sanitizeNameForGraphQL(name), {
    prefixCharacters: "_",
    split: splitWithAcronyms.bind(null, split, true),
  });
}

function getNameWithoutNamespace(name: string): string {
  const parts = name.trim().split(".");
  return parts[parts.length - 1];
}

/** Generate a GraphQL type name for a union, including anonymous unions. */
export function getUnionName(union: Union, program: Program): string {
  // SyntaxKind.UnionExpression: Foo | Bar
  // SyntaxKind.UnionStatement: union FooBarUnion { Foo, Bar }
  // SyntaxKind.TypeReference: FooBarUnion

  const templateString = getTemplateString(union) ? "Of" + getTemplateString(union) : "";

  switch (true) {
    case !!union.name:
      // The union is not anonymous, use its name
      return union.name;

    case isReturnType(union):
      // The union is a return type, use the name of the operation
      // e.g. op getBaz(): Foo | Bar => GetBazUnion
      return `${getUnionNameForOperation(program, union)}${templateString}Union`;

    case isModelProperty(union):
      // The union is a model property, name it based on the model + property
      // e.g. model Foo { bar: Bar | Baz } => FooBarUnion
      const modelProperty = getModelProperty(union);
      const propName = toTypeName(getNameForNode(modelProperty!));
      const unionModel = union.node?.parent?.parent as ModelStatementNode;
      const modelName = unionModel ? getNameForNode(unionModel) : "";
      return `${modelName}${propName}${templateString}Union`;

    case isAliased(union):
      // The union is an alias, name it based on the alias name
      // e.g. alias Baz = Foo<string> | Bar => Baz
      const alias = getAlias(union);
      const aliasName = getNameForNode(alias!);
      return `${aliasName}${templateString}`;

    default:
      reportDiagnostic(program, {
        code: "unrecognized-union",
        target: union,
      });
      return "UnknownUnion";
  }
}

function isNamedType(type: Type | Value | IndeterminateEntity): type is { name: string } & Type {
  return "name" in type && typeof (type as { name: unknown }).name === "string";
}

function isAliased(union: Union): boolean {
  return union.node?.parent?.kind === SyntaxKind.AliasStatement;
}

function getAlias(union: Union): AliasStatementNode | undefined {
  return isAliased(union) ? (union.node?.parent as AliasStatementNode) : undefined;
}

function isModelProperty(union: Union): boolean {
  return union.node?.parent?.kind === SyntaxKind.ModelProperty;
}

function getModelProperty(union: Union): ModelPropertyNode | undefined {
  return isModelProperty(union) ? (union.node?.parent as ModelPropertyNode) : undefined;
}

function isReturnType(type: Type): boolean {
  return !!(
    type.node &&
    type.node.parent?.kind === SyntaxKind.OperationSignatureDeclaration &&
    type.node.parent?.parent?.kind === SyntaxKind.OperationStatement
  );
}

type NamedNode = Node & { id: IdentifierNode };

function getNameForNode(node: NamedNode): string {
  return "id" in node && node.id?.kind === SyntaxKind.Identifier ? node.id.sv : "";
}

function getUnionNameForOperation(program: Program, union: Union): string {
  const operationNode = (union.node as UnionStatementNode).parent?.parent;
  const operation = program.checker.getTypeForNode(operationNode!);

  return toTypeName(getTypeName(operation));
}

/** Convert a namespaced name to a single name by replacing dots with underscores. */
export function getSingleNameWithNamespace(name: string): string {
  return name.trim().replace(/\./g, "_");
}

/**
 * Check if a model is an array type.
 */
export function isArray(model: Model): model is ArrayModelType {
  return Boolean(model.indexer && model.indexer.key.name === "integer");
}

/**
 * Check if a model is a record/map type.
 */
export function isRecordType(type: Model): type is RecordModelType {
  return Boolean(type.indexer && type.indexer.key.name === "string");
}

/** Check if a model is an array of scalars or enums. */
export function isScalarOrEnumArray(type: Model): type is ArrayModelType {
  return (
    isArray(type) && (type.indexer?.value.kind === "Scalar" || type.indexer?.value.kind === "Enum")
  );
}

/** Check if a model is an array of unions. */
export function isUnionArray(type: Model): type is ArrayModelType {
  return isArray(type) && type.indexer?.value.kind === "Union";
}

/** Extract the element type from an array model, or return the model itself. */
export function unwrapModel(model: ArrayModelType): Model | Scalar | Enum | Union;
export function unwrapModel(model: Exclude<Model, ArrayModelType>): Model;
export function unwrapModel(model: Model): Model | Scalar | Enum | Union {
  if (!isArray(model)) {
    return model;
  }

  if (model.indexer?.value.kind) {
    if (["Model", "Scalar", "Enum", "Union"].includes(model.indexer.value.kind)) {
      return model.indexer.value as Model | Scalar | Enum | Union;
    }
    throw new Error(`Unexpected array type: ${model.indexer.value.kind}`);
  }
  return model;
}

/** Unwrap array types to get the inner element type. */
export function unwrapType(type: Model): Model | Scalar | Enum | Union;
export function unwrapType(type: Type): Type;
export function unwrapType(type: Type): Type {
  if (type.kind === "Model") {
    return unwrapModel(type);
  }
  return type;
}

/** Get the GraphQL description for a type from its doc comments. */
export function getGraphQLDoc(program: Program, type: Type): string | undefined {
  // GraphQL uses CommonMark for descriptions
  // https://spec.graphql.org/October2021/#sec-Descriptions
  return getDoc(program, type);
}

/** Generate a string representation of template arguments (e.g., `StringAndInt`). */
export function getTemplateString(
  type: Type,
  options: { conjunction: string } = { conjunction: "And" },
): string {
  if (isTemplateInstance(type)) {
    const args = type.templateMapper.args.filter(isNamedType).map((arg) => getTypeName(arg));
    return getTemplateStringInternal(args, options);
  }
  return "";
}

function getTemplateStringInternal(
  args: string[],
  options: { conjunction: string } = { conjunction: "And" },
): string {
  return args.length > 0 ? args.map(toTypeName).join(options.conjunction) : "";
}

/** Check if a model should be emitted as a GraphQL object type (not an array, record, or never). */
export function isTrueModel(model: Model): boolean {
  /* eslint-disable no-fallthrough */
  switch (true) {
    // A scalar array is represented as a model with an indexer
    // and a scalar type. We don't want to emit this as a model.
    case isScalarOrEnumArray(model):
    // A union array is represented as a model with an indexer
    // and a union type. We don't want to emit this as a model.
    case isUnionArray(model):
    case isNeverType(model):
    // If the model is purely a record, we don't want to emit it as a model.
    // Instead, we will need to create a scalar
    case isRecordType(model) && [...walkPropertiesInherited(model)].length === 0:
      return false;
    default:
      return true;
  }
  /* eslint-enable no-fallthrough */
}
