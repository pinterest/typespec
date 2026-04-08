import type { MemberType, Operation } from "@typespec/compiler";
import {
  SimpleOperationMutation,
  type MutationInfo,
  type SimpleMutationEngine,
  type SimpleMutationOptions,
  type SimpleMutations,
} from "@typespec/mutator-framework";
import { setNullable } from "../../lib/nullable.js";
import { unwrapNullableUnion, sanitizeNameForGraphQL } from "../../lib/type-utils.js";
import { GraphQLMutationOptions, GraphQLTypeContext } from "../options.js";

/** GraphQL-specific Operation mutation. */
export class GraphQLOperationMutation extends SimpleOperationMutation<SimpleMutationOptions> {
  constructor(
    engine: SimpleMutationEngine<SimpleMutations<SimpleMutationOptions>>,
    sourceType: Operation,
    referenceTypes: MemberType[],
    options: SimpleMutationOptions,
    info: MutationInfo,
  ) {
    super(engine, sourceType, referenceTypes, options, info);
  }

  /**
   * Override to mutate parameters with input context.
   * Types reachable from operation parameters become GraphQL input types.
   */
  protected override mutateParameters() {
    const inputOptions = new GraphQLMutationOptions(GraphQLTypeContext.Input);
    this.parameters = this.engine.mutate(
      this.sourceType.parameters,
      inputOptions,
      this.startParametersEdge(),
    );
  }

  /**
   * Override to mutate return type with output context.
   * Types reachable from operation return types become GraphQL object types.
   */
  protected override mutateReturnType() {
    const outputOptions = new GraphQLMutationOptions(GraphQLTypeContext.Output);
    this.returnType = this.engine.mutate(
      this.sourceType.returnType,
      outputOptions,
      this.startReturnTypeEdge(),
    );
  }

  mutate() {
    // Detect if the return type is inline T | null BEFORE super.mutate()
    // replaces it. Same pattern as GraphQLModelPropertyMutation — see
    // nullable.ts for the full architectural explanation.
    const originalReturnType = this.sourceType.returnType;
    const hasNullableReturn =
      originalReturnType.kind === "Union" &&
      unwrapNullableUnion(originalReturnType) !== undefined;

    // Apply GraphQL name sanitization via callback
    this.mutationNode.mutate((operation) => {
      operation.name = sanitizeNameForGraphQL(operation.name);
    });
    super.mutate();

    // Mark the mutated operation as having a nullable return type.
    // The OperationField component checks isNullable(program, operation)
    // to determine whether the return field should omit the ! wrapper.
    if (hasNullableReturn) {
      setNullable(this.engine.$.program, this.mutatedType);
    }
  }
}
