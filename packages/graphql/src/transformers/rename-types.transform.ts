import type { Program } from "@typespec/compiler";
import { createTransform } from "@typespec/compiler";
import { $ } from "@typespec/compiler/typekit";
import {
  EnumMemberMutation,
  EnumMutation,
  ModelMutation,
  ModelPropertyMutation,
  OperationMutation,
  ScalarMutation,
  SimpleMutationEngine,
} from "@typespec/mutator-framework";
import { sanitizeNameForGraphQL } from "../lib/type-utils.js";

// Custom mutation classes for renaming types to valid GraphQL names

class RenameEnumMutation extends EnumMutation<any, any> {
  mutate() {
    this.mutateType((enumType) => {
      enumType.name = sanitizeNameForGraphQL(enumType.name);
    });
    super.mutate();
  }
}

class RenameEnumMemberMutation extends EnumMemberMutation<any, any> {
  mutate() {
    this.mutateType((member) => {
      member.name = sanitizeNameForGraphQL(member.name);
    });
    super.mutate();
  }
}

class RenameModelMutation extends ModelMutation<any, any> {
  mutate() {
    this.mutateType((model) => {
      model.name = sanitizeNameForGraphQL(model.name);
    });
    super.mutate();
  }
}

class RenameModelPropertyMutation extends ModelPropertyMutation<any, any> {
  mutate() {
    this.mutateType((property) => {
      property.name = sanitizeNameForGraphQL(property.name);
    });
    super.mutate();
  }
}

class RenameOperationMutation extends OperationMutation<any, any> {
  mutate() {
    this.mutateType((operation) => {
      operation.name = sanitizeNameForGraphQL(operation.name);
    });
    super.mutate();
  }
}

class RenameScalarMutation extends ScalarMutation<any, any> {
  mutate() {
    this.mutateType((scalar) => {
      scalar.name = sanitizeNameForGraphQL(scalar.name);
    });
    super.mutate();
  }
}

export const renameTypesTransform = createTransform({
  name: "rename-types",
  description: "Rename types to be valid GraphQL names.",
  createEngine: (program: Program) => {
    const tk = $(program);
    return new SimpleMutationEngine(tk, {
      Enum: RenameEnumMutation,
      EnumMember: RenameEnumMemberMutation,
      Model: RenameModelMutation,
      ModelProperty: RenameModelPropertyMutation,
      Operation: RenameOperationMutation,
      Scalar: RenameScalarMutation,
    });
  },
});
