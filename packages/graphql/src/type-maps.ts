import { UsageFlags } from "@typespec/compiler";

/**
 * TypeSpec context for type mapping
 * @template T - The TypeSpec type
 */
export interface TSPContext<T = any> {
  type: T; // The TypeSpec type
  usageFlag: UsageFlags; // How the type is being used (input, output, etc.)
  name?: string; // Optional name override
  metadata?: Record<string, any>; // Optional additional metadata
}

/**
 * Base TypeMap for all GraphQL type mappings
 * @template T - The TypeSpec type
 * @template G - The GraphQL type
 */
export abstract class TypeMap<T, G> {
  // Map of materialized GraphQL types
  protected materializedMap = new Map<string, G>();

  // Map of registration contexts
  protected registrationMap = new Map<string, TSPContext<T>>();

  /**
   * Register a TypeSpec type with context for later materialization
   * @param context - The TypeSpec context
   * @returns The name used for registration
   */
  register(context: TSPContext<T>): string {
    const name = this.getNameFromContext(context);
    this.registrationMap.set(name, context);
    return name;
  }

  /**
   * Get the materialized GraphQL type
   * @param name - The type name
   * @returns The materialized GraphQL type or undefined
   */
  get(name: string): G | undefined {
    // Return already materialized type if available
    if (this.materializedMap.has(name)) {
      return this.materializedMap.get(name);
    }

    // Attempt to materialize if registered
    const context = this.registrationMap.get(name);
    if (context) {
      const materializedType = this.materialize(context);
      if (materializedType) {
        this.materializedMap.set(name, materializedType);
        return materializedType;
      }
    }

    return undefined;
  }

  /**
   * Check if a type is registered
   */
  isRegistered(name: string): boolean {
    return this.registrationMap.has(name);
  }

  /**
   * Get all materialized types
   */
  getAllMaterialized(): G[] {
    return Array.from(this.materializedMap.values());
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
  protected abstract getNameFromContext(context: TSPContext<T>): string;

  /**
   * Materialize a type from a context
   */
  protected abstract materialize(context: TSPContext<T>): G | undefined;
}
