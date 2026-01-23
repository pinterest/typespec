import {
  resolveUsages,
  UsageFlags,
  type Enum,
  type Model,
  type Namespace,
  type Operation,
  type Program,
  type Scalar,
  type UsageTracker,
} from "@typespec/compiler";
import { $ } from "@typespec/compiler/typekit";
import {
  MutationEngine,
  SimpleInterfaceMutation,
  SimpleIntrinsicMutation,
  SimpleLiteralMutation,
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
import { GraphQLMutationOptions } from "./options.js";

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
  // Use Simple* classes from mutator-framework for types we don't customize
  Interface: SimpleInterfaceMutation,
  Union: SimpleUnionMutation,
  UnionVariant: SimpleUnionVariantMutation,
  String: SimpleLiteralMutation,
  Number: SimpleLiteralMutation,
  Boolean: SimpleLiteralMutation,
  Intrinsic: SimpleIntrinsicMutation,
};

/**
 * Result of mutating a model with usage awareness.
 * Contains separate mutations for input and output variants when applicable.
 */
export interface ModelMutationResult {
  /** The input variant mutation (with "Input" suffix), if the model is used as input */
  input?: GraphQLModelMutation;
  /** The output variant mutation (no suffix), if the model is used as output */
  output?: GraphQLModelMutation;
}

/**
 * GraphQL mutation engine that applies GraphQL-specific transformations
 * to TypeSpec types, such as name sanitization and input/output splitting.
 */
export class GraphQLMutationEngine {
  /**
   * The underlying mutation engine configured with GraphQL-specific mutation classes.
   * Type is inferred from graphqlMutationRegistry to avoid complex generic constraints.
   */
  private engine;

  /** Usage tracker for types in the namespace */
  private usageTracker: UsageTracker;

  constructor(program: Program, namespace: Namespace) {
    const tk = $(program);
    this.engine = new MutationEngine(tk, graphqlMutationRegistry);

    // Resolve usages once at construction time
    this.usageTracker = resolveUsages(namespace);
  }

  /**
   * Get the usage flags for a model.
   */
  getUsage(model: Model): UsageFlags {
    const isInput = this.usageTracker.isUsedAs(model, UsageFlags.Input);
    const isOutput = this.usageTracker.isUsedAs(model, UsageFlags.Output);

    if (isInput && isOutput) {
      return UsageFlags.Input | UsageFlags.Output;
    } else if (isInput) {
      return UsageFlags.Input;
    } else if (isOutput) {
      return UsageFlags.Output;
    }
    return UsageFlags.None;
  }

  /**
   * Mutate a model with usage awareness.
   * Returns separate input/output mutations based on how the model is used.
   */
  mutateModel(model: Model): ModelMutationResult {
    const usage = this.getUsage(model);
    const result: ModelMutationResult = {};

    // Create output mutation if used as output (or no usage info)
    if (usage & UsageFlags.Output || usage === UsageFlags.None) {
      const outputOptions = new GraphQLMutationOptions(UsageFlags.Output);
      result.output = this.engine.mutate(model, outputOptions) as GraphQLModelMutation;
    }

    // Create input mutation if used as input
    if (usage & UsageFlags.Input) {
      const inputOptions = new GraphQLMutationOptions(UsageFlags.Input);
      result.input = this.engine.mutate(model, inputOptions) as GraphQLModelMutation;
    }

    return result;
  }

  /**
   * Mutate an enum, applying GraphQL name sanitization.
   */
  mutateEnum(enumType: Enum): GraphQLEnumMutation {
    return this.engine.mutate(enumType, new GraphQLMutationOptions()) as GraphQLEnumMutation;
  }

  /**
   * Mutate an operation, applying GraphQL name sanitization.
   */
  mutateOperation(operation: Operation): GraphQLOperationMutation {
    return this.engine.mutate(operation, new GraphQLMutationOptions()) as GraphQLOperationMutation;
  }

  /**
   * Mutate a scalar, applying GraphQL name sanitization.
   */
  mutateScalar(scalar: Scalar): GraphQLScalarMutation {
    return this.engine.mutate(scalar, new GraphQLMutationOptions()) as GraphQLScalarMutation;
  }
}

/**
 * Creates a GraphQL mutation engine for the given program and namespace.
 */
export function createGraphQLMutationEngine(
  program: Program,
  namespace: Namespace,
): GraphQLMutationEngine {
  return new GraphQLMutationEngine(program, namespace);
}
