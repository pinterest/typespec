import { SimpleMutationOptions } from "@typespec/mutator-framework";

/**
 * GraphQL-specific mutation options.
 *
 * Currently a simple wrapper around SimpleMutationOptions.
 * Can be extended in the future to support additional GraphQL-specific options.
 */
export class GraphQLMutationOptions extends SimpleMutationOptions {}
