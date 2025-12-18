import type { Program } from "@typespec/compiler";
import { $ } from "@typespec/compiler/typekit";
import {
  MutationEngine,
  SimpleInterfaceMutation,
  SimpleIntrinsicMutation,
  SimpleLiteralMutation,
  SimpleMutationOptions,
  SimpleUnionMutation,
  SimpleUnionVariantMutation,
} from "@typespec/mutator-framework";
import {
  GraphQLEnumMemberMutation,
  GraphQLEnumMutation,
  GraphQLModelMutation,
  GraphQLModelPropertyMutation,
  GraphQLOperationMutation,
  GraphQLScalarMutation,
} from "./mutations/index.js";

/**
 * Creates a GraphQL mutation engine that applies GraphQL-specific transformations
 * to TypeSpec types, such as renaming identifiers to comply with GraphQL naming rules.
 *
 * Note: We use MutationEngine directly (not SimpleMutationEngine) because
 * SimpleMutationEngine doesn't forward Enum/EnumMember classes to the parent.
 *
 * @param program - The TypeSpec program
 * @returns A configured MutationEngine with GraphQL-specific mutations
 */
export function createGraphQLMutationEngine(program: Program): MutationEngine<any> {
  const tk = $(program);
  return new MutationEngine(tk, {
    // Use our custom GraphQL mutations
    Enum: GraphQLEnumMutation,
    EnumMember: GraphQLEnumMemberMutation,
    Model: GraphQLModelMutation,
    ModelProperty: GraphQLModelPropertyMutation,
    Operation: GraphQLOperationMutation,
    Scalar: GraphQLScalarMutation,
    // Use Simple* classes for types we don't customize
    Interface: SimpleInterfaceMutation,
    Union: SimpleUnionMutation,
    UnionVariant: SimpleUnionVariantMutation,
    String: SimpleLiteralMutation,
    Number: SimpleLiteralMutation,
    Boolean: SimpleLiteralMutation,
    Intrinsic: SimpleIntrinsicMutation,
  });
}

// Re-export SimpleMutationOptions for use by consumers
export { SimpleMutationOptions };
