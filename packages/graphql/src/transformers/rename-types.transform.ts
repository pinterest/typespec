import type { Program } from "@typespec/compiler";
import { createTransform } from "@typespec/compiler";
import type {
  unsafe_MutableType as MutableType,
  unsafe_MutatorRecord as MutatorRecord,
} from "@typespec/compiler/experimental";
import { sanitizeNameForGraphQL } from "../lib/type-utils.js";

const makeRenameMutator = <T extends MutableType & { name: string }>(): MutatorRecord<T> => ({
  mutate(target, clone, _program: Program) {
    // TODO we shouldn't be modifying target directly
    target.name = sanitizeNameForGraphQL(target.name);
  },
});

export const renameTypesTransform = createTransform({
  name: "rename-types",
  description: "Rename types to be valid GraphQL names.",
  mutators: [
    {
      name: "Rename Types",
      Enum: makeRenameMutator(),
      EnumMember: makeRenameMutator(),
      Model: makeRenameMutator(),
      ModelProperty: makeRenameMutator(),
      Operation: makeRenameMutator(),
      Scalar: makeRenameMutator(),
    },
  ],
});
