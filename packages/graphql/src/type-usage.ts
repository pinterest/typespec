import {
  isArrayModelType,
  navigateTypesInNamespace,
  type Namespace,
  type Program,
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
  /** Get the set of usage flags for a type, or undefined if never reached */
  getUsage(type: Type): Set<GraphQLTypeUsage> | undefined;
  /** Returns true if the type is not reachable from any operation */
  isUnreachable(type: Type): boolean;
}

/**
 * Walk all operations in a namespace tree and track which types are reachable
 * from operation parameters (input) and return types (output).
 *
 * When `omitUnreachableTypes` is false, all types declared in the namespace
 * are considered reachable regardless of whether an operation references them.
 */
export function resolveTypeUsage(
  program: Program,
  root: Namespace,
  omitUnreachableTypes: boolean,
): TypeUsageResolver {
  const usages = new Map<Type, Set<GraphQLTypeUsage>>();

  // Walk all operations in the namespace tree
  addUsagesInNamespace(program, root, usages);

  // Build the set of types that are reachable from operations
  const reachableTypes = new Set<Type>(usages.keys());

  // If we're NOT omitting unreachable types, mark all declared types as reachable.
  // Only add to reachableTypes — do NOT add usage flags, since that would pollute
  // the Input/Output classification (e.g., an input-only model would appear as Output).
  if (!omitUnreachableTypes) {
    navigateTypesInNamespace(root, {
      model: (type) => { reachableTypes.add(type); },
      scalar: (type) => { reachableTypes.add(type); },
      enum: (type) => { reachableTypes.add(type); },
      union: (type) => { reachableTypes.add(type); },
    });
  }

  return {
    getUsage: (type: Type) => usages.get(type),
    isUnreachable: (type: Type) => !reachableTypes.has(type),
  };
}

function trackUsage(
  usages: Map<Type, Set<GraphQLTypeUsage>>,
  type: Type,
  usage: GraphQLTypeUsage,
) {
  const existing = usages.get(type) ?? new Set();
  existing.add(usage);
  usages.set(type, existing);
}

/**
 * Recursively walk a namespace and all sub-namespaces, tracking type usage
 * from operations.
 */
function addUsagesInNamespace(
  program: Program,
  namespace: Namespace,
  usages: Map<Type, Set<GraphQLTypeUsage>>,
): void {
  for (const subNamespace of namespace.namespaces.values()) {
    addUsagesInNamespace(program, subNamespace, usages);
  }
  for (const iface of namespace.interfaces.values()) {
    for (const operation of iface.operations.values()) {
      addUsagesFromOperation(program, operation, usages);
    }
  }
  for (const operation of namespace.operations.values()) {
    addUsagesFromOperation(program, operation, usages);
  }
}

/**
 * For a single operation, mark parameter types as Input and return type as Output.
 */
function addUsagesFromOperation(
  program: Program,
  operation: { parameters: { properties: Map<string | symbol, { type: Type }> }; returnType: Type },
  usages: Map<Type, Set<GraphQLTypeUsage>>,
): void {
  // Parameters are inputs
  for (const param of operation.parameters.properties.values()) {
    navigateReferencedTypes(program, param.type, GraphQLTypeUsage.Input, usages);
  }
  // Return type is output
  navigateReferencedTypes(program, operation.returnType, GraphQLTypeUsage.Output, usages);
}

/**
 * Recursively walk a type graph, tracking all reachable types with the given usage flag.
 * Handles circular references via a visited set.
 */
function navigateReferencedTypes(
  program: Program,
  type: Type,
  usage: GraphQLTypeUsage,
  usages: Map<Type, Set<GraphQLTypeUsage>>,
  visited: Set<Type> = new Set(),
): void {
  if (visited.has(type)) return;
  visited.add(type);

  switch (type.kind) {
    case "Model":
      if (isArrayModelType(program, type)) {
        // Array type — follow the element type
        if (type.indexer?.value) {
          navigateReferencedTypes(program, type.indexer.value, usage, usages, visited);
        }
      } else {
        // Regular model — track it and follow its properties
        trackUsage(usages, type, usage);
        for (const prop of type.properties.values()) {
          navigateReferencedTypes(program, prop.type, usage, usages, visited);
        }
        // Follow base model
        if (type.baseModel) {
          navigateReferencedTypes(program, type.baseModel, usage, usages, visited);
        }
      }
      break;

    case "Union":
      trackUsage(usages, type, usage);
      for (const variant of type.variants.values()) {
        navigateReferencedTypes(program, variant.type, usage, usages, visited);
      }
      break;

    case "Scalar":
      trackUsage(usages, type, usage);
      break;

    case "Enum":
      trackUsage(usages, type, usage);
      break;

    default:
      // Other types (Intrinsic, etc.) — just track them
      trackUsage(usages, type, usage);
      break;
  }
}
