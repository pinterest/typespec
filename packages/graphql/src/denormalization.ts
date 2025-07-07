import type { Model, ModelProperty, Namespace } from "@typespec/compiler";
import { UsageFlags, type EmitContext, type UsageTracker } from "@typespec/compiler";
import { $ } from "@typespec/compiler/typekit";

/**
 * Provides utilities to denormalize TypeSpec (TSP) model types for GraphQL emitters.
 *
 * This class analyzes model usage and creates GraphQL-compliant input model variants
 * (e.g., FooInput) for models used as input types. It mutates the provided namespace
 * in-place, recursively denormalizing nested model properties as needed.
 *
 * Name collisions will throw a JavaScript Error (consider using TypeSpec diagnostics in the future).
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
   * - Mutates the provided namespace in-place.
   * - Recursively creates input model variants (e.g., FooInput) for models used as input types.
   * - Throws a JavaScript Error for name collisions (TODO: use TypeSpec diagnostics).
   * - Optionally logs a debug mapping of original models to their denormalized variants.
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
    if (debug) {
      // eslint-disable-next-line no-console
      console.log(`[GraphQLDenormalizer] Starting denormalization for namespace: ${namespace.name}`);
    }
    for (const [_, model] of namespace.models) {
      this.expandInputOutputTypes(model, usageTracker, context, namespace, debug);
      // ...other steps will be called here in the future...
    }
  }

  /**
   * Expands input/output types by creating GraphQL-compliant input model variants (e.g., FooInput)
   * for models used as input types. Mutates the namespace in-place.
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

  // --- Stubs for future denormalization steps ---
  public static resolveDecorators(model: Model, context: EmitContext<any>, debug: boolean) {}
  public static renameIdentifiers(model: Model, context: EmitContext<any>, debug: boolean) {}
  public static transformBasicTypes(model: Model, context: EmitContext<any>, debug: boolean) {}
  public static transformIntrinsicTypes(model: Model, context: EmitContext<any>, debug: boolean) {}
  public static transformRecordTypes(model: Model, context: EmitContext<any>, debug: boolean) {}
  public static deanonymizeUnions(model: Model, context: EmitContext<any>, debug: boolean) {}
  public static materializeRootOperationTypes(model: Model, context: EmitContext<any>, debug: boolean) {}
  public static resolveSubschemaSelection(model: Model, context: EmitContext<any>, debug: boolean) {}
  public static makeFieldsOptionalByDefault(model: Model, context: EmitContext<any>, debug: boolean) {}
  public static removeNullFromUnions(model: Model, context: EmitContext<any>, debug: boolean) {}
}
