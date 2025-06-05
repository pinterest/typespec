import { UsageFlags, type Type } from "@typespec/compiler";
import type { GraphQLType } from "graphql";

/**
 * TypeSpec context for type mapping
 * @template T - The TypeSpec type
 */
export interface TSPContext<T extends Type> {
  type: T; // The TypeSpec type
  usageFlag: UsageFlags; // How the type is being used (input, output, etc.)
  graphqlName?: string; // Optional GraphQL type name override (e.g., "ModelInput" for input types)
  metadata: Record<string, any>; // Additional metadata
}

/**
 * Nominal type for keys in the TypeMap
 */
type TypeKey = string & { __typeKey: any };

/**
 * Base TypeMap for all GraphQL type mappings
 * @template T - The TypeSpec type constrained to TSP's Type
 * @template G - The GraphQL type constrained to GraphQL's GraphQLType
 */
export abstract class TypeMap<T extends Type, G extends GraphQLType> {

  // Map of materialized GraphQL types
  protected materializedMap = new Map<TypeKey, G>();

  // Map of registration contexts
  protected registrationMap = new Map<TypeKey, TSPContext<T>>();

  /**
   * Register a TypeSpec type with context for later materialization
   * @param context - The TypeSpec context
   * @returns The name used for registration as a TypeKey
   */
  register(context: TSPContext<T>): TypeKey {
    const name = this.getNameFromContext(context);
    this.registrationMap.set(name, context);
    return name;
  }

  /**
   * Get the materialized GraphQL type
   * @param name - The type name as a TypeKey
   * @returns The materialized GraphQL type or undefined
   */
  get(name: TypeKey): G | undefined {
    // Return already materialized type if available
    if (this.materializedMap.has(name)) {
      return this.materializedMap.get(name);
    }

    // Attempt to materialize if registered
    const context = this.registrationMap.get(name);
    if (context) {
      const materializedType = this.materialize(context);
      this.materializedMap.set(name, materializedType);
      return materializedType;
    }

    return undefined;
  }

  /**
   * Check if a type is registered
   */
  isRegistered(name: string): boolean {
    return this.registrationMap.has(name as TypeKey);
  }

  /**
   * Get all materialized types
   */
  getAllMaterialized(): MapIterator<G> {
    return this.materializedMap.values();
  }

  /**
   * Reset the type map
   */
  reset(): void {
    this.materializedMap.clear();
    this.registrationMap.clear();
  }

  /**
   * Get a name from a context
   */
  protected abstract getNameFromContext(context: TSPContext<T>): TypeKey;

  /**
   * Materialize a type from a context
   */
  protected abstract materialize(context: TSPContext<T>): G;
}
