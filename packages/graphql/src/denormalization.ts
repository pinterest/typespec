import type { Model, ModelProperty, Namespace } from "@typespec/compiler";
import { UsageFlags, type EmitContext, type UsageTracker } from "@typespec/compiler";
import { $ } from "@typespec/compiler/typekit";

/**
 * Provides utilities to denormalize TypeSpec (TSP) model types for GraphQL emitters.
 * Optionally, a debug flag will print a mapping of original models to their denormalized variants.
 *
 * Example usage:
 * ```typescript
 * const usageTracker = resolveUsages(namespace);
 * GraphQLDenormalizer.denormalize(namespace, usageTracker, context, true); // debug output enabled
 * ```
 */
export class GraphQLDenormalizer {
  /**
   * Denormalizes TSP model types for GraphQL input usage.
   *
   * @param namespace The TypeSpec namespace to mutate.
   * @param usageTracker UsageTracker for determining input usage.
   * @param context The TypeSpec emit context.
   * @param debug If true, logs a mapping of original to denormalized models.
   */
  static denormalize(
    namespace: Namespace,
    usageTracker: UsageTracker,
    context: EmitContext<any>,
    debug: boolean = false,
  ): void {
    for (const [_, model] of namespace.models) {
      this.expandInputOutputTypes(model, usageTracker, context, namespace, debug);
    // TODO: Call methods for additional denormalization steps such as resolving decorators, de-anonymizing unions, etc.

    }
  }

  /**
   * Expands input/output types by creating GraphQL-compliant input model variants (e.g., FooInput)
   * for models used as input types. Mutates the TypeSpec namespace in-place.
   * Throws on name collisions. Debug output prints mapping from TSP Model to TSP Model variants.
   */
  public static expandInputOutputTypes(
    model: Model,
    usageTracker: UsageTracker,
    context: EmitContext<any>,
    namespace: Namespace,
    debug: boolean
  ) {
    const typekit = $(context.program);
    // Only process if this model is used as input
    if (!usageTracker.isUsedAs(model, UsageFlags.Input)) return;
    const inputName = model.name + "Input";
    if (namespace.models.has(inputName)) {
      throw new Error(`Model name collision: ${inputName} already exists in namespace.`);
    }
    // Helper to recursively denormalize nested model properties
    function getInputType(type: any): any {
      if (type.kind === "Model" && usageTracker.isUsedAs(type, UsageFlags.Input)) {
        const nestedInputName = type.name + "Input";
        if (namespace.models.has(nestedInputName)) {
          return namespace.models.get(nestedInputName);
        }
        const inputModel = GraphQLDenormalizer.createInputModelVariant(type, typekit, getInputType);
        if (namespace.models.has(nestedInputName)) {
          throw new Error(`Model name collision: ${nestedInputName} already exists in namespace.`);
        }
        namespace.models.set(nestedInputName, inputModel);
        if (debug) {
          // eslint-disable-next-line no-console
          console.log(`[GraphQLDenormalizer] Created input model: ${type.name} -> ${nestedInputName}`);
        }
        return inputModel;
      }
      return type;
    }
    const inputModel = GraphQLDenormalizer.createInputModelVariant(model, typekit, getInputType);
    namespace.models.set(inputName, inputModel);
    if (debug) {
      // eslint-disable-next-line no-console
      console.log(`[GraphQLDenormalizer] Created input model: ${model.name} -> ${inputName}`);
    }
  }

  /**
   * Creates an input model variant from an output model.
   * Recursively transforms nested model types to their input variants using getInputType.
   */
  public static createInputModelVariant(
    outputModel: Model,
    typekit: ReturnType<typeof $>,
    getInputType: (type: any) => any,
  ): Model {
    const inputProperties: Record<string, ModelProperty> = {};
    for (const [name, prop] of outputModel.properties) {
      inputProperties[name] = typekit.modelProperty.create({
        name: prop.name,
        type: getInputType(prop.type),
        optional: prop.optional,
      });
    }
    const inputModel = typekit.model.create({
      name: outputModel.name + "Input",
      properties: inputProperties,
    });
    for (const [_, prop] of inputModel.properties) {
      (prop as any).model = inputModel;
    }
    return inputModel;
  }

  // TODO: Add methods for additional denormalization steps such as resolving decorators, de-anonymizing unions, etc.
}
