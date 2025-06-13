# Proposal: Expressing Model Property Error Handling

This proposal introduces two decorators for the TypeSpec standard library:

- [`@raises` decorator](#raises-decorator): Used to indicate that a model property may be associated with specific errors.
- [`@handles` decorator](#handles-decorator): Used to indicate that an [operation](#operation) or property will handle certain types of errors, preventing them from being considered further.

The proposal also recommends that new and existing emitters support these decorators for improved error documentation and code generation.

<br>

## Goals

As we (Pinterest) are building out the [GraphQL emitter][graphql-emitter], we have identified a need to express complex error handling patterns that are common in GraphQL APIs and cannot be easily expressed with the existing TypeSpec error handling mechanisms.

**Primary Goal:** Enable Pinterest's GraphQL emitter to express GraphQL's complex field-level error patterns (null propagation, errors-as-data, resolver-level handling).

**Secondary Goals:**
1. Provide a standard way for other emitters to leverage field-level error information
2. Enable multi-protocol schemas to express error handling once and generate appropriately for each target
3. Make error handling documentation more consistent and accurate by computing error information that must otherwise be specified manually

<br>

## Terminology

These terms have specific meanings throughout the document, so we will define them here.

#### Operation
A [TypeSpec operation][typespec-operation] which defines an action or function that can be performed. In protocol-specific contexts like HTTP/REST, [operations](#operation) often map to API endpoints. In other contexts like GraphQL, operations may map to queries, mutations, or resolvers. Operations are a core TypeSpec concept, not specific to any protocol.

#### Return type
The [return type of a TypeSpec operation](https://typespec.io/docs/language-basics/operations/#return-type) which defines what the [operation](#operation) returns when invoked. This is a core TypeSpec language concept and exists independently of protocol-specific mechanisms for returning data or errors. Different protocols may represent the return type in different ways (HTTP response bodies, GraphQL field values, etc.).

#### Operation error
An error that is specified in the [return type](#return-type) of an [operation](#operation) in TypeSpec. Operation errors are part of the API contract and are explicitly documented as possible results of invoking the operation.


#### Protocol error
An error expression specific to the protocol in which it is being expressed. Protocol errors may be the result of any number of sources, e.g. [operation errors](#operation-error), raised model property errors, or protocol processing errors. An [operation error](#operation-error) does not necessarily translate into a protocol error (it's up to the protocol emitter).

<br>

## Definitions

### `@raises` decorator

````typespec
/**
 * Indicates that the use of this property may be associated with specific errors.
 *
 * @param errors The list of error models that may be associated with this property.
 *
 * @example
 *
 * ```typespec
 * model User {
 *   @raises(NotFoundError, PermissionDeniedError, InvalidURLError)
 *   profilePictureUrl: string;
 * }
 * ```
 */
extern dec raises(target: ModelProperty, ...errors: Model[]);
````

The `@raises` decorator is applied to model properties to document that certain errors may be associated with those properties. This provides valuable information for documentation and code generation, helping consumers and tools understand where errors may occur within a model.

Protocol emitters are expected to consider errors listed in `@raises` decorators when determining what [protocol errors](#protocol-error) should be expressed.

The `errors` parameter is a list of models representing possible errors. Each error model must be decorated with the [`@error` decorator][error-decorator].

<br>

### `@handles` decorator

````typespec
/**
 * Indicates that this operation or model property will handle certain types of errors.
 *
 * @param errors The list of error models that will be handled by this operation or model property.
 *
 * @example
 *
 * ```typespec
 * @handles(InvalidURLError) op getUser(id: string): User | NotFoundError;
 *
 * model User {
 *   @handles(PermissionDeniedError) profilePictureUrl: string;
 * }
 * ```
 */
extern dec handles(target: Operation | ModelProperty, ...errors: Model[]);
````

The decorator can be applied to [operations](#operation) or model properties.
It specifies that the [operation](#operation) or model property will handle the listed errors, preventing them from being expressed as [protocol errors](#protocol-error).

The `errors` parameter is a list of models that represent the errors that will be handled by the [operation](#operation) or model property.
Each model must be decorated with the [`@error` decorator][error-decorator].

<br>

## Interaction with Other TypeSpec Concepts

This section will discuss how to integrate the new decorators with existing TypeSpec concepts.

### Operation Errors

Earlier we defined [operation errors](#operation-error) as errors that are specified in the [return type](#return-type) of an [operation](#operation).

Following, we'll discuss how operations errors interact with the `@raises` and `@handles` decorators.

#### Operation errors + `@raises` decorator

The `@raises` decorator can be used alongside an [operation](#operation)'s [return type](#return-type).
For example, `getUser()` may have a `GenericError` in its [return type](#return-type),
in addition to errors that may be associated with properties like `profilePictureUrl`.:

```typespec
model User {
  @raises(InvalidURLError)
  @handles(PermissionDeniedError)
  profilePictureUrl: string;
}
op getUser(id: string): User | GenericError;
```

If an error type is specified in both the [operation](#operation)'s [return type](#return-type) and the `@raises` decorator,
the [protocol error](#operation) should include the error (once) in the list of possible errors.

Semantically, the distinction between a `@raises` decorator and the [operation](#operation)'s [return type](#return-type) is in where the error is communicated.
An error on a [return type](#return-type) is an explicit indication that the error is somehow exposed directly in that response.
An error specified with `@raises`, on the other hand, may appear in a different location depending on if or where the error is specified in a `@handles` decorator — or not at all, depending on the protocol.

For instance, a bulk [operation](#operation) of some kind that includes the results of several sub-operations could communicate errors in a few different ways.
One way would be for each of the operation in the bulk set to provide its error value as its specific [return type](#return-type) — as indicated by an error present in the [return type](#return-type).
Another might be for the bulk operation to aggregate all the errors that occurred in the sub-operations and communicate them somewhere in its own response, which could be accomplished by the sub-operations using the `@raises` decorator and the bulk operation using the `@handles` decorator.

Essentially, an error in a [return type](#return-type) is opted out of any contextual handling, while an error in a `@raises` decorator follows the rules specified by other operations, properties, and/or [contextual modifiers](#context-modifiers).

#### Operation errors + `@handles` decorator

It is possible, and valid, that an [operation](#operation) both `@handles` an error and also has a [return type](#return-type) that includes that error.
In this case, the [operation](#operation) _will_ include the error in the list of possible errors for the operation.

```typespec
@handles(InvalidURLError)
op getUser(id: string): User | InvalidURLError | GenericError;
```

Semantically, this indicates that the [operation](#operation) will handle the `InvalidURLError` error when produced by a model property, but that the [operation](#operation) itself may also return that error, outside the context of a model property.

This becomes important when considering error inheritance.

<br>

### Interaction between `@raises` and `@handles` decorators

Model properties may have one or more error types defined in both their `@raises` decorator and the `@handles` decorator. In this case, the error is still considered possible at that property. Code emitters should treat `@raises` as taking precedence for code generation and documentation.

```typespec
model User {
  @raises(InvalidURLError)
  @handles(PermissionDeniedError, InvalidURLError)
  profilePictureUrl: string;
}
```

is equivalent to:

```typespec
model User {
  @raises(InvalidURLError)
  @handles(PermissionDeniedError)
  profilePictureUrl: string;
}
```

<br>

### Error inheritance

Most languages have a way to specify that an error type inherits from another error type.

For the purposes of discussion, let's imagine we have a base error type `GenericError` and two errors that extend it: `NotFoundError` and `PermissionDeniedError`.

#### Error inheritance + `@handles` decorator

Error handling is often performed generically based on a base error type,
allowing the developer to handle errors that were not known at the time of writing the code.

Therefore when an error is specified in the `@handles` decorator, and there are additional errors that `extend` from it,
those errors will also be considered as handled.

For example, if we were to specify that `getUser()` handles `GenericError`,
we are also specifying that it will handle `NotFoundError` and `PermissionDeniedError` as well as any other error that extends `GenericError`.

```typespec
@error
model GenericError {
  message: string;
}

@error
model NotFoundError extends GenericError {}

@error
model PermissionDeniedError extends GenericError {}

@handles(GenericError)
op getUser(id: string): User;
```

This definition states that the protocol-specific behavior implied by the `@handles(GenericError)` decorator will also apply to `NotFoundError` and `PermissionDeniedError`.

#### Error inheritance + `@raises` decorator

The inheritance described above for `@handles` does _not_ apply to the `@raises` decorator.

If a property is decorated with `@raises(GenericError)`,
it is not implying anything about whether the property can raise `NotFoundError` or `PermissionDeniedError`,
even though those errors extend from `GenericError`.

In other words, given the following:

```typespec
model Profile {
  @raises(GenericError)
  profilePictureUrl: string;
}

model User {
  @handles(NotFoundError, PermissionDeniedError)
  profile: Profile;
}
```

We would still consider `GenericError` to be a possible error at `User.profile` —  it is not handled by the `@handles` decorator.

Conversely, if a property is decorated with `@raises(NotFoundError)`, it is not considered to be decorated with `@raises(GenericError)`.

It follows that a `@raises` decorator can contain multiple errors that form an inheritance hierarchy — i.e. this is not redundant.

```typespec
model Profile {
  @raises(NotFoundError, PermissionDeniedError, GenericError)
  profilePictureUrl: string;
}
```

When combined with the `@handles` decorator, any error that is not covered by its own type or a supertype is considered unhandled.

```typespec
model User {
  @handles(NotFoundError, PermissionDeniedError)
  profile: Profile;
}
```

The above example suggests that `User.profile` will not raise `NotFoundError` or `PermissionDeniedError`, but it may raise any other type of `GenericError`.

This approach aligns with the idea that error documentation should be explicit about which errors may occur at a given property, while allowing for more flexible handling in `@handles`.

<br>

## Use in request input

The `@raises` and `@handles` decorators apply equally to input as they do to output.
Just as these decorators allow developers to model and handle errors that may occur when accessing properties in a server's response, they can also be used to model and handle errors that arise when processing client-provided input.
The mechanics of how these decorators are applied and how they affect the emitted document(s) remain consistent between input and output.

<br>

### `@raises` for Input Validation Errors

When applied to model properties used on input, the `@raises` decorator specifies the errors that may occur during the validation or processing of client-provided data.
For example, an input model for creating a user might specify that the `email` field can produce `InvalidEmailError` or `MissingFieldError`, while the `password` field can produce `InvalidPasswordError`:

```typespec
model CreateUserRequest {
  @raises(InvalidEmailError, MissingFieldError)
  email: string;

  @raises(InvalidPasswordError)
  password: string;
}
```

These errors are generated by the server in response to invalid or incomplete input provided by the client.
This is conceptually different from output errors, which are typically generated by the server's internal logic or data access operations.

<br>

### `@handles` for Input-Level Error Handling

The `@handles` decorator can be used to specify which input-related errors are handled by the [operation](#operation) itself, preventing them from being propagated to the client.
For example, an [operation](#operation) to create a user might handle `InvalidEmailError` internally while allowing other errors to propagate:

```typespec
@handles(InvalidEmailError)
op createUser(request: CreateUserRequest): User | GenericError;
```

This behavior mirrors how `@handles` is used for output errors, allowing developers to control which errors are exposed via a [protocol error](#protocol-error) and which are handled internally.

### A note on context modifiers

Through the [visibility system][visibility-system], we know that a single model property may be both an input and an output property.

It may indeed be the case that some errors are only relevant to the property when it is used as an input, while others are only relevant when it is used as an output, while still others may be relevant in both contexts.

The suggestion for the developer is to err on the side of caution and specify both input and output errors in the `@raises` decorator.
This may cause some unnecessary error handling in clients, but this is preferable to unexpected errors.

For a more nuanced approach, we can consider applying [context modifiers](#context-modifiers) to errors.

<br>

## Implementations and Use Cases

Below we list some proposed implementations in various emitter targets.
These are meant to be illustrative of the effects of the `@raises` and `@handles` decorators,
and are not proposing any of the specific syntax or implementation shown below.

### HTTP/REST/OpenAPI

In a typical HTTP/REST API where [operations](#operation) are represented by endpoints,
the `@raises` decorator can provide more accurate [return type](#return-type)s for [operations](#operation) that contain properties that may fail.

In a larger API, it may be quite difficult to track all the errors that can occur within an [operation](#operation) when the errors can be generated by many different layers of an API stack.
The `@raises` decorator helps give the developer a more complete view of the errors that an [operation](#operation) can produce.

Let's say we have this definition of models:

```typespec
import "@typespec/http";
using Http;

@error
model GenericError {
  message: string;
}

model User {
  @key id: string;
  profilePictureUrl: string;
}
```

Now we define an [operation](#operation) that uses the `User` model:

```typespec
@route("/user/{id}")
@get
op getUser(@path id: string): User | GenericError;
```

This will produce the following OpenAPI:

<details open><summary><em>Click to collapse</em></summary>

```yaml
paths:
  /user/{id}:
    get:
      operationId: getUser
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: The request has succeeded.
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/User"
        default:
          description: An unexpected error response.
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/GenericError"
```

</details>

<br>

#### Using `@raises` decorator

With the `@raises` decorator, we can specify that the `profilePictureUrl` property may produce errors when accessed:

```typespec
@error
model NotFoundError extends GenericError {
  @statusCode _: 404;
}

@error
model PermissionDeniedError extends GenericError {
  @statusCode _: 403;
}

@error
model InvalidURLError extends GenericError {
  @statusCode _: 500;
}

model User {
  @key id: string;

  @raises(NotFoundError, PermissionDeniedError, InvalidURLError)
  profilePictureUrl: string;
}
```

Since the `User` model is used in the `getUser()` operation,
the operation schema in the generated OpenAPI will now include the possible errors that can occur when accessing the `profilePictureUrl` property:

<details open><summary><em>Click to collapse</em></summary>

```yaml
paths:
  /user/{id}:
    get:
      operationId: getUser
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: The request has succeeded.
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/User"
        "403":
          description: Access is forbidden.
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/PermissionDeniedError"
        "404":
          description: The server cannot find the requested resource.
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/NotFoundError"
        "500":
          description: Server error
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/InvalidURLError"
        default:
          description: An unexpected error response.
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/GenericError"
```

</details>

The definition of `getUser()` has not changed, but it is now emitted _as if_ the [return type](#return-type) was

```typespec
User | NotFoundError | PermissionDeniedError | InvalidURLError | GenericError;
```

To implement this, the OpenAPI emitter could take advantage of [TypeSpec compiler support](#compiler-support-for-propagating-errors-to-operations) to propagate errors from model properties to the [operation](#operation)'s [return type](#return-type).

<br>

#### Using `@handles` decorator

Perhaps our `getUser()` [operation](#operation) is designed to handle the `InvalidURLError` error, while other [operations](#operation) may not do so.
We can use the `@handles` decorator to specify that this [operation](#operation) will handle that error:

```typespec
@route("/user/{id}")
@get
@handles(InvalidURLError)
op getUser(@path id: string): User | GenericError;
```

Now, despite the presence of a `User.profilePictureUrl` property that may produce an `InvalidURLError`,
the OpenAPI will not include it in the list of possible errors for the `getUser()` operation:

<details open><summary><em>Click to collapse</em></summary>

```yaml
paths:
  /user/{id}:
    get:
      operationId: getUser
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: The request has succeeded.
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/User"
        "403":
          description: Access is forbidden.
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/PermissionDeniedError"
        "404":
          description: The server cannot find the requested resource.
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/NotFoundError"
        default:
          description: An unexpected error response.
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/GenericError"
```

</details>

This is not limited to the `profilePictureUrl` property.
Any property that is decorated with `@raises(InvalidURLError)` and is used in the `getUser()` [operation](#operation) will no longer add `InvalidURLError` to the list of possible errors for the operation.

<br>

### GraphQL

In GraphQL, errors are typically propagated through the [`errors` key in the response][graphql-errors]:

<details open><summary><em>Click to collapse</em></summary>

```json
{
  "data": {
    "user": null
  },
  "errors": [
    {
      "message": "User not found",
      "locations": [{ "line": 2, "column": 3 }],
      "path": ["user"],
      "extensions": {
        "code": "NOT_FOUND",
        "exception": { "stacktrace": [...] }
      }
    }
  ]
}
```

</details>

Since an error can occur within any GraphQL resolver,
we need a way to associate errors with anything that can have a resolver — which is any operation or model property.

To represent this complexity with current TypeSpec concepts, we would perhaps need to modify the value type of the field to be a union type that includes the error type.
However, this would change the shape of the TypeSpec API description to accommodate a specific protocol's error handling pattern.
Other protocols like OpenAPI would now inaccurately document that the field's value can be an error type, which is unlikely to be true in practice.

Using the `@raises` decorator on model properties avoids this and enhances the ability of the TypeSpec document to emit multiple protocols.

#### Propagation and "Errors as Data"

Some GraphQL schemas use the ["errors as data" pattern][errors-as-data],
where errors are included in the possible value of a field using union types.
In this case, the `@raises` decorator can be used to specify which errors must be included in that union type.

The forthcoming [GraphQL emitter][graphql-emitter] will include additional decorators that can be applied to error models,
similar to `@typespec/http`'s [`@statusCode` decorator][statuscode-decorator].
These decorators can be used to customize how errors in a `@raises` decorator are emitted in the GraphQL schema.

For example, a `@propagate` decorator could be used to indicate that an error type, if produced, should be propagated to parent fields.
In GraphQL, this is accomplished by making a field type non-nullable — meaning that if a value cannot be produced for that field (due to an error),
the error will be bubble up through parent fields, stopping at the first field which is nullable.

A `@asData` decorator could be used to indicate that an error type should be included in the ["errors as data" pattern][errors-as-data].
This allows a GraphQL schema to opt-in to using this pattern for specific errors,
while still allowing other errors (e.g. unexpected server errors) to be propagated normally.

The `@handles` decorator can also be used in GraphQL to specify that a field resolver will handle certain types of errors.
Specifying an error in the `@handles` decorator will:

- omit the error from the union [return type](#return-type), if the error has the `@asData` decorator.
- prevent the error from triggering non-nullability of the field type, if the error has the `@propagate` decorator.
  The field may still be marked non-null through other errors or other means.

#### Example

This example shows all of the above in action:

<details open><summary><em>Click to collapse</em></summary>

```typespec
import "@typespec/graphql";
using GraphQL;

@error
@GraphQL.interface
model ServerError {
  message: string;
}

@error
@GraphQL.asData
@GraphQL.interface
model ClientError {
  message: string;
}

@error
@GraphQL.asData
@doc("The resource is not found.")
model NotFoundError extends ClientError {
  message: string = "Not found";
}

@error
@doc("The user does not have permission to access the resource.")
model PermissionDeniedError extends ClientError {
  message: string = "Permission denied";
}

enum Service {
  SERVICE_A,
  SERVICE_B,
}

@error
@GraphQL.propagate
@doc("A timeout occurred while waiting for a response from an upstream service.")
model UpstreamTimeoutError extends ServerError {
  service: Service; // the service that timed out
}

@error
@GraphQL.propagate
@doc("A race condition occurred.")
model RaceConditionError extends ServerError {}

@doc("Mark this entry as seen")
op markAsSeen(seen: boolean): boolean | RaceConditionError;

@GraphQL.operationFields(markAsSeen)
model ActivityEntry {
  @raises(PermissionDeniedError) ipAddress?: string;
}

// In GraphQL, fields can take arguments.
// These are specified like [operations](#operation) in TypeSpec.
@doc("Users following this user")
@handles(RaceConditionError) op followers(type?: string): User[];

@GraphQL.operationFields(followers)
model User {
  @raises(NotFoundError, PermissionDeniedError) profilePictureUrl: string;

  @doc("A log of the user's activity")
  @raises(UpstreamTimeoutError) activity: ActivityEntry[];
}
```

</details>

This could result in the following GraphQL:

<details open><summary><em>Click to collapse</em></summary>

```graphql
interface ClientError {
  message: String
}

interface ServerError {
  message: String
}

type NotFoundError implements ClientError {
  """
  The resource is not found.
    * This error appears in union responses.
  """
  message: String
}

type PermissionDeniedError implements ClientError {
  """
  The user does not have permission to access the resource.
  """
  message: String
}

enum Service {
  SERVICE_A
  SERVICE_B
}

type UpstreamTimeoutError implements ServerError {
  """
  A timeout occurred while waiting for a response from an upstream service.
    * This error is propagated to the parent field.
  """
  message: String
  service: Service
}

union UserProfilePictureUrlResponse =
  | String
  | NotFoundError # NotFoundError is `@asData`, so it's added to the union
  | ClientError # PermissionDeniedError does not use `@asData`, but it extends from ClientError which does

type User {
  """
  A log of the user's activity
  * this field is non-null because it `@raises(UpstreamTimeoutError)` (which propagates)
  """
  activity: [ActivityEntry!]!

  """
  Users following this user
  * this field is nullable because even though User.activity[].markAsSeen will propagate a RaceConditionError, followers `@handles(RaceConditionError)`
  """
  followers(type: String): [User!]

  profilePictureUrl: UserProfilePictureUrlResponse
}

union ActivityEntryIpAddressResponse = String | ClientError # PermissionDeniedError does not use `@asData`, but it extends from ClientError which does
type ActivityEntry {
  ipAddress: ActivityEntryIpAddressResponse

  """
  Mark this entry as seen
  * this field is non-null because it has RaceConditionError (which propagates) in its [return type](#return-type)
  """
  markAsSeen(seen: Boolean!): Boolean!
}
```

</details>

<br>

### Protocol Buffers (Protobuf)

Protocol Buffers (Protobuf) is a language-neutral, platform-neutral mechanism for serializing structured data.
While Protobuf itself does not have a built-in concept of errors, the `@raises` and `@handles` decorators can be used to model and document errors in TypeSpec, which can then be translated into Protobuf-compatible patterns.
Different patterns for communicating errors in Protobuf can be expressed using additional TypeSpec decorators.

#### Using `@raises` with Protobuf

The `@raises` decorator can be used to specify errors that may occur when accessing a property.
These errors can be represented in Protobuf by defining separate message types for each error and including them in a `oneof` field in the response message.

To implement this, the Protobuf emitter could take advantage of [TypeSpec compiler support](#compiler-support-for-propagating-errors-to-operations) to propagate errors from model properties to the [operation](#operation)'s [return type](#return-type).

For example:

<details open><summary><em>Click to collapse</em></summary>

```typespec
@error
@oneOfError
model NotFoundError {
  message: string;
}

@error
@oneOfError
model PermissionDeniedError {
  message: string;
}

model User {
  @raises(NotFoundError, PermissionDeniedError)
  profilePictureUrl: string;
}

op getUser(@path id: string): User;
```

</details>

This could be translated into the following Protobuf schema:

<details open><summary><em>Click to collapse</em></summary>

```proto
message NotFoundError {
  string message = 1;
}

message PermissionDeniedError {
  string message = 1;
}

message User {
  string profilePictureUrl = 1;
}

message GetUserResponse {
  oneof result {
    User user = 1;
    NotFoundError not_found_error = 2;
    PermissionDeniedError permission_denied_error = 3;
  }
}

service UserService {
  rpc GetUser(GetUserRequest) returns (GetUserResponse);
}

message GetUserRequest {
  string id = 1;
}
```

</details>

#### Using gRPC Status Codes

When using Protobuf with gRPC, errors are often communicated using gRPC's built-in status codes and error details.
These could be expressed in TypeSpec using a `@statusCode` decorator from a gRPC library, along with a generic `Error` model in the [operation](#operation)'s [return type](#return-type).

<details open><summary><em>Click to collapse</em></summary>

```typespec
@error
model Error {
  code: gRPC.StatusCode;
  message: string;
}

@error
model NotFoundError extends Error {
  code: gRPC.StatusCode.NOT_FOUND;
}

model User {
  @raises(NotFoundError) profilePictureUrl: string;
}

op getUser(@path id: string): User | Error;
```

</details>

This could be translated into the following Protobuf schema:

<details open><summary><em>Click to collapse</em></summary>

```proto
message Error {
  GrpcStatusCode code = 1;
  string message = 2;
}

message User {
  string profilePictureUrl = 1;
}

message GetUserResponse {
  oneof result {
    User user = 1;
    Error error = 2;
  }
}

service UserService {
  rpc GetUser(GetUserRequest) returns (GetUserResponse);
}

message GetUserRequest {
  string id = 1;
}
```

</details>

<br>

### Apache Thrift

Apache Thrift supports defining exceptions as part of its IDL (Interface Definition Language),
which makes it well-suited for modeling error using the `@raises` and `@handles` decorators.

#### Using `@raises` with Thrift

Exceptions specified by `@raises` can be represented in Thrift by defining exception types and including them in the `throws` clause of a service method.

For example:

<details open><summary><em>Click to collapse</em></summary>

```typespec
@error
model NotFoundError {
  message: string;
}

@error
model PermissionDeniedError {
  message: string;
}

model User {
  @raises(NotFoundError, PermissionDeniedError)
  profilePictureUrl: string;
}

op getUser(@path id: string): User;
```

</details>

This could be translated into the following Thrift IDL:

<details open><summary><em>Click to collapse</em></summary>

```thrift
exception NotFoundError {
  1: string message;
}

exception PermissionDeniedError {
  1: string message;
}

struct User {
  1: string profilePictureUrl;
}

service UserService {
  User getUser(1: string id) throws (
    1: NotFoundError notFoundError,
    2: PermissionDeniedError permissionDeniedError
  );
}
```

</details>

To implement this, the Thrift emitter could take advantage of  [TypeSpec compiler support](#compiler-support-for-propagating-errors-to-operations) to propagate errors from model properties to the [operation](#operation)'s [return type](#return-type).

#### Using `@handles` with Thrift

The `@handles` decorator can be used to specify which exceptions are handled internally by an [operation](#operation) or property.
In Thrift, this can be reflected by omitting the handled exceptions from the `throws` clause of the service method.

For example:

```typespec
@handles(PermissionDeniedError)
op getUser(@path id: string): User;
```

If `PermissionDeniedError` is handled internally, the Thrift IDL would look like this:

```thrift
service UserService {
  User getUser(1: string id) throws (
    1: NotFoundError notFoundError
  );
}
```

<br>

### Client libraries

Client libraries should leverage language-specific constructs to represent fields or [operations](#operation) that may produce errors.
For example, in languages with an error monad or result monad, such as Kotlin or Swift,
these constructs should be used to represent fields decorated with `@raises` or [operations](#operation) decorated with `@handles`.

#### Example: Kotlin

In Kotlin, the `Result` type or sealed classes can be used.
For example:

<details open><summary><em>Click to collapse</em></summary>

```kotlin
sealed class Error {
    object NotFound : Error()
    object PermissionDenied : Error()
    object InvalidUrl : Error()
}

data class User(
    val id: String,
    val profilePictureUrl: Result<String> // Field with @raises decorator
)

fun getUser(id: String): Result<User> {
    // Operation with @handles decorator
    if (id.isEmpty()) {
        return Result.failure(Error.NotFound)
    }
    return Result.success(
        User(
            id = id,
            profilePictureUrl = Result.failure(Error.PermissionDenied)
        )
    )
}
```

</details>

This approach ensures that clients handle errors in a type-safe and idiomatic way.

#### Example: Swift

In Swift, the `Result` type can be used to represent fields or [operations](#operation) that may fail.
For example:

<details open><summary><em>Click to collapse</em></summary>

```swift
enum Error: Swift.Error {
    case notFound
    case permissionDenied
    case invalidUrl
}

struct User {
    let id: String
    let profilePictureUrl: Result<String, Error> // Field with @raises decorator
}

func getUser(id: String) -> Result<User, Error> {
    // Operation with @handles decorator
    if id.isEmpty {
        return .failure(.notFound)
    }
    return .success(
        User(
            id: id,
            profilePictureUrl: .failure(.permissionDenied)
        )
    )
}
```

</details>

This approach ensures that clients handle errors in a type-safe and idiomatic way.

<br>

### Server libraries

Server libraries should generate code that includes appropriate error handling stubs.
For example, in languages with an error monad or result monad,
these constructs should be used to represent fields or [operations](#operation) that may produce errors.
This allows server implementations to handle errors explicitly and propagate them as needed.

#### Example: Scala

In Scala, the `Either` type can be used to handle errors for fields and operations:

<details open><summary><em>Click to collapse</em></summary>

```scala
sealed trait Error
case object NotFound extends Error
case object PermissionDenied extends Error
case object InvalidUrl extends Error

case class User(id: String, profilePictureUrl: Either[Error, String]) // Field with @raises decorator

def getUser(id: String): Either[Error, User] = {
  // Operation with @handles decorator
  if (id.isEmpty) {
    Left(NotFound)
  } else {
    Right(User(id, Left(PermissionDenied)))
  }
}
```

</details>

This approach ensures that server-side logic is clear and errors are propagated or handled as needed.

#### Example: Rust

In Rust, the `Result` type can be used to handle errors for fields and operations:

<details open><summary><em>Click to collapse</em></summary>

```rust
fn resolve_profile_picture_url(user_id: &str) -> Result<String, Error> {
    // Simulate a permission check
    if user_id == "restricted" {
        return Err(Error::PermissionDenied);
    }
    Ok("https://example.com/profile.jpg".to_string())
}

fn get_user_handler(id: &str) -> Result<User, Error> {
    let user = User {
        id: id.to_string(),
        profile_picture_url: resolve_profile_picture_url(id),
    };
    Ok(user)
}
```

</details>

Here, the server explicitly handles errors when resolving the `profile_picture_url` field.

<br>

## Real-world Use Cases

**Note:** While Pinterest's immediate need is GraphQL,
patterns that require similar nuance in error handling appear across multiple domains.

This section is meant to demonstrate a few areas in real-world use where this proposal allows a new kind of error handling that is not currently possible.
Some may be more esoteric and/or speculative than others, but the goal is to explore a wide spectrum of use cases.

<br>

### Azure Logic Apps

Azure Logic Apps represents a compelling use case for field-level error handling specifications.
Logic Apps workflows consist of multiple actions that can fail independently, with subsequent actions configured to handle specific failure types through ["run after"][run-after] settings.

Logic Apps uses execution states rather than semantic errors.
Actions can result in `Failed`, `Skipped`, `TimedOut`, or `Successful` states, and subsequent actions can be configured to run after specific combinations of these states.

Consider a workflow that retrieves user data and processes it through multiple services:

```typespec
// Logic Apps execution states
@error model Failed { reason: string; }
@error model TimedOut { duration: int32; }
@error model Skipped { condition: string; }

model UserProfileData {
  @raises(Failed, TimedOut) // getUserInfo action might fail or timeout
  basicInfo: UserInfo;
  
  @raises(Skipped, TimedOut) // getSocialLinks action might be skipped or timeout  
  socialMediaLinks: SocialLinks;
  
  @raises(Failed) // getProfileImage action might fail
  profileImage: ImageData;
}

@handles(Failed) // Configure "run after: Failed"
op createDefaultProfile(userData: UserProfileData): UserProfile;

@handles(TimedOut) // Configure "run after: TimedOut"  
op retryWithBackoff(userData: UserProfileData): UserProfile;

@handles(Failed, TimedOut) // Configure "run after: Failed, TimedOut"
op logErrorAndContinue(userData: UserProfileData): void;
```

This TypeSpec definition maps to Logic Apps execution state patterns:

- **`@raises` decorators** specify which execution states individual actions can produce
- **`@handles` decorators** correspond to "run after" configurations that execute subsequent actions based on specific execution states
- **Multiple state handling** allows actions to run after combinations of states (e.g., both Failed and TimedOut)

When generating Logic Apps workflow definitions from TypeSpec, an emitter could:

1. **Generate appropriate "run after" configurations** based on `@handles` decorators
2. **Create conditional logic** that routes workflow execution based on action states
3. **Implement retry and error handling patterns** based on the specified execution states
4. **Generate monitoring and alerting** for specific failure patterns

This approach could enable Logic Apps developers to model execution state handling in TypeSpec and generate robust workflows with proper conditional routing based on action outcomes.

<br>

### Netflix-style Circuit Breaker Patterns

Microservices architectures use circuit breakers for individual service calls,
where different fields require different fallback strategies based on business criticality.

```typespec
@error model CriticalError {}
@error model NonCriticalError {}

@error model RecommendationServiceError extends NonCriticalError {}
@error model BillingServiceError extends CriticalError {}
@error model WatchHistoryError extends NonCriticalError {}

model UserDashboard {
  @raises(RecommendationServiceError) // Can fallback to cached recommendations
  personalizedContent: Content[];
  
  @raises(BillingServiceError) // Critical - must show billing errors
  accountStatus: AccountStatus;
  
  @raises(WatchHistoryError) // Can fallback to empty state
  recentlyWatched: Video[];
}

@handles(NonCriticalError) // Handle non-critical failures
op getDashboardWithFallbacks(userId: string): UserDashboard;
```

This pattern allows critical errors (billing issues) to propagate while gracefully handling non-critical failures (recommendations, watch history) through fallbacks or cached data.

<br>

### E-commerce: Partial Product Data

E-commerce platforms need to handle partial product availability where inventory, pricing, and content management systems can fail independently.

```typespec
model ProductPage {
  @raises(InventoryServiceError) // Inventory might be temporarily unavailable
  stockStatus: StockInfo;
  
  @raises(PricingServiceError) // Pricing service might be updating
  currentPrice: Price;
  
  @raises(ContentServiceError) // CMS might be down
  productDescription: string;
}

@handles(InventoryServiceError) // Show "availability unknown" instead of failing
op getProductPageWithDefaults(productId: string): ProductPage;
```

This enables platforms like Shopify to show "availability unknown" or cached pricing when specific services are down,
rather than showing broken product pages.

<br>

### Content Management Systems: Progressive Enhancement

CMS platforms where page components can fail independently but the page should still render with graceful degradation.

```typespec
model WebPage {
  @raises(CDNError) // Images might not load
  heroImage: ImageUrl;
  
  @raises(DatabaseError) // Content might be temporarily unavailable  
  mainContent: RichText;
  
  @raises(APIRateLimitError) // Social feeds might be rate-limited
  socialFeed: SocialPost[];
}

@handles(CDNError, APIRateLimitError) // Show placeholders for non-critical content
op renderPageWithDefaults(pageId: string): WebPage;
```

This enables progressive enhancement patterns where critical content (main text) failures propagate as errors, while non-critical elements (images, social feeds) show placeholders or cached content.

<br>

## Phased Implementation Approach

We suggest implementation of this proposal follow a two-phase approach to allow for community feedback and refinement before finalizing the design.

**Phase 1 (Experimental):**
- Implement `@raises` and `@handles` decorators
- Mark as `@experimental` in TypeSpec core
- Ship Pinterest GraphQL emitter as reference implementation
- Add support in the OpenAPI emitter (needed by Pinterest)
- Gather community feedback

**Phase 2 (Stable):**
- Refine based on real-world usage
- Add context modifiers if validated by community needs
- Remove experimental status
- Adopt in other emitters

<br>

## Additional Considerations

The following should be considered as future enhancements to enhance interaction with the `@raises` and `@handles` decorators.

### TypeSpec Compiler support for propagating errors to operations

It will be a common case for a protocol to want to "propagate" the errors specified by `@raises` and `@handles` decorators with the errors specified in the [operation](#operation)'s [return type](#return-type).

To make this easier, the TypeSpec compiler may include functionality to merge the error specification defined by `@raises` and `@handles` decorators into the [operation](#operation)'s [return type](#return-type).

Looking at the following example:

```typespec
model Profile {
  @raises(InvalidURLError, PermissionDeniedError)
  profilePictureUrl: string;
}

model User {
  @raises(NotFoundError)
  @handles(PermissionDeniedError)
  profile: Profile;
}

@handles(NotFoundError, PrivateProfileError)
op getUser(id: string): User | GenericError | PrivateProfileError;
```

Some functionality in the TypeSpec compiler — let's call it `getOperationErrors()` — would a `getUser` operation type with the following signature:

```typespec
op getUser(id: string): User | GenericError | InvalidURLError | PrivateProfileError;
```

Note the compiler has combined the return type with errors that were present in `@raises` decorators and not `@handles` decorators.
In this case, that means the return type consists of:
- `User`, as defined in `getUser()`'s return type
- `GenericError`, as defined in `getUser()`'s return type
- `InvalidURLError`, as defined in `Profile`'s `@raises` decorator and not in an applicable `@handles` decorator
- `PrivateProfileError`, as defined in `getUser()`'s return type. This follows [the precedence rule between `@raises` and `@handles`](#raises--handles-decorator) as if the error in the return type is an implicit `@raises` decorator.
- *not* `PermissionDeniedError`, as it is handled by `User.profile`
- *not* `NotFoundError`, as it is handled by `getUser()`

<br>

<a name="context-modifiers"></a>

### Future Enhancement: Context Modifiers

**Note:** This is explicitly NOT part of the initial proposal.
Adding context modifiers to errors introduces additional complexity, similar to the [visibility system][visibility-system].
We propose implementing the core `@raises`/`@handles` functionality first, then evaluating whether context modifiers are needed based on real usage patterns.

As an optional enhancement, we propose extending the [`@error` decorator][error-decorator] to include an argument for specifying [context (visibility) modifiers][visibility-system].
This would allow developers to explicitly indicate the contexts in which an error applies, such as input validation, output handling, or both.
This enhancement would provide additional clarity and flexibility when modeling errors.


#### Proposed Definition

The `@error` decorator would accept an optional argument specifying one or more visibility enums.

````typespec
/**
 * Specify that this model is an error type. Operations return error types when the [operation](#operation) has failed.
 *
 * @param contexts The list of contexts in which this error applies. This can be used to indicate whether the error is relevant for input, output, or both.
 *
 * @example
 * ```typespec
 * @error(Lifecycle.Create, Lifecycle.Update)
 * model PetStoreError {
 *   code: string;
 *   message: string;
 * }
 * ```
 */
extern dec error(target: Model, ...contexts: valueof EnumMember[]);
````

For example:

```typespec
@error(Lifecycle.Create, Lifecycle.Update)
model InvalidEmailError {
  message: string;
}

@error(Lifecycle.Read)
model PermissionDeniedError {
  message: string;
}
```

Here, `Lifecycle.Create` and `Lifecycle.Update` indicate that `InvalidEmailError` applies in input contexts (e.g., when creating or updating a resource), while `Lifecycle.Read` indicates that `PermissionDeniedError` applies in output contexts (e.g., when reading a resource).

Libraries and emitters should interpret context modifiers, when applied to error models, to determine what errors should be included in different contexts.
This mirrors the [visibility system][visibility-system], and libraries and emitters should interpret the context modifiers the same way as they already do for visibility.

#### Examples

The following examples illustrate how the context modifiers can be used in practice.

##### Input Contexts

By default, errors with `Lifecycle.Create`, `Lifecycle.Update`, or `Lifecycle.Delete` are included when the model is used as a parameter in the respective context.

<details open><summary><em>Click to collapse</em></summary>

```typespec
@error(Lifecycle.CREATE, Lifecycle.UPDATE)
model InvalidEmailError {
  message: string;
}

model User {
  @key id: string;

  @visibility(Lifecycle.Create, Lifecycle.Update, Lifecycle.Read)
  @raises(InvalidEmailError)
  email: string;
}

op getUser(id: string): User | UserNotFound; // returns email field in response, will not raise InvalidEmailError 

op createUser(...User): User; // returns email field in response, can raise InvalidEmailError

op deleteUser(id: string): User; // does not return email field in response, will not raise InvalidEmailError
```

</details>

##### Output Contexts

By default, errors with `Lifecycle.Read` are included when the model is used in an output context.

```typespec
op getUser(id: string): User | PermissionDeniedError | GenericError;
```

##### Both Contexts

Errors can apply to both input and output contexts by specifying multiple lifecycle stages.

```typespec
@error(Lifecycle.Create, Lifecycle.Read)
model GenericError {
  message: string;
}
```

##### No contexts

Just as is true for visibility, if no context is specified, the error model [will be included in all of the default context modifiers][default-visibility] applied by default by the visibility class.

#### Context follows visibility

There are a number of ways to modify the visibility of a model or operation. Context modifiers, as applied to errors, will follow the same rules as they do for visibility.

For example, use of the [`@parameterVisibility`][parameter-visibility] or [`@returnTypeVisibility`][return-type-visibility] decorators will modify the visibility of the error model in the same way as it does for parameters. That is, the properties of a model used as a parameter will apply their `@raises` errors based on the visibility of parameters. The properties of a model used as a [return type](#return-type) will apply their `@raises` errors based on the visibility of the [return type](#return-type).

This also means that decorators which apply implicit visibility, such as [`@post`][post-decorator] or [`@put`][put-decorator], will apply the implicit visibility of the [operation](#operation) to the error model.

Any other modification of visibility including visibility filters, custom context classes, et. al. should affect errors in the same way as they affect model properties.

#### Rejected alternative: Context modifiers on `@raises` and `@handles`

An alternative to adding context modifiers to the `@error` decorator is to add them to the `@raises` and `@handles` decorators.

This would allow developers to specify the context in which an error applies model property by model property, rather than applying to an error model everywhere it appears.

Such an alternative approach might look something like:

```typespec
model User {
  @key id: string;

  @visibility(Lifecycle.Create, Lifecycle.Update, Lifecycle.Read)
  @raises([InvalidEmailError], [Lifecycle.Create, Lifecycle.Update])
  email: string;
}
```

While this approach does allow for finer granularity in specifying the context in which an error applies, it also adds complexity to the `@raises` and `@handles` decorators — and complexity for the developer to reason about the context in which an error applies.
Applying context modifiers to the `@error` decorator abstracts the concerns of context away from any particular field or operation, so the developer does not always need to be considering it.
It seems fairly intuitive for a developer to specify that an `InvalidParametersError` would only apply in input contexts, while a `PermissionDeniedError` would only apply in output contexts.

If context modifiers are specified on the `@raises` and `@handles` decorators, it is likely that the developer forgets to add all of the relevant lifecycle modifiers in some cases.
This would result in [operations](#operation) insufficiently specifying errors, leading to clients receiving errors that they do not expect from the spec.

By contrast, adding context modifiers to the `@error` decorator is more likely to add errors in more contexts than are needed; while not ideal, specifying extra errors in the spec that will never be returned is less problematic than omitting errors that will be.
Indeed, there's no guarantee that _any_ error specified ever actually will be.

<br>

### Identifying Unused Error Handlers

TypeSpec only knows, and can only reason about, errors that are specified in a `@raises` decorator.
If an error is specified in a `@handles` decorator but not in any `@raises` decorator of all the model properties that are part of that property or operation, the TypeSpec compiler will not be able to determine whether the error is actually used.

To help developers make that determination, the TypeSpec compiler can issue a warning when this scenario occurs.
If the developer determines that the error _is_ thrown outside of the context of TypeSpec, they can use the standard [`# suppress` directive][suppress-directive] to suppress the warning.

This warning helps to avoid misleading consumers about an error type that may not actually occur.

#### Example: Unused Error Handler

Consider the following example:

```typespec
@error
model NotFoundError {
  message: string;
}

@error
model PermissionDeniedError {
  message: string;
}

model User {
  @raises(NotFoundError)
  profilePictureUrl: string;
}

@handles(PermissionDeniedError)
op getUser(id: string): User | NotFoundError;
```

In this example, the `getUser` [operation](#operation) specifies that it handles `PermissionDeniedError` using the `@handles` decorator.
However, none of the properties or [operations](#operation) used in `getUser` (in this case, just the `User.profilePictureUrl` property) specify `PermissionDeniedError` in their `@raises` decorators.

As a result, the TypeSpec compiler will issue a warning.

#

[typespec-operation]: https://typespec.io/docs/language-basics/operations/
[error-decorator]: https://typespec.io/docs/standard-library/built-in-decorators/#@error
[operations]: https://typespec.io/docs/language-basics/operations/
[operations-return-type]: https://typespec.io/docs/language-basics/operations/#return-type
[graphql-errors]: https://graphql.org/learn/response/#errors
[errors-as-data]: https://www.apollographql.com/docs/graphos/schema-design/guides/errors-as-data-explained
[graphql-emitter]: https://github.com/microsoft/typespec/issues/4933
[statuscode-decorator]: https://typespec.io/docs/libraries/http/reference/decorators/#@TypeSpec.Http.statusCode
[visibility-system]: https://typespec.io/docs/language-basics/visibility/
[suppress-directive]: https://typespec.io/docs/language-basics/directives/#suppress
[parameter-visibility]: https://typespec.io/docs/standard-library/built-in-decorators/#@parameterVisibility
[return-type-visibility]: https://typespec.io/docs/standard-library/built-in-decorators/#@returnTypeVisibility
[post-decorator]: https://typespec.io/docs/libraries/http/reference/decorators/#@TypeSpec.Http.post
[put-decorator]: https://typespec.io/docs/libraries/http/reference/decorators/#@TypeSpec.Http.put
[default-visibility]: https://typespec.io/docs/language-basics/visibility/#basic-concepts
[run-after]: https://learn.microsoft.com/en-us/azure/logic-apps/error-exception-handling#manage-the-run-after-behavior
