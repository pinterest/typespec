import type {
  EmitContext,
  Enum,
  Model,
  ModelProperty,
  Namespace,
  Operation,
  Program,
  Type,
} from "@typespec/compiler";
import { $ } from "@typespec/compiler/typekit";
import { useStateMap } from "@typespec/compiler/utils";
import {
  GraphQLEnumType,
  GraphQLID,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLObjectType,
  GraphQLString,
  type GraphQLFieldConfigMap,
  type GraphQLOutputType,
} from "graphql";
import { mapScalarToGraphQL } from "./lib/scalars.js";

// State for the per-program GraphQL type name registry
const graphQLTypeNameRegistry = new WeakMap<Program, Map<string, any>>();

function getOrCreateTypeNameRegistry(program: Program): Map<string, any> {
  let registry = graphQLTypeNameRegistry.get(program);
  if (!registry) {
    registry = new Map<string, any>();
    graphQLTypeNameRegistry.set(program, registry);
  }
  return registry;
}

export function resetGraphQLTypeNameRegistry(program: Program) {
  graphQLTypeNameRegistry.set(program, new Map<string, any>());
}

function reportGraphQLNameCollision(
  context: EmitContext<Program>,
  name: string,
  oldType: any,
  newType: any,
) {
  context.program.reportDiagnostic({
    code: "graphql-name-collision",
    message: `GraphQL type name collision: '${name}' is used for both '${oldType.name}' and '${newType.name}'.`,
    target: newType,
    severity: "error",
  });
}

function registerGraphQLTypeName(context: EmitContext<Program>, name: string, tspType: any) {
  const registry = getOrCreateTypeNameRegistry(context.program);
  const existing = registry.get(name);
  if (existing && existing !== tspType) {
    reportGraphQLNameCollision(context, name, existing, tspType);
    return false;
  }
  registry.set(name, tspType);
  return true;
}

// State for temporary property arrays during traversal
export const TMP_PROPS = Symbol("graphql:tmpProps");
export const GRAPHQL_META = Symbol("graphql:meta");
export const ENUM_META = Symbol("graphql:enum-meta");

export interface GraphQLModelMeta {
  typeName: string;
  fields: Record<string, { type: () => any }>;
  graphQLType?: any;
  graphQLInputType?: any;
}
export interface EnumMeta {
  typeName: string;
  graphQLEnumType: GraphQLEnumType;
}

export const [getTmpProps, setTmpProps] = useStateMap<Model, Array<{ name: string; type: any }>>(
  TMP_PROPS,
);
export const [getGraphQLMeta, setGraphQLMeta] = useStateMap<Model, GraphQLModelMeta>(GRAPHQL_META);
export const [getEnumMeta, setEnumMeta] = useStateMap<Enum, EnumMeta>(ENUM_META);

export function collectOperations(ns: Namespace): Operation[] {
  const ops: Operation[] = [];
  function visit(n: Namespace) {
    for (const op of n.operations.values()) ops.push(op);
    for (const child of n.namespaces.values()) visit(child);
  }
  visit(ns);
  return ops;
}

export function annotateEnum(context: EmitContext<any>, node: Enum) {
  // Check and register GraphQL type name for enum
  registerGraphQLTypeName(context, node.name, node);

  const values = Object.fromEntries(
    Array.from(node.members.values()).map((member: any) => [member.name, { value: member.name }]),
  );
  const meta = {
    typeName: node.name,
    graphQLEnumType: new GraphQLEnumType({
      name: node.name,
      values,
    }),
  };
  setEnumMeta(context.program, node, meta);
}

function buildModelFields(
  context: EmitContext<any>,
  node: Model,
  typeResolver: (context: EmitContext<any>, type: Type) => any,
) {
  const tmpProps = getTmpProps(context.program, node) ?? [];
  return Object.fromEntries(
    tmpProps.flatMap((prop) => {
      const type = typeResolver(context, prop.type);
      return type ? [[prop.name, { type }]] : [];
    }),
  );
}

export function annotateModel(context: EmitContext<any>, node: Model) {
  // Check and register GraphQL type name for output type
  registerGraphQLTypeName(context, node.name, node);
  // Check and register GraphQL type name for input type
  registerGraphQLTypeName(context, node.name + "Input", node);

  setTmpProps(context.program, node, []);
  let memoizedGraphQLType: any;
  let memoizedGraphQLInputType: any;
  const meta: GraphQLModelMeta = {
    typeName: node.name,
    fields: {},
    get graphQLType() {
      if (!memoizedGraphQLType) {
        memoizedGraphQLType = new GraphQLObjectType({
          name: node.name,
          fields: () => buildModelFields(context, node, getGraphQLTypeForTspType),
        });
      }
      return memoizedGraphQLType;
    },
    get graphQLInputType() {
      if (!memoizedGraphQLInputType) {
        memoizedGraphQLInputType = new GraphQLInputObjectType({
          name: node.name + "Input",
          fields: () => buildModelFields(context, node, getGraphQLInputTypeForTspType),
        });
      }
      return memoizedGraphQLInputType;
    },
  };
  setGraphQLMeta(context.program, node, meta);
}

