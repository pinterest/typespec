import type { ModelProperty, Type } from "@typespec/compiler";
import type {
  CustomMutationClasses,
  MutationEngine,
  MutationFor,
  MutationHalfEdge,
  MutationOptions,
} from "./mutation-engine.js";
import { Mutation } from "./mutation.js";

export abstract class ModelPropertyMutation<
  TCustomMutations extends CustomMutationClasses,
  TOptions extends MutationOptions,
  TEngine extends MutationEngine<TCustomMutations> = MutationEngine<TCustomMutations>,
> extends Mutation<ModelProperty, TCustomMutations, TOptions, TEngine> {
  readonly kind = "ModelProperty";
  type!: MutationFor<TCustomMutations, Type["kind"]>;
  /** Mutation of the source property this property was inherited or spread from. */
  sourceProperty?: MutationFor<TCustomMutations, "ModelProperty">;

  mutate(newOptions: MutationOptions = this.options) {
    this.type = this.engine.mutateReference(
      this.sourceType,
      newOptions,
      this.startTypeEdge(),
    ) as MutationFor<TCustomMutations, Type["kind"]>;
    if (this.sourceType.sourceProperty) {
      this.sourceProperty = this.engine.mutate(
        this.sourceType.sourceProperty,
        newOptions,
        this.startSourcePropertyEdge(),
      ) as MutationFor<TCustomMutations, "ModelProperty">;
    }
  }

  protected abstract startTypeEdge(): MutationHalfEdge;
  protected abstract startSourcePropertyEdge(): MutationHalfEdge;
}
