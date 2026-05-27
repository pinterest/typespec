import type { Namespace, Type } from "@typespec/compiler";
import type { Typekit } from "@typespec/compiler/typekit";

/**
 * A self-contained type world produced by a mutation stage.
 *
 * Each TypeGraph is fully independent — every type in it has `.namespace`
 * pointing to this graph's namespace tree, not to any prior graph. This
 * ensures compatibility with `navigateTypesInNamespace` and prevents
 * dangling references across mutation stages.
 */
export interface TypeGraph {
  /** The root namespace containing all types in this graph. */
  readonly globalNamespace: Namespace;
}

/**
 * Options for building a TypeGraph from a namespace and set of mutations.
 */
export interface BuildTypeGraphOptions {
  /**
   * Map of original types to their mutated replacements.
   * Types present in this map will use the mutated version in the output graph.
   * Types NOT in this map will be shallow-cloned to update their `.namespace`.
   */
  mutations?: ReadonlyMap<Type, Type>;

  /** Synthetic types to add to the namespace. */
  additions?: readonly Type[];

  /** Original types to remove from the namespace. */
  deletions?: ReadonlySet<Type>;
}

/**
 * Build a TypeGraph by cloning an entire namespace tree.
 *
 * Every type in the output has its `.namespace` pointing to the new tree.
 * Mutated types (from `options.mutations`) are substituted in; unmutated types
 * get a shallow clone with updated `.namespace`.
 *
 * @param tk - Typekit for cloning types
 * @param inputNamespace - The source namespace to clone
 * @param options - Mutations, additions, and deletions to apply
 */
export function buildTypeGraph(
  tk: Typekit,
  inputNamespace: Namespace,
  options: BuildTypeGraphOptions = {},
): TypeGraph {
  const globalNamespace = buildNamespace(tk, inputNamespace, options);
  return { globalNamespace };
}

function buildNamespace(
  tk: Typekit,
  inputNamespace: Namespace,
  options: BuildTypeGraphOptions,
  parentNamespace?: Namespace,
): Namespace {
  const { mutations, additions, deletions } = options;

  // Clone the namespace itself (creates new maps for members)
  const clonedNs = tk.type.clone(inputNamespace);
  tk.type.finishType(clonedNs);
  if (parentNamespace) {
    (clonedNs as any).namespace = parentNamespace;
  }

  // Process models
  replaceMembers(tk, clonedNs, "models", mutations, deletions);

  // Process operations
  replaceMembers(tk, clonedNs, "operations", mutations, deletions);

  // Process enums
  replaceMembers(tk, clonedNs, "enums", mutations, deletions);

  // Process unions
  replaceMembers(tk, clonedNs, "unions", mutations, deletions);

  // Process scalars
  replaceMembers(tk, clonedNs, "scalars", mutations, deletions);

  // Process interfaces
  replaceMembers(tk, clonedNs, "interfaces", mutations, deletions);

  // Add synthetic types
  if (additions) {
    for (const type of additions) {
      addToNamespace(clonedNs, type);
    }
  }

  // Recurse into sub-namespaces
  for (const [name, subNs] of inputNamespace.namespaces) {
    const childNs = buildNamespace(tk, subNs, options, clonedNs);
    clonedNs.namespaces.set(name, childNs);
  }

  return clonedNs;
}

/**
 * For a given member map on the namespace (e.g., `models`, `operations`),
 * replace each entry with its mutated version or a shallow clone.
 */
function replaceMembers(
  tk: Typekit,
  clonedNs: Namespace,
  mapKey: "models" | "operations" | "enums" | "unions" | "scalars" | "interfaces",
  mutations: ReadonlyMap<Type, Type> | undefined,
  deletions: ReadonlySet<Type> | undefined,
): void {
  const map = (clonedNs as any)[mapKey] as Map<string, Type>;
  // Iterate the current entries (which reference the original types from the
  // shallow namespace clone) and replace each with the appropriate version.
  for (const [name, originalType] of [...map.entries()]) {
    if (deletions?.has(originalType)) {
      map.delete(name);
      continue;
    }

    const mutated = mutations?.get(originalType);
    if (mutated) {
      // Use the mutated version, update its namespace reference
      (mutated as any).namespace = clonedNs;
      map.set(name, mutated);
    } else {
      // Shallow clone to set .namespace correctly
      const memberClone = tk.type.clone(originalType);
      tk.type.finishType(memberClone);
      (memberClone as any).namespace = clonedNs;
      map.set(name, memberClone);
    }
  }
}

/**
 * Add a synthetic type to the appropriate map on the namespace.
 */
function addToNamespace(ns: Namespace, type: Type): void {
  (type as any).namespace = ns;
  switch (type.kind) {
    case "Model":
      ns.models.set(type.name, type);
      break;
    case "Operation":
      ns.operations.set(type.name, type);
      break;
    case "Enum":
      ns.enums.set(type.name!, type);
      break;
    case "Union":
      if (type.name) ns.unions.set(type.name, type);
      break;
    case "Scalar":
      ns.scalars.set(type.name, type);
      break;
    case "Interface":
      ns.interfaces.set(type.name, type);
      break;
  }
}
