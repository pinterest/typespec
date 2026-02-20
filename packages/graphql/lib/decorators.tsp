import "../dist/src/tsp-index.js";

using TypeSpec.Reflection;

namespace TypeSpec.GraphQL;

/**
 * Marks an operation as a GraphQL query operation.
 * 
 * @example
 * ```typespec
 * @query
 * op getUser(id: string): User;
 * ```
 */
extern dec query(target: Operation);

/**
 * Marks an operation as a GraphQL mutation operation.
 * 
 * @example
 * ```typespec
 * @mutation
 * op createUser(userData: UserData): User;
 * ```
 */
extern dec mutation(target: Operation);

/**
 * Marks an operation as a GraphQL subscription operation.
 * 
 * @example
 * ```typespec
 * @subscription
 * op onUserUpdated(id: string): User;
 * ```
 */
extern dec subscription(target: Operation);

/**
 * Designates a model as a GraphQL interface type.
 * Can only be applied to output models.
 * 
 * @example
 * ```typespec
 * @Interface
 * model Node {
 *   id: ID;
 * }
 * ```
 */
extern dec Interface(target: Model);

/**
 * Specifies which interfaces a model implements.
 * All interfaces must be models decorated with @Interface.
 * 
 * @example
 * ```typespec
 * @compose(Node)
 * model User {
 *   id: ID;
 *   name: string;
 * }
 * ```
 */
extern dec compose(target: Model, ...implements: Interface.target[]);

/**
 * Adds operations as fields with arguments to a model.
 * Operations and interfaces listed won't be emitted in the root GraphQL operations.
 * 
 * @example
 * ```typespec
 * @operationFields(followers, ImageService.urls)
 * model User {
 *   id: string;
 *   name: string;
 * }
 * ```
 */
extern dec operationFields(target: Model, ...onOperations: (Operation | Interface)[]);

/**
 * Marks a model to be used as a custom query type.
 * 
 * @example
 * ```typespec
 * @useAsQuery
 * @operationFields(followers)
 * model MyOwnQuery {
 *   me: User;
 * }
 * ```
 */
extern dec useAsQuery(target: Model);

/**
 * Provides a URL to the specification for a custom scalar type.
 * 
 * @example
 * ```typespec
 * @specifiedBy("https://tools.ietf.org/html/rfc4122")
 * scalar UUID extends string;
 * ```
 */
extern dec specifiedBy(target: Scalar, url: valueof string);
