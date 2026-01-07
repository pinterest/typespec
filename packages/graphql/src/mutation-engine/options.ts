import { UsageFlags } from "@typespec/compiler";
import { SimpleMutationOptions } from "@typespec/mutator-framework";

/**
 * GraphQL-specific mutation options.
 *
 * Extends SimpleMutationOptions with usage-aware mutation key support,
 * enabling separate mutations for input vs output type variants.
 */
export class GraphQLMutationOptions extends SimpleMutationOptions {
  /**
   * The usage flag indicating whether this mutation is for input or output usage.
   * Used to generate separate mutations for the same type when used in both contexts.
   */
  readonly usageFlag: UsageFlags;

  constructor(usageFlag: UsageFlags = UsageFlags.None) {
    super();
    this.usageFlag = usageFlag;
  }

  /**
   * Override mutationKey to include usage flag.
   * This ensures the mutation engine caches separate mutations for input vs output variants.
   */
  override get mutationKey(): string {
    const baseKey = super.mutationKey;
    if (this.usageFlag === UsageFlags.Input) {
      return `${baseKey}:input`;
    } else if (this.usageFlag === UsageFlags.Output) {
      return `${baseKey}:output`;
    }
    return baseKey;
  }
}
