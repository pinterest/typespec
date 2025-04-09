# Proposal: Expressing Model Property Error Handling

This proposal suggests adding two new decorators to the TypeSpec standard library:

- `@throws` decorator: This decorator is used to specify that the use of a model property may result in specific errors being produced.
- `@handles` decorator: This decorator is used to specify that an operation or property will handle certain types of errors, preventing them from being propagated.

It also proposes updating existing emitters to support these new decorators.

<br>

## Goals

1. Provide a way for TSP developers to document errors associated with a particular model property.
2. Provide spec emitters with information that can be used to update the set of operation errors based on the models in use, and the error handling of the operation.
3. Allow code emitters to generate code that expects and handles these errors appropriately.

<br>

## Definitions

### `@throws` decorator

````typespec
/**
 * Specify that the use of this property may result in specific errors being produced.
 *
 * @param errors The list of error models that may be produced when using this property.
 *
 * @example
 *
 * ```typespec
 * model User {
 *   @throws(NotFoundError, PermissionDeniedError, InvalidURLError)
 *   profilePictureUrl: string;
 * }
 * ```
 */
extern dec throws(target: ModelProperty, ...errors: Model[]);
````

The decorator can be applied to model properties.
It specifies that any operation or context using the decorated property may produce the listed errors.
This allows consumers to anticipate and handle these errors appropriately.

The `errors` parameter is a list of models that represent the possible errors that can be thrown.
Each model must be decorated with the [`@error` decorator][error-decorator].

<br>

### `@handles` decorator

