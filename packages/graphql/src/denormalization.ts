import type { Model, ModelProperty, Namespace } from "@typespec/compiler";
import { UsageFlags, resolveUsages, type EmitContext, type UsageTracker } from "@typespec/compiler";
import { $ } from "@typespec/compiler/typekit";

/**
 * Provides utilities to denormalize TypeSpec (TSP) model types for GraphQL emitters.
 * Optionally, a debug flag will print a mapping of original models to their denormalized variants.
 *
 * Example usage:
 * ```typescript
 * const denormalizer = new GraphQLTSPDenormalizer(namespace, context);
 * denormalizer.denormalize(true); // with debug output
 * ```
 */
export class GraphQLTSPDenormalizer {
  private usageTracker: UsageTracker;
  private namespace: Namespace;
  private context: EmitContext<any>;

  constructor(namespace: Namespace, context: EmitContext<any>) {
    this.namespace = namespace;
    this.context = context;
    this.usageTracker = resolveUsages(namespace);
  }

  denormalize(debug: boolean = false): void {
    for (const [_, model] of this.namespace.models) {
      this.expandInputOutputTypes(model, debug);
      // TODO: Call methods for additional denormalization steps such as resolving decorators, de-anonymizing unions, etc.
    }
  }

  /**
   * Creates an input variant for a model if it's used as input (e.g., User -> UserInput).
   * Recursively processes nested models. Mutates namespace in-place.
   * Throws on name collisions.
   */
  expandInputOutputTypes(model: Model, debug: boolean) {
    const typekit = $(this.context.program);
    // Only process if this model is used as input
    if (!this.usageTracker.isUsedAs(model, UsageFlags.Input)) return;
    const inputName = model.name + "Input";
    if (this.namespace.models.has(inputName)) {
      throw new Error(`Model name collision: ${inputName} already exists in namespace.`);
    }
    // Recursively transform nested model types to their input variants
    const getInputType = (type: any): any => {
      if (type.kind === "Model" && this.usageTracker.isUsedAs(type, UsageFlags.Input)) {
        const nestedInputName = type.name + "Input";
        if (this.namespace.models.has(nestedInputName)) {
          return this.namespace.models.get(nestedInputName);
        }
        
        // Create placeholder model first to prevent recursive creation
        const placeholderModel = typekit.model.create({
          name: nestedInputName,
          properties: {},
        });
        this.namespace.models.set(nestedInputName, placeholderModel);
        
        // Now populate the properties with recursive transformation
        const inputProperties: Record<string, ModelProperty> = {};
        for (const [name, prop] of type.properties) {
          inputProperties[name] = typekit.modelProperty.create({
            name: prop.name,
            type: getInputType(prop.type),
            optional: prop.optional,
          });
        }
        
        // Create the final input model with all properties
        const inputModel = typekit.model.create({
          name: nestedInputName,
          properties: inputProperties,
        });
        
        // Replace the placeholder with the fully populated model
        this.namespace.models.set(nestedInputName, inputModel);
        for (const [_, prop] of inputModel.properties) {
          (prop as any).model = inputModel;
        }
        
        if (debug) {
          // eslint-disable-next-line no-console
          console.log(
            `[GraphQLDenormalizer] Created input model: ${type.name} -> ${nestedInputName}`,
          );
        }
        return inputModel;
      }
      return type;
    };
    const inputModel = this.createInputModelVariant(model, typekit, getInputType);
    this.namespace.models.set(inputName, inputModel);
    if (debug) {
      // eslint-disable-next-line no-console
      console.log(`[GraphQLDenormalizer] Created input model: ${model.name} -> ${inputName}`);
    }
  }

  /**
   * Creates an input model variant with transformed properties.
   * Uses getInputType to recursively transform nested model references.
   */
  private createInputModelVariant(
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
