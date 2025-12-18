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
import { GraphQLScalarType } from "graphql";

export const ANY_SCALAR = new GraphQLScalarType({
  name: "Any",
});

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
  const result = split(name);

  if (name === name.toUpperCase()) {
    return result;
  }
  // Preserve strings of capital letters, e.g. "API" should be treated as three words ["A", "P", "I"] instead of one word
  return result.flatMap((part) => {
    const result = !skipStart && part.match(/^[A-Z]+$/) ? part.split("") : part;
    skipStart = false;
    return result;
  });
}

export function toTypeName(name: string): string {
  return pascalCase(sanitizeNameForGraphQL(getNameWithoutNamespace(name)), {
    split: splitWithAcronyms.bind(null, split, false),
  });
}

export function sanitizeNameForGraphQL(name: string, prefix: string = ""): string {
  name = name.replace("[]", "Array");
  name = name.replaceAll(/\W/g, "_");
  if (!name.match("^[_a-zA-Z]")) {
    name = `${prefix}_${name}`;
  }
  return name;
}

export function toEnumMemberName(enumName: string, name: string) {
  return constantCase(sanitizeNameForGraphQL(name, enumName), {
    split: splitSeparateNumbers,
    prefixCharacters: "_",
  });
}

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
      throw new Error("Unrecognized union construction.");
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

export function getSingleNameWithNamespace(name: string): string {
  return name.trim().replace(/\./g, "_");
}

// TODO: To replace this with the type-utils isArrayModelType function
export function isArray(model: Model): model is ArrayModelType {
  return Boolean(model.indexer && model.indexer.key.name === "integer");
}

// TODO: To replace this with the type-utils isRecordModelType function
// The type-utils function takes an used program as an argument
// and this function is used in the selector which does not have access to
// the program
export function isRecordType(type: Model): type is RecordModelType {
  return Boolean(type.indexer && type.indexer.key.name === "string");
}

export function isScalarOrEnumArray(type: Model): type is ArrayModelType {
  return (
    isArray(type) && (type.indexer?.value.kind === "Scalar" || type.indexer?.value.kind === "Enum")
  );
}

export function isUnionArray(type: Model): type is ArrayModelType {
  return isArray(type) && type.indexer?.value.kind === "Union";
}

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

export function unwrapType(type: Model): Model | Scalar | Enum | Union;
export function unwrapType(type: Type): Type;
export function unwrapType(type: Type): Type {
  if (type.kind === "Model") {
    return unwrapModel(type);
  }
  return type;
}

export function getGraphQLDoc(program: Program, type: Type): string | undefined {
  // GraphQL uses CommonMark for descriptions
  // https://spec.graphql.org/October2021/#sec-Descriptions
  let doc = getDoc(program, type);
  if (!program.compilerOptions.miscOptions?.isTest) {
    doc =
      (doc || "") +
      `

Created from ${type.kind}
\`\`\`
${getTypeName(type)}
\`\`\`
  `;
  }

  if (doc) {
    doc = doc.trim();
    doc.replaceAll("\\n", "\n");
  }
  return doc;
}

export function getTemplateString(
  type: Type,
  options: { conjunction: string; prefix: string } = { conjunction: "And", prefix: "" },
): string {
  if (isTemplateInstance(type)) {
    const args = type.templateMapper.args.filter(isNamedType).map((arg) => getTypeName(arg));
    return getTemplateStringInternal(args, options);
  }
  return "";
}

function getTemplateStringInternal(
  args: string[],
  options: { conjunction: string; prefix: string } = { conjunction: "And", prefix: "" },
): string {
  return args.length > 0
    ? options.prefix + toTypeName(args.map(toTypeName).join(options.conjunction))
    : "";
}

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
