import type { Program } from "@typespec/compiler";
import { $ } from "@typespec/compiler/typekit";
import { SimpleMutationEngine } from "@typespec/mutator-framework";
import {
  GraphQLEnumMutation,
  GraphQLEnumMemberMutation,
  GraphQLModelMutation,
  GraphQLModelPropertyMutation,
  GraphQLOperationMutation,
  GraphQLScalarMutation,
} from "./mutations/index.js";

/**
 * Creates a GraphQL mutation engine that applies GraphQL-specific transformations
 * to TypeSpec types, such as renaming identifiers to comply with GraphQL naming rules.
 *
 * This engine can be used by GraphQL emitters to ensure types are properly transformed
 * before emitting GraphQL schemas, resolvers, or other GraphQL artifacts.
 *
 * @param program - The TypeSpec program
 * @returns A configured SimpleMutationEngine with GraphQL-specific mutations
 */
export function createGraphQLMutationEngine(program: Program): SimpleMutationEngine<any> {
  const tk = $(program);
  return new SimpleMutationEngine(tk, {
    Enum: GraphQLEnumMutation,
    EnumMember: GraphQLEnumMemberMutation,
    Model: GraphQLModelMutation,
    ModelProperty: GraphQLModelPropertyMutation,
    Operation: GraphQLOperationMutation,
    Scalar: GraphQLScalarMutation,
  });
}

