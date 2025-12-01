import type { Enum, EnumMember, MemberType, Program, Type } from "@typespec/compiler";
import { createTransform } from "@typespec/compiler";
import { $, type Typekit } from "@typespec/compiler/typekit";
import {
  ModelMutation,
  ModelPropertyMutation,
  Mutation,
  MutationEngine,
  MutationOptions,
  OperationMutation,
  ScalarMutation,
  type CustomMutationClasses,
  type MutationFor,
} from "@typespec/mutator-framework";
import { sanitizeNameForGraphQL } from "../lib/type-utils.js";

// Custom mutation classes for renaming types to valid GraphQL names

// Enum and EnumMember mutations (not yet in mutator-framework)
class RenameEnumMutation<
  TOptions extends MutationOptions = MutationOptions,
  TCustomMutations extends CustomMutationClasses = CustomMutationClasses,
  TEngine extends MutationEngine<TCustomMutations> = MutationEngine<TCustomMutations>,
> extends Mutation<Enum, TCustomMutations, TOptions, TEngine> {
  override readonly kind = "Enum" as const;

  constructor(engine: TEngine, sourceType: Enum, referenceTypes: MemberType[], options: TOptions) {
    super(engine, sourceType, referenceTypes, options);
  }

  mutate() {
    this.mutateType((enumType) => {
      enumType.name = sanitizeNameForGraphQL(enumType.name);
    });
    // Note: Don't call super.mutate() as base Mutation doesn't traverse Enum members
    // We would need to manually traverse members here if needed
  }
}

class RenameEnumMemberMutation<
  TOptions extends MutationOptions = MutationOptions,
  TCustomMutations extends CustomMutationClasses = CustomMutationClasses,
  TEngine extends MutationEngine<TCustomMutations> = MutationEngine<TCustomMutations>,
> extends Mutation<EnumMember, TCustomMutations, TOptions, TEngine> {
  override readonly kind = "EnumMember" as const;

  constructor(
    engine: TEngine,
    sourceType: EnumMember,
    referenceTypes: MemberType[],
    options: TOptions,
  ) {
    super(engine, sourceType, referenceTypes, options);
  }

  mutate() {
    this.mutateType((member) => {
      member.name = sanitizeNameForGraphQL(member.name);
    });
  }
}

class RenameModelMutation extends ModelMutation<MutationOptions, any> {
  mutate() {
    this.mutateType((model) => {
      model.name = sanitizeNameForGraphQL(model.name);
    });
    super.mutate();
  }
}

class RenameModelPropertyMutation extends ModelPropertyMutation<MutationOptions, any> {
  mutate() {
    this.mutateType((property) => {
      property.name = sanitizeNameForGraphQL(property.name);
    });
    super.mutate();
  }
}

class RenameOperationMutation extends OperationMutation<MutationOptions, any> {
  mutate() {
    this.mutateType((operation) => {
      operation.name = sanitizeNameForGraphQL(operation.name);
    });
    super.mutate();
  }
}

class RenameScalarMutation extends ScalarMutation<MutationOptions, any> {
  mutate() {
    this.mutateType((scalar) => {
      scalar.name = sanitizeNameForGraphQL(scalar.name);
    });
    super.mutate();
  }
}

// Custom engine that extends MutationEngine to support Enum and EnumMember
class RenameTypesEngine extends MutationEngine<{
  Enum: RenameEnumMutation<MutationOptions, any>;
  EnumMember: RenameEnumMemberMutation<MutationOptions, any>;
  Model: RenameModelMutation;
  ModelProperty: RenameModelPropertyMutation;
  Operation: RenameOperationMutation;
  Scalar: RenameScalarMutation;
}> {
  constructor($: Typekit) {
    super($, {
      Enum: RenameEnumMutation as any,
      EnumMember: RenameEnumMemberMutation as any,
      Model: RenameModelMutation,
      ModelProperty: RenameModelPropertyMutation,
      Operation: RenameOperationMutation,
      Scalar: RenameScalarMutation,
    });
    this.registerSubgraph("subgraph");
  }

  getDefaultMutationSubgraph(options: MutationOptions) {
    return this.getMutationSubgraph(options, "subgraph");
  }

  // Override to handle Enum and EnumMember mutations
  override mutate<T extends Type>(type: T, options?: MutationOptions): MutationFor<any> {
    // For Enum and EnumMember, we need to manually handle since they're not in the base registry
    if (type.kind === "Enum" || type.kind === "EnumMember") {
      const mutationClass = (this as any)["_mutatorClasses"]?.[type.kind];
      if (!mutationClass) {
        return type as any;
      }
      const mutation = new mutationClass(this, type, [], options ?? new MutationOptions());
      mutation.mutate();
      return mutation.getMutatedType();
    }
    return super.mutate(type, options);
  }
}

export const renameTypesTransform = createTransform({
  name: "rename-types",
  description: "Rename types to be valid GraphQL names.",
  createEngine: (program: Program) => {
    const tk = $(program);
    return new RenameTypesEngine(tk);
  },
});