````typespec
/**
 * Specify that this operation or model property will handle certain types of errors.
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

The decorator can be applied to operations or model properties.
It specifies that the operation or model property will handle the listed errors, preventing them from being propagated to the client.

The `errors` parameter is a list of models that represent the errors that will be handled by the operation or model property.
Each model must be decorated with the [`@error` decorator][error-decorator].

For example, if a property handles an error internally, that error will not propagate to the operation's response type:

```typespec
model User {
  @throws(InvalidURLError)
  @handles(PermissionDeniedError)
  profilePictureUrl: string;
}

@route("/user/{id}")
@get
op getUser(@path id: string): User | GenericError;
```

In this case, the `PermissionDeniedError` is handled internally by the `profilePictureUrl` property and does not appear in the list of possible errors for the `getUser` operation.
However, the `InvalidURLError` is still propagated to the operation's response type.

#### Operation errors + `@throws` decorator

The `@throws` decorator can also be used in conjunction with an operation's return type.
In the examples above, we are specifying that `getUser()` may return a `GenericError` in addition to the errors that may be produced by the `profilePictureUrl` property or any other property.

If an error type is specified in both the operation's return type and the `@throws` decorator, there is no conflict — the operation will include the error (once) in the list of possible errors.

<br>

#### Operation errors + `@handles` decorator

It is possible, and valid, that an operation both `@handles` an error and also has a return type that includes that error.
In this case, the operation _will_ include the error in the list of possible errors for the operation.

```typespec
@route("/user/{id}")
@get
@handles(InvalidURLError)
op getUser(@path id: string): User | InvalidURLError | GenericError;
```

Semantically, this indicates that the operation will handle the `InvalidURLError` error when produced by a model property, but that the operation itself may also return that error, outside the context of a model property.

This becomes important when considering error inheritance.

#### `@throws` + `@handles` decorator

Similarly, model properties may have one or more error types defined in both their `@throws` decorator and the `@handles` decorator.
In this case, the error is still considered to be throwable by the model property.

```typespec
model User {
  @throws(InvalidURLError)
  @handles(PermissionDeniedError, InvalidURLError)
  profilePictureUrl: string;
}
```

#### Error inheritance + `@handles` decorator

Error handling is often handled generically.
When an error is specified in the `@handles` decorator, and there are additional errors that `extend` from it, those errors will also be considered as handled by the operation.

For example, if we were to specify that `getUser()` handles `GenericError`, it would also handle any errors that extend from `GenericError`, such as `NotFoundError` and `PermissionDeniedError`.

```typespec
@error
model GenericError {
  message: string;
}

@error
model NotFoundError extends GenericError {
  @statusCode _: 404;
}

@error
model PermissionDeniedError extends GenericError {
  @statusCode _: 403;
}

@route("/user/{id}")
@get
@handles(GenericError)
op getUser(@path id: string): User | GenericError;
```

Now, any errors thrown by any of the model properties used in the operation will not be added to the operation's error output if they extend from `GenericError`.

This inheritance does _not_ apply to the `@throws` decorator.
If a property is decorated with `@throws(GenericError)`, it is not considered to be decorated with `@throws(NotFoundError)` or `@throws(PermissionDeniedError)`, even though those errors extend from `GenericError`.

Conversely, if a property is decorated with `@throws(NotFoundError)`, it is not considered to be decorated with `@throws(GenericError)`.

This is meant to align with exception semantics common among many languages, where a specific exception type must be specified when thrown but a class or category of exceptions can be caught.

<br>

## Implementations and Use Cases

Below we list some proposed implementations in various emitter targets. These are meant to be illustrative of the effects of the `@throws` and `@handles` decorators, and are not proposing any of the specific syntax or implementation shown below.

### HTTP/REST/OpenAPI

In a typical HTTP/REST API where operations are represented by endpoints, the `@throws` decorator can provide more accurate return types for operations that contain properties that may fail.

In a larger API, it may be quite difficult to track all of the errors that can occur within an operation when the errors can be generated by many different layers of an API stack.
The `@throws` decorator helps give the developer a more complete view of the errors that an operation can produce.

Let's say we have this definition of models:

<details open><summary><em>Click to collapse</em></summary>

```typespec
import "@typespec/http";
using Http;

@error
model GenericError {
  message: string;
}

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
  profilePictureUrl: string;
}
```

</details>

Now we define an operation that uses the `User` model:

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

#### Using `@throws` decorator

With the `@throws` decorator, we can specify that the `profilePictureUrl` property may produce errors when accessed:

```typespec
model User {
  @key id: string;

  @throws(NotFoundError, PermissionDeniedError, InvalidURLError)
  profilePictureUrl: string;
}
```

Since the `User` model is used in the `getUser()` operation, the generated OpenAPI will now include the possible errors that can occur when accessing the `profilePictureUrl` property:

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

The definition of `getUser()` has not changed, but it is now emitted as if the return type was

```typespec
User | NotFoundError | PermissionDeniedError | InvalidURLError | GenericError;
```

<br>

#### Using `@handles` decorator

Perhaps our `getUser()` operation is designed to handle the `InvalidURLError` error, while other operations may not do so.
We can use the `@handles` decorator to specify that this operation will handle that error:

```typespec
@route("/user/{id}")
@get
@handles(InvalidURLError)
op getUser(@path id: string): User | GenericError;
```

Now, despite the presence of a `User.profilePictureUrl` property that may produce an `InvalidURLError`, the OpenAPI will not include it in the list of possible errors for the `getUser()` operation:

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
Any property that is decorated with `@throws(InvalidURLError)` and is used in the `getUser()` operation will no longer add `InvalidURLError` to the list of possible errors for the operation.

<br>

### GraphQL

In GraphQL, errors are typically propagated through the [`errors` key in the response][graphql-errors].
The `@throws` decorator can be used to document which errors may occur when resolving a specific field.
For example, a field decorated with `@throws` could generate GraphQL schema documentation indicating the possible errors.

Some GraphQL schemas use the ["errors as data" pattern][errors-as-data], where errors are included in the possible value of a field using union types.
In this case, the `@throws` decorator can be used to specify which errors must be included in that union type.

The forthcoming [GraphQL emitter][graphql-emitter] will include additional decorators that can be applied to error models, similar to `@typespec/http`'s [`@statusCode` decorator][statuscode-decorator].
These decorators can be used to customize how errors in a `@throws` decorator are emitted in the GraphQL schema.

For example, a `@propagate` decorator could be used to indicate that an error type, if produced, should be propagated to parent fields.
In GraphQL, this is accomplished by making a field type non-nullable, which means that if a value cannot be produced for that field (due to an error), the error will be bubble up through parent fields, stopping at the first field which is nullable.

A `@asData` decorator could be used to indicate that an error type should be included in the ["errors as data" pattern][errors-as-data].
This allows a GraphQL schema to opt-in to using this pattern for specific errors, while still allowing other errors (e.g. unexpected server errors) to be propagated normally.

The `@handles` decorator can also be used in GraphQL to specify that a field resolver will handle certain types of errors.
Specifying an error in the `@handles` decorator will:

- omit the error from the union response type, if the error has the `@asData` decorator.
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
  @throws(PermissionDeniedError) ipAddress?: string;
}

// In GraphQL, fields can take arguments.
// These are specified like operations in TypeSpec.
@doc("Users following this user")
@handles(RaceConditionError) op followers(type?: string): User[];

@GraphQL.operationFields(followers)
model User {
  @throws(NotFoundError, PermissionDeniedError) profilePictureUrl: string;

  @doc("A log of the user's activity")
  @throws(UpstreamTimeoutError) activity: ActivityEntry[];
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
  * this field is non-null because it `@throws(UpstreamTimeoutError)` (which propagates)
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
  * this field is non-null because it has RaceConditionError (which propagates) in its return type
  """
  markAsSeen(seen: Boolean!): Boolean!
}
```

</details>

<br>

### Protocol Buffers (Protobuf)

Protocol Buffers (Protobuf) is a language-neutral, platform-neutral mechanism for serializing structured data. While Protobuf itself does not have a built-in concept of errors, the `@throws` and `@handles` decorators can be used to model and document errors in TypeSpec, which can then be translated into Protobuf-compatible patterns. Different patterns for communicating errors in Protobuf can be expressed using additional TypeSpec decorators.

#### Using `@throws` with Protobuf

The `@throws` decorator can be used to specify errors that may occur when accessing a property. These errors can be represented in Protobuf by defining separate message types for each error and including them in a `oneof` field in the response message.

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
  @throws(NotFoundError, PermissionDeniedError)
  profilePictureUrl: string;
}

@route("/user/{id}")
@get
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
These could be expressed in TypeSpec using a `@statusCode` decorator from a gRPC library, along with a generic `Error` model in the operation's return type.

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
  @throws(NotFoundError) profilePictureUrl: string;
}

@route("/user/{id}")
@get
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

Apache Thrift supports defining exceptions as part of its IDL (Interface Definition Language), which makes it well-suited for modeling error using the `@throws` and `@handles` decorators.

#### Using `@throws` with Thrift

Exceptions specified by `@throws` can be represented in Thrift by defining exception types and including them in the `throws` clause of a service method.

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
  @throws(NotFoundError, PermissionDeniedError)
  profilePictureUrl: string;
}

@route("/user/{id}")
@get
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

#### Using `@handles` with Thrift

The `@handles` decorator can be used to specify which exceptions are handled internally by an operation or property. In Thrift, this can be reflected by omitting the handled exceptions from the `throws` clause of the service method.

For example:

```typespec
@route("/user/{id}")
@get
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

Client libraries should leverage language-specific constructs to represent fields or operations that may produce errors.
For example, in languages with an error monad or result monad, such as Kotlin or Swift, these constructs should be used to represent fields decorated with `@throws` or operations decorated with `@handles`.

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
    val profilePictureUrl: Result<String> // Field with @throws decorator
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

In Swift, the `Result` type can be used to represent fields or operations that may fail.
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
    let profilePictureUrl: Result<String, Error> // Field with @throws decorator
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
For example, in languages with an error monad or result monad, these constructs should be used to represent fields or operations that may produce errors.
This allows server implementations to handle errors explicitly and propagate them as needed.

#### Example: Scala

In Scala, the `Either` type can be used to handle errors for fields and operations:

<details open><summary><em>Click to collapse</em></summary>

```scala
sealed trait Error
case object NotFound extends Error
case object PermissionDenied extends Error
case object InvalidUrl extends Error

case class User(id: String, profilePictureUrl: Either[Error, String]) // Field with @throws decorator

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

## Use in request input

The `@throws` and `@handles` decorators apply equally to input as they do to output.
Just as these decorators allow developers to model and handle errors that may occur when accessing properties in a server's response, they can also be used to model and handle errors that arise when processing client-provided input.
The mechanics of how these decorators are applied and how they affect the emitted output remain consistent between input and output.

<br>

### `@throws` for Input Validation Errors

When applied to input properties, the `@throws` decorator specifies the errors that may occur during the validation or processing of client-provided data.
For example, an input model for creating a user might specify that the `email` field can produce `InvalidEmailError` or `MissingFieldError`, while the `password` field can produce `InvalidPasswordError`:

```typespec
model CreateUserRequest {
  @throws(InvalidEmailError, MissingFieldError)
  email: string;

  @throws(InvalidPasswordError)
  password: string;
}
```

These errors are generated by the server in response to invalid or incomplete input provided by the client.
This is conceptually different from output errors, which are typically generated by the server's internal logic or data access operations.
However, the propagation of errors from model properties to the operation's response type works the same way for input as it does for output.

<br>

### `@handles` for Input-Level Error Handling

The `@handles` decorator can be used to specify which input-related errors are handled by the operation itself, preventing them from being propagated to the client.
For example, an operation to create a user might handle `InvalidEmailError` internally while allowing other errors to propagate:

```typespec
@route("/user")
@post
@handles(InvalidEmailError)
op createUser(request: CreateUserRequest): User | GenericError;
```

This behavior mirrors how `@handles` is used for output errors, allowing developers to control which errors are exposed to the client and which are handled internally.

<br>

### Error Propagation for Input

Errors specified in `@throws` on input properties propagate to operations unless explicitly handled with `@handles`.
For example, the following operation automatically includes `InvalidEmailError`, `MissingFieldError`, and `InvalidPasswordError` in its error response types because they are specified in the `CreateUserRequest` model:

```typespec
@route("/user")
@post
op createUser(request: CreateUserRequest):
  | User
  | InvalidEmailError
  | MissingFieldError
  | InvalidPasswordError
  | GenericError;
```

This ensures consistency between input and output error modeling.
By default, errors propagate from input properties to operations, but operations can override this behavior with `@handles`.

<br>

### Protocol-Specific Behavior

Input-related errors can also be tied to specific protocol behaviors.
For example, errors can be associated with HTTP status codes or GraphQL-specific behaviors.
The following example shows how to use the `@statusCode` decorator to specify that `InvalidEmailError` and `MissingFieldError` should result in HTTP 400 responses:

```typespec
@error
model InvalidEmailError {
  @statusCode _: 400;
  message: string;
}

@error
model MissingFieldError {
  @statusCode _: 400;
  message: string;
}
```

This is consistent with how protocol-specific metadata is applied to output errors, ensuring that input errors are handled appropriately in the context of the protocol being used.

<br>

## Alternatives Considered

### Mimic error handling in operations

TypeSpec [operations][operations] allow for specifying possible errors that the operation may produce via the [operation's return type][operations-return-type].
The standard pattern is to use a union type that includes the models representing the errors, which have been decorated with the [`@error` decorator][error-decorator].

For example:

```typespec
@error
model NotFoundError {
  message: string;
}

op getUser(id: string): User | NotFoundError;
```

The `@throws` decorator is different from the return type of operations in that it is used to document errors that may occur when accessing a property.

This distinction is useful when a property itself may inherently produce errors, regardless of the operation in which it is used.
For example, accessing a property that requires a network fetch or a permission check may result in errors.

Using a union type, as operations do, does not allow for the same error semantic in model properties.
Instead, such a type would be indicative of possible types for the property's _value_:

```typespec
model User {
  profilePictureUrl: string | NotFoundError | PermissionDeniedError;
}
```

The above TypeSpec implies that the property could be populated with either a string or one of two model type.
The fact that `NotFoundError` and `PermissionDeniedError` use the `@error` decorator is irrelevant.

```typespec
model User {
  @throws(NotFoundError, PermissionDeniedError)
  profilePictureUrl: string;
}
```

This TypeSpec, by contrast, indicates that the `profilePictureUrl` property's value is always a string, but that accessing it may produce either a `NotFoundError` or a `PermissionDeniedError`.
Typically, this means that the property does not _have_ a value in that scenario and instead should be used to describe the appropriate error-returning semantic of a given protocol.

## Summary

The `@throws` and `@handles` decorators provide a unified framework for modeling and handling errors across both input and output scenarios.
While the mechanics of these decorators are identical for input and output, the use cases differ slightly.
Input errors are generated by the server in response to invalid or incomplete client-provided data, whereas output errors are typically generated by the server's internal logic or data access operations.
This distinction ensures that the proposal remains flexible and applicable to a wide range of error-handling scenarios.

<br>

## Additional Considerations

### Optional: Adding Context Modifiers to `@error`

As an optional enhancement, we propose extending the `@error` decorator to include an argument for specifying context (visibility) modifiers.
This would allow developers to explicitly indicate the contexts in which an error applies, such as input validation, output handling, or both.
This enhancement would provide additional clarity and flexibility when modeling errors.

**This does not change the core mechanics of the `@throws` and `@handles` decorators, and the proposal for those decorators remains unchanged whether or not this enhancement is adopted.**

### Proposed Definition

The `@error` decorator would accept an optional argument specifying one or more visibility enums.

````typespec
/**
 * Specify that this model is an error type. Operations return error types when the operation has failed.
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
  @throws(InvalidEmailError)
  email: string;
}

@get op getUser(id: string): User | UserNotFound; // will not include InvalidEmailError, does return email field

@post op createUser(...User): User; // will include InvalidEmailError, does return email field

@delete op deleteUser(id: string): User; // does not include InvalidEmailError, does not return email field
```

</details>

##### Output Contexts

By default, errors with `Lifecycle.Read` are included when the model is used in an output context.

```typespec
@route("/user/{id}")
@get
op getUser(@path id: string): User | PermissionDeniedError | GenericError;
```

##### Both Contexts

Errors can apply to both input and output contexts by specifying multiple lifecycle stages.

```typespec
@error(Lifecycle.Create, Lifecycle.Read)
model GenericError {
  message: string;
}
```

#### Context follows visibility

There are a number of ways to modify the visibility of a model or operation. Context modifiers, as applied to errors, will follow the same rules as they do for visibility.

For example, use of the [`@parameterVisibility`][parameter-visibility] or [`@returnTypeVisibility`][return-type-visibility] decorators will modify the visibility of the error model in the same way as it does for parameters. That is, the properties of a model used as a parameter will apply their `@throws` errors based on the visibility of parameters. The properties of a model used as a return type will apply their `@throws` errors based on the visibility of the return type.

This also means that decorators which apply implicit visibility, such as [`@post`][post-decorator] or [`@put`][put-decorator], will apply the implicit visibility of the operation to the error model.

Any other modification of visibility including visibility filters, custom context classes, et. al. should affect errors in the same way as they affect model properties.

<br>

### Identifying Unused Error Handlers

TypeSpec only knows, and can only reason about, errors that are specified in a `@throws` decorator.
If an error is specified in a `@handles` decorator but not in any `@throws` decorator of all the model properties that are part of that property or operation, the TypeSpec compiler will not be able to determine whether the error is actually used.

To help developers make that determination, the TypeSpec compiler will issue a warning when this scenario occurs.
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
  @throws(NotFoundError)
  profilePictureUrl: string;
}

@route("/user/{id}")
@get
@handles(PermissionDeniedError) // warning
op getUser(@path id: string): User;
```

In this example, the `getUser` operation specifies that it handles `PermissionDeniedError` using the `@handles` decorator.
However, none of the properties or operations used in `getUser` (in this case, just the `User.profilePictureUrl` property) specify `PermissionDeniedError` in their `@throws` decorators.

As a result, the TypeSpec compiler will issue a warning.

#

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
