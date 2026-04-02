import {
  isArrayModelType,
  navigateTypesInNamespace,
  type Namespace,
  type Operation,
  type Type,
} from "@typespec/compiler";

/**
 * GraphQL-specific flags for type usage tracking (input vs output).
 */
export enum GraphQLTypeUsage {
  /** Type is used as an input (operation parameter or nested within one) */
  Input = "Input",
  /** Type is used as an output (operation return type or nested within one) */
  Output = "Output",
}

export interface TypeUsageResolver {
  /** Get the set of usage flags for a type, or undefined if never referenced by an operation */
  getUsage(type: Type): Set<GraphQLTypeUsage> | undefined;
  /** Returns true if the type should not be included in the schema */
  isUnreachable(type: Type): boolean;
}

/**
 * Walk all operations in a namespace tree to determine type reachability and
 * input/output classification.
 *
 * Produces two independent results:
 * - **Reachability**: whether a type should be included in the emitted schema.
 * - **Usage**: whether a type is used as Input, Output, or both.
 *
 * When `omitUnreachableTypes` is false, all types declared in the namespace
 * are considered reachable regardless of whether an operation references them.
 */
export function resolveTypeUsage(
  root: Namespace,
  omitUnreachableTypes: boolean,
): TypeUsageResolver {
  // Two independent concerns tracked in a single walk:
  //   reachableTypes — should this type appear in the schema?
  //   usages         — is this type used as Input, Output, or both?
  const reachableTypes = new Set<Type>();
  const usages = new Map<Type, Set<GraphQLTypeUsage>>();

  addUsagesInNamespace(root, reachableTypes, usages);

  // When all declared types should be emitted, mark them reachable.
  if (!omitUnreachableTypes) {
    const markReachable = (type: Type) => {
      reachableTypes.add(type);
    };
    navigateTypesInNamespace(root, {
      model: markReachable,
      scalar: markReachable,
      enum: markReachable,
      union: markReachable,
    });
  }

  return {
    getUsage: (type: Type) => usages.get(type),
    isUnreachable: (type: Type) => !reachableTypes.has(type),
  };
}

function trackUsage(
  reachableTypes: Set<Type>,
  usages: Map<Type, Set<GraphQLTypeUsage>>,
  type: Type,
  usage: GraphQLTypeUsage,
) {
  reachableTypes.add(type);
  const existing = usages.get(type) ?? new Set();
  existing.add(usage);
  usages.set(type, existing);
}

/**
 * Recursively walk a namespace and all sub-namespaces, tracking type usage
 * from operations.
 */
function addUsagesInNamespace(
  namespace: Namespace,
  reachableTypes: Set<Type>,
  usages: Map<Type, Set<GraphQLTypeUsage>>,
): void {
  for (const subNamespace of namespace.namespaces.values()) {
    addUsagesInNamespace(subNamespace, reachableTypes, usages);
  }
  for (const iface of namespace.interfaces.values()) {
    for (const operation of iface.operations.values()) {
      addUsagesFromOperation(operation, reachableTypes, usages);
    }
  }
  for (const operation of namespace.operations.values()) {
    addUsagesFromOperation(operation, reachableTypes, usages);
  }
}

/**
 * For a single operation, mark parameter types as Input and return type as Output.
 */
function addUsagesFromOperation(
  operation: Operation,
  reachableTypes: Set<Type>,
  usages: Map<Type, Set<GraphQLTypeUsage>>,
): void {
  for (const param of operation.parameters.properties.values()) {
    navigateReferencedTypes(param.type, GraphQLTypeUsage.Input, reachableTypes, usages);
  }
  navigateReferencedTypes(operation.returnType, GraphQLTypeUsage.Output, reachableTypes, usages);
}

/**
 * Recursively walk a type graph, tracking reachability and usage classification.
 * Handles circular references via a visited set.
 */
function navigateReferencedTypes(
  type: Type,
  usage: GraphQLTypeUsage,
  reachableTypes: Set<Type>,
  usages: Map<Type, Set<GraphQLTypeUsage>>,
  visited: Set<Type> = new Set(),
): void {
  if (visited.has(type)) return;
  visited.add(type);

  switch (type.kind) {
    case "Model":
      if (isArrayModelType(type)) {
        if (type.indexer?.value) {
          navigateReferencedTypes(type.indexer.value, usage, reachableTypes, usages, visited);
        }
      } else {
        // Note: Record<K, V> models land here but their indexer value type
        // is not navigated. That's intentional — we don't support Record
        // types in GraphQL.
        trackUsage(reachableTypes, usages, type, usage);
        for (const prop of type.properties.values()) {
          navigateReferencedTypes(prop.type, usage, reachableTypes, usages, visited);
        }
        if (type.baseModel) {
          navigateReferencedTypes(type.baseModel, usage, reachableTypes, usages, visited);
        }
      }
      break;

    case "Union":
      trackUsage(reachableTypes, usages, type, usage);
      for (const variant of type.variants.values()) {
        navigateReferencedTypes(variant.type, usage, reachableTypes, usages, visited);
      }
      break;

    case "Scalar":
    case "Enum":
      trackUsage(reachableTypes, usages, type, usage);
      break;

    default:
      break;
  }
}