function getArrayElementType(type: any): any | undefined {
  // Model-based array: Array<T>
  if (
    type &&
    type.name === "Array" &&
    "templateArguments" in type &&
    Array.isArray(type.templateArguments) &&
    type.templateArguments.length === 1
  ) {
    return type.templateArguments[0];
  }
  // AST-based array: { kind: "Array", elementType }
  if (type && type.kind === "Array" && "elementType" in type && type.elementType) {
    return type.elementType;
  }
  return undefined;
}

export function getGraphQLInputTypeForTspType(context: EmitContext<any>, type: Type): any {
  if (type.kind === "Model") {
    const meta = getGraphQLMeta(context.program, type as Model);
    if (!meta) return undefined;
    return meta.graphQLInputType;
  }
  // Handle enums (input enums are the same as output)
  if (type.kind === "Enum") {
    const meta = getEnumMeta(context.program, type as Enum);
    return meta?.graphQLEnumType;
  }
  // Handle arrays (both representations)
  const elementType = getArrayElementType(type);
  if (elementType) {
    const gqlElementType = getGraphQLInputTypeForTspType(context, elementType);
    return gqlElementType ? new GraphQLList(gqlElementType) : undefined;
  }
  // Handle scalars
  if (type.kind === "Scalar") {
    if (type.name === "ID") {
      return GraphQLID;
    }
    const typekit = $(context.program);
    return mapScalarToGraphQL(type as any, typekit);
  }
  return undefined;
}

export function annotateModelProperty(context: EmitContext<any>, node: ModelProperty) {
  const parentModel = node.model;
  if (!parentModel) return;
  const tmpProps = getTmpProps(context.program, parentModel) ?? [];
  tmpProps.push({ name: node.name, type: node.type });
  setTmpProps(context.program, parentModel, tmpProps);
}

export function buildQueryFields(
  context: EmitContext<any>,
  ns: Namespace,
): GraphQLFieldConfigMap<any, any> {
  const operations = collectOperations(ns);
  const queryFields: GraphQLFieldConfigMap<any, any> = {};
  for (const op of operations) {
    const returnType = getGraphQLTypeForTspType(context, op.returnType);
    if (!returnType) continue;

    // Handle arguments for operations with parameters
    const args: Record<string, any> = {};
    if (op.parameters && op.parameters.properties) {
      for (const [name, param] of Object.entries(op.parameters.properties)) {
        const inputType = getGraphQLInputTypeForTspType(context, param.type);
        if (inputType) {
          args[name] = { type: inputType };
        }
      }
    }

    queryFields[op.name] = { type: returnType, args: Object.keys(args).length ? args : undefined };
  }
  if (Object.keys(queryFields).length === 0) {
    queryFields._ = { type: GraphQLString };
  }
  return queryFields;
}

export function getGraphQLTypeForTspType(
  context: EmitContext<any>,
  type: Type,
): GraphQLOutputType | undefined {
  if (type.kind === "Model") {
    const arrayElement = getArrayElementType(type);
    if (arrayElement) {
      const elementType = getGraphQLTypeForTspType(context, arrayElement);
      return elementType ? new GraphQLList(elementType) : undefined;
    }
    const gqlMeta = getGraphQLMeta(context.program, type as Model);
    if (!gqlMeta) {
      return undefined;
    }
    return gqlMeta.graphQLType;
  }

  // Handle enums
  if (type.kind === "Enum") {
    const meta = getEnumMeta(context.program, type as Enum);
    return meta?.graphQLEnumType;
  }

  // Handle arrays (both representations)
  const elementType = getArrayElementType(type);
  if (elementType) {
    const gqlElementType = getGraphQLTypeForTspType(context, elementType);
    return gqlElementType ? new GraphQLList(gqlElementType) : undefined;
  }

  // Handle scalars
  if (type.kind === "Scalar") {
    if (type.name === "ID") {
      return GraphQLID;
    }
    const typekit = $(context.program);
    return mapScalarToGraphQL(type as any, typekit);
  }
  return undefined;
}
