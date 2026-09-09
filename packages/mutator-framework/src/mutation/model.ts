import type { MemberType, Model, Type } from "@typespec/compiler";
import type {
  CustomMutationClasses,
  MutationEngine,
  MutationFor,
  MutationHalfEdge,
  MutationOptions,
} from "./mutation-engine.js";
import { Mutation, type MutationInfo } from "./mutation.js";

export abstract class ModelMutation<
  TCustomMutations extends CustomMutationClasses,
  TOptions extends MutationOptions,
  TEngine extends MutationEngine<TCustomMutations> = MutationEngine<TCustomMutations>,
> extends Mutation<Model, TCustomMutations, TOptions, TEngine> {
  readonly kind = "Model";
  baseModel?: MutationFor<TCustomMutations, "Model">;
  properties: Map<string, MutationFor<TCustomMutations, "ModelProperty">> = new Map();
  indexer?: {
    key: MutationFor<TCustomMutations, "Scalar">;
    value: MutationFor<TCustomMutations, Type["kind"]>;
  };
  /** Mutations of the type-valued template arguments, keyed by argument index. */
  templateArgs = new Map<number, MutationFor<TCustomMutations, Type["kind"]>>();

  constructor(
    engine: TEngine,
    sourceType: Model,
    referenceTypes: MemberType[],
    options: TOptions,
    info: MutationInfo,
  ) {
    super(engine, sourceType, referenceTypes, options, info);
  }

  protected mutateBaseModel(newOptions: MutationOptions = this.options) {
    if (this.sourceType.baseModel) {
      this.baseModel = this.engine.mutate(
        this.sourceType.baseModel,
        newOptions,
        this.startBaseEdge(),
      );
    }
  }

  protected mutateProperties(newOptions: MutationOptions = this.options) {
    for (const prop of this.sourceType.properties.values()) {
      this.properties.set(
        prop.name,
        this.engine.mutate(prop, newOptions, this.startPropertyEdge()),
      );
    }
  }

  protected mutateIndexer(newOptions: MutationOptions = this.options) {
    if (this.sourceType.indexer) {
      this.indexer = {
        key: this.engine.mutate(
          this.sourceType.indexer.key,
          newOptions,
          this.startIndexerKeyEdge(),
        ),
        value: this.engine.mutate(
          this.sourceType.indexer.value,
          newOptions,
          this.startIndexerValueEdge(),
        ),
      };
    }
  }

  /**
   * Mutate the type-valued template arguments of a template instance so the
   * mutated model's `templateMapper` references mutated types. Values and
   * indeterminate entities are left as-is.
   */
  protected mutateTemplateArgs(newOptions: MutationOptions = this.options) {
    const mapper = this.sourceType.templateMapper;
    if (!mapper) {
      return;
    }
    mapper.args.forEach((arg, index) => {
      if (isTypeEntity(arg)) {
        this.templateArgs.set(
          index,
          this.engine.mutate(arg, newOptions, this.startTemplateArgEdge(index)),
        );
      }
    });
  }

  protected abstract startBaseEdge(): MutationHalfEdge;
  protected abstract startPropertyEdge(): MutationHalfEdge;
  protected abstract startIndexerValueEdge(): MutationHalfEdge;
  protected abstract startIndexerKeyEdge(): MutationHalfEdge;
  protected abstract startTemplateArgEdge(index: number): MutationHalfEdge;

  mutate(newOptions: MutationOptions = this.options) {
    this.mutateBaseModel(newOptions);
    this.mutateProperties(newOptions);
    this.mutateIndexer(newOptions);
    this.mutateTemplateArgs(newOptions);
  }
}

function isTypeEntity(entity: unknown): entity is Type {
  return (
    typeof entity === "object" &&
    entity !== null &&
    (entity as { entityKind?: string }).entityKind === "Type"
  );
}
