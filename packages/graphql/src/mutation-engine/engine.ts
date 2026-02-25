import {
  type Enum,
  type Model,
  type Operation,
  type Program,
  type Scalar,
  type Union,
} from "@typespec/compiler";
import { $ } from "@typespec/compiler/typekit";
import {
  MutationEngine,
  SimpleMutationOptions,
  SimpleInterfaceMutation,
  SimpleIntrinsicMutation,
  SimpleLiteralMutation,
  SimpleUnionVariantMutation,
} from "@typespec/mutator-framework";
import {
  GraphQLEnumMemberMutation,
  GraphQLEnumMutation,
  GraphQLModelMutation,
  GraphQLModelPropertyMutation,
  GraphQLOperationMutation,
  GraphQLScalarMutation,
  GraphQLUnionMutation,
} from "./mutations/index.js";

/**
 * Registry configuration for the GraphQL mutation engine.
 * Maps TypeSpec type kinds to their corresponding GraphQL mutation classes.
 */
const graphqlMutationRegistry = {
  // Custom GraphQL mutations for types we need to transform
  Enum: GraphQLEnumMutation,
  EnumMember: GraphQLEnumMemberMutation,
  Model: GraphQLModelMutation,
  ModelProperty: GraphQLModelPropertyMutation,
  Operation: GraphQLOperationMutation,
  Scalar: GraphQLScalarMutation,
  Union: GraphQLUnionMutation,
  // Use Simple* classes from mutator-framework for types we don't customize
  Interface: SimpleInterfaceMutation,
  UnionVariant: SimpleUnionVariantMutation,
  String: SimpleLiteralMutation,
  Number: SimpleLiteralMutation,
  Boolean: SimpleLiteralMutation,
  Intrinsic: SimpleIntrinsicMutation,
};

/**
 * GraphQL mutation engine that applies GraphQL-specific transformations
 * to TypeSpec types, such as name sanitization.
 */
export class GraphQLMutationEngine {
  /**
   * The underlying mutation engine configured with GraphQL-specific mutation classes.
   * Type is inferred from MutationEngine constructor to avoid complex generic constraints.
   */
  private engine;

  constructor(program: Program) {
    const tk = $(program);
    this.engine = new MutationEngine(tk, graphqlMutationRegistry);
  }

  /**
   * Mutate a model, applying GraphQL name sanitization.
   */
  mutateModel(model: Model): GraphQLModelMutation {
    return this.engine.mutate(model, new SimpleMutationOptions()) as GraphQLModelMutation;
  }

  /**
   * Mutate an enum, applying GraphQL name sanitization.
   */
  mutateEnum(enumType: Enum): GraphQLEnumMutation {
    return this.engine.mutate(enumType, new SimpleMutationOptions()) as GraphQLEnumMutation;
  }

  /**
   * Mutate an operation, applying GraphQL name sanitization.
   */
  mutateOperation(operation: Operation): GraphQLOperationMutation {
    return this.engine.mutate(operation, new SimpleMutationOptions()) as GraphQLOperationMutation;
  }

  /**
   * Mutate a scalar, applying GraphQL name sanitization.
   */
  mutateScalar(scalar: Scalar): GraphQLScalarMutation {
    return this.engine.mutate(scalar, new SimpleMutationOptions()) as GraphQLScalarMutation;
  }

  /**
   * Mutate a union, creating wrapper types for scalar variants.
   */
  mutateUnion(union: Union): GraphQLUnionMutation {
    return this.engine.mutate(union, new SimpleMutationOptions()) as GraphQLUnionMutation;
  }
}

/**
 * Creates a GraphQL mutation engine for the given program.
 */
export function createGraphQLMutationEngine(program: Program): GraphQLMutationEngine {
  return new GraphQLMutationEngine(program);
}
