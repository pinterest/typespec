# Background

Model properties in TypeSpec can either be [optional][optional-properties] or not.

This determination is made by the presence or absence of the `?` symbol after the property name.

```typespec
model User {
  name: string; // not optional
  email?: string; // optional
}
```

For the most part, TypeSpec emitters assume "not optional" to mean "required".
The above TypeSpec, for instance, will be represented as the following:

### OpenAPI emitter

Adds all not optional properties to the [`required` array defined by JSON schema][json-schema-required].

```yaml
required:
  - name
```

<details>
<summary>OpenAPI emitter output</summary>

```yaml
User:
  type: object
  required:
    - name
  properties:
    name:
      type: string
    email:
      type: string
```

</details>

### JSON Schema emitter

Adds all not optional properties to the [`required` array defined by JSON schema][json-schema-required].

```yaml
required:
  - name
```

<details>
<summary>JSON Schema emitter output</summary>

```yaml
$schema: https://json-schema.org/draft/2020-12/schema
$id: User.yaml
type: object
properties:
  name:
    type: string
  email:
    type: string
required:
  - name
```

</details>

### Protobuf emitter

Proto3 [does not have required fields][protobuf-required]. All fields are optional.

```protobuf
string name = 1;
string email = 2;
```

<details>
<summary>Protobuf emitter output</summary>

```protobuf
syntax = "proto3";

message User {
  string name = 1;
  string email = 2;
}
```

</details>

### `http-server-javascript` emitter

One more example, to show how this is handled in TypeScript output.

```typescript
name: string;
email?: string;
```

<details>
<summary>JavaScript HTTP server emitter output</summary>

```typescript
export interface User {
  name: string;
  email?: string;
}
```

</details>

## Visibility

TypeScript has a robust [visibility system][visibility-system] that allows developers to specify which properties are visible in which contexts.

The visibility system handles **presence** and **absence** of properties. In the terminology of the visibility system, these are referred to as **visible** and **invisible**.

Model properties can have default visibility as defined by the [`@defaultVisibility`][defaultVisibility] and [`@withDefaultKeyVisibility`][withDefaultKeyVisibility] decorators.

Visibility is entirely contextual. The notion of a property being visibile or invisible at a "model level"  is simply whether or not the property exists on the model.

The visibility context is specified using [visibility modifiers][visibility-modifiers].
A model property is assigned a set of visibility modifiers through a combination of decorators.


# Problem

There are two main problems we are looking to solve:

1. While TypeSpec supports specifying explicit optionality, it does not support specifying explicit requiredness.
2. Optionality and requiredness can only be specified at the model level, and cannot change based on the context in which the model is used.

### Explicit Optionality/Requiredness

When the `?` modifier is absent, we will say the property has "default optionality".

As we saw above, the optionality/requiredness of property with default optionality is determined by the emitter.

Protobuf, for example, treats these fields as equivalent to optional fields. OpenAPI and JSON schema treat them as required.

GraphQL, which uses nullable/non-nullable to represent optional/required, treats all fields as nullable unless they are explicitly marked as non-nullable.
A GraphQL emitter will treat all properties with default optionality as nullable.

Let's call OpenAPI and JSON schema "default required" emitters, and GraphQL a "default optional" emitter.

**While we have a way to tell "default required" emitters that a property is optional, we do not have a way to tell "default optional" emitters that a property is required.**

### Contextual Optionality/Requiredness

The second problem is that optionality and requiredness are defined at the model level, but they may need to change based on the context in which the model is used.

The primary existing example of this is the way that `@typespec/http` handles `PATCH` operations.

When the `@patch` decorator is applied to an operation, a [new "view" of that model](https://typespec.io/docs/language-basics/visibility/#_top) is created with two primary behaviors:

1. Only properties with the `update` visibility are included in the model. This is consistent with the rules of [automatic visibility](https://typespec.io/docs/libraries/http/operations/#automatic-visibility), and is roughly equivalent to applying the `@withLifecycleUpdate` decorator (or `@withVisibility(Lifecycle.update)`) to a model to create the update "view".
2. All properties are made optional. This behavior is [implicit based on the visibility of the properties](https://github.com/microsoft/typespec/pull/1345), and is not configurable.

The first behavior is not uncommon; indeed, the `Http` library defines [default visibility modifiers for all HTTP verbs][http-default-verb-visibility].
Since these are merely default modifiers, the TypeSpec developer can override them by applying the `@parameterVisibility` and/or `@returnTypeVisibility` decorator to the operation.

The latter is unique to `PATCH`. It has been [discussed previously](https://github.com/microsoft/typespec/issues/2150#issuecomment-1622215786) that perhaps this behavior should also be overridable with a decorator:

> Add some decorator to explicitly say that the input properties are made optional or not. This can be combined with (1) or (2) or status quo as an override.
 
As recently as Feb 4, 2025, we're still looking for a way to [make this behavior more explicit](https://github.com/microsoft/typespec/discussions/5759#discussioncomment-12057390).

# Proposal

The proposed solution consists of three new expressions:

1. A new symbol, `!`, to mark properties as _explicitly required_.
2. A new decorator, `@required`, to mark properties as required in specific contexts.
3. A new decorator, `@optional`, to mark properties as optional in specific contexts.

## Goals

1. Give developers a way to write TypeSpec that is usable across "default optional" and "default required" protocols.
2. Provide more control over requiredness/optionality based on context.
    1. Find a general solution to the `@patch` problem.
3. Promote comprehension and maintainability by aligning with existing systems.

The goal is to make the concepts of optionality and visibility — represent two parallel systems.

|           | Default expression                               | Contextual expression                         |
|-----------|--------------------------------------------------|-----------------------------------------------|
| Visible   | _implied by the existence of the model property_ | `@visibility(<list of visibility modifiers>)` |
| Invisible | _implied by the absence of the model property_   | `@invisible(<list of visibility modifiers>)`  |
| Required  | with `!` modifier                                | `@required(<list of visibility modifiers>)`   |
| Optional  | with `?` modifier                                | `@optional(<list of visibility modifiers>)`   |


|                             | Visibility                                                       | Requiredness                                  |
|-----------------------------|------------------------------------------------------------------|-----------------------------------------------|
| modelProperty               | @visibility<br>@removeVisibility<br>@invisible                   | @required<br>@optional                        |
| all of a model’s properties | @withDefaultKeyVisibility                                        | N/A (or @defaultOptional)?                    |
| transform a model           | @withVisibility<br>@withVisibilityFilter<br>@withLifecycleUpdate | @withOptionalProperties                       |
| operation                   | @parameterVisibility<br>@returnTypeVisibility                    | @parameterVisibility<br>@returnTypeVisibility |



This proposal is to introduce a new symbol, `!`, into the TypeSpec language. This symbol would mark properties as _explicitly required_. This would allow developers to specify that a property is required in all contexts, including those where it would otherwise be optional.

This creates a ternary system for model properties:
- required (with `!`)
- default (without `?` or `!`)
- optional (with `?`)

It is up to emitters to make a protocol-specific decision about how to treat properties in the default state.

Properties made explicitly required or explicitly optional should always be treated as such, regardless of the emitter used.

# Use Cases

<a name="patch"></a>
## PATCH

In REST APIs, it is common to have `PATCH` endpoints that only update the properties given in the request body, and leave the rest of the properties unchanged. In this case, it is more natural to have all properties optional by default, and require the user to explicitly specify which properties are required.

### `TypeSpec.Http.@patch`

When using the `@patch` decorator, the `Http` library will make all the properties optional, regardless of whether they are marked with `?`.

When the `@patch` decorator is applied to an operation, a [new "view" of that model](https://typespec.io/docs/language-basics/visibility/#_top) is created with two primary behaviors:

1. Only properties with the `update` visibility are included in the model. This is consistent with the rules of [automatic visibility](https://typespec.io/docs/libraries/http/operations/#automatic-visibility), and is roughly equivalent to applying the `@withLifecycleUpdate` decorator (or `@withVisibility(Lifecycle.update)`) to a model to create the update "view".
2. All properties are made optional. This behavior is [implicit based on the visibility of the properties](https://github.com/microsoft/typespec/pull/1345), and is not configurable.

The behavior of other HTTP method decorators (`@get`, `@post`, et al) can be likened to `@parameterVisibility` and `@returnTypeVisibility`, (e.g. `@get` is equivalent to those two decorators used with the `Lifecycle.read` visibility), but there is no such equivalence for `@patch` due to the second behavior.

The latter has been [discussed previously](https://github.com/microsoft/typespec/issues/2150#issuecomment-1622215786), with one of the suggestions being

> Add some decorator to explicitly say that the input properties are made optional or not. This can be combined with (1) or (2) or status quo as an override.

As recently as Feb 4, 2025, we're still looking for a way to [make this behavior more explicit](https://github.com/microsoft/typespec/discussions/5759#discussioncomment-12057390).

# Considerations

## How is this different from visibility?

Requiredness is a different concept from visibility. Visibility is about which properties _can_ appear in a view, while requiredness is about what properties _will_ appear in a view. A property with `Lifecycle.read` visibility is included in the read view, but it is not necessarily required to be present in all instances of that view.

The precedent has been set with the `@patch` decorator that visibility context can affect optionality.

## Does requiredness make sense on a model level?

Models in TypeSpec can mean different things.
While in OpenAPI they are typically only used to define the shape of a request or response body (indeed, there is [an option][omit-unreachable-types] not to emit any models unless they are part of an operation), in other protocols like JSON schema there is no notion of operations, and so models must be context-free.

## Is this protocol-specific?

We've already encountered the concepts of "default required" emitters and "default optional" emitters, suggesting that the emitter (and by extension, the protocol) has some role to play in determining the requiredness of a property.

To that end, perhaps it should be the emitter that provides mechanisms to explicitly specify the requiredness of a property, in a way that only affects that emitter.

However, this discourages the creation of protocol-agnostic API definitions, which is a [key feature of TypeSpec](https://typespec.io/data-validation/).
If the model definition is used to create a GraphQL API, a RESTful API (described by OpenAPI), and a set of JSON schemas, it should be possible to specify the requiredness of a property, both contextual and context-free, in a way that yields a consistent representation in all protocols.
Generated code for each protocol can then be consistent with the model definition.

If instead a protocol-specific decorator is used, there will be a discrepancy in behavior among different systems handling the same data.

## What are the implications for current TypeSpec emitters?

Existing "default required" emitters will see no change from the `!` symbol.
They already treat all properties without the `?` symbol as required, and a property cannot be given the `!` symbol without removing the `?` symbol.

# Alternatives Considered

### `@required` decorator instead of `!`

From [discussion of a `@usage` decorator](https://github.com/microsoft/typespec/issues/4486), this general principle is suggested:

> I think a general thing we want for typespec is have the ability to use some decorator to specify some syntax sugar like `@default` or `@optional`, etc. So i believe it would be safer to start with a decorator and move to a syntax later if it is widely used.

In this scenario, however, a decorator does create the possibility of conflict. A property can be marked with both the decorator and the `?` symbol, e.g. `@required name?: string`. This would need to produce a validation error in the decorator.

Since the TypeSpec language does not allow for either the `?` or `!` character [to be used in a property name](https://typespec.io/docs/language-basics/identifiers/), the parser can be modified such that using both (`!?` or `?!`) is a syntax error, just as `??` is today.
This would prevent the possibility of a conflict between the two.

In addition, it seems awkward to use one system to indicate one side of a binary (`?` for optional) and a different system for the other (`@required` for required). Developers might rightly question why we don't have an `@optional` decorator instead of `?`, or something like `@requiredness(bool)`.

Finally, we want to avoid confusion with the proposed `@required` and `@optional` decorators that are context-specific.

### Implement GraphQL emitter with the existing concepts

By default, [all types in GraphQL are nullable][graphql-nullable-default].
This means that all fields are optional unless they are explicitly marked as non-nullable using a trailing exclamation mark (e.g. `name: String!`).
This is the opposite of "default required" emitters like OpenAPI and JSON schema, where all fields are required unless they are explicitly marked as optional.

In order to implement a "default optional" emitter with existing concepts, there are a few options:

1. Require the TSP developer to use the `?` symbol by default. This would require adding `?` to every field in every model, which could be tedious and error-prone. Additionally, this affects the output in "default required" emitters. To avoid this, developers would need to maintain multiple protocol-specific versions of the same model.
1. Use `| null` to mark fields as nullable. Similar to the previous option, this is tedious and affects the definition of the model itself. In GraphQL, there is no notion of a field being "optional", and the semantic notion of the `?` symbol provides the best match to GraphQL nullable.
1. Implement emitter-specific behavior. This is discussed below in "Is this protocol-specific?".
1. This proposal, which we think avoids the drawbacks of the other options. Developers are expected to use the `!` symbol on fields which are required in all contexts and protocols, and the GraphQL emitter will treat these fields as non-nullable.


<a name="required-for-action"></a>
## `@requiredFor<Action>` decorators

As mentioned by @garethj-msft in [this issue](https://github.com/microsoft/typespec/issues/1583), a `@requiredForCreate` decorator is used when describing Microsoft Graph APIs.

In his words:

> For `@requiredForCreate`, that's on all properties which are required any time a resource is created, either by `POST` to collection, `PUT` to single slot, or by any mutation of a sub-resource via the above, or by `PATCH`ing the parent resource with a new child resource, or `PATCH` for upsert.
> Any property without that can be omitted in a _creation_ scenario.

This approach provides a way to specify requiredness _based on the action being performed_. This is a different concept than the proposed `!` or even the `@required` decorator, as it is not about the property itself, but about the context in which it is used.

If we were to extend this pattern, one imagines a series of `@requiredFor<Action>` decorators.

For example, in the [`PATCH` use case](#patch), a `@requiredForUpdate` decorator could be used to mark properties as required when updating a resource. This would not affect the requiredness of the field in actions where it is not defined by a decorator, which would continue to be defined by the [presence or absence of the `?` symbol](#default-optional).

```typespec
model Dog {
  @requiredForDelete
  @requiredForUpdate id?: int64; // This will be required when deleting or updating a Dog, and optional otherwise
  
  name: string; // This will be required in all contexts
  address?: string; // This will be optional in all contexts
  @requiredForCreate age: number; // This will be required when creating a Dog, but optional when updating
}
```

This approach would allow for more fine-grained control over requiredness, but it would also introduce more complexity and require more decorators to be defined.

It also creates a [conflict between visibility and requiredness](#visibility-requiredness-conflict), which will be discussed more below (the concept is the same).

<a name="required-visibility-decorator"></a>
## `@required(visibility)` decorator

A more flexible version of the `@requiredFor<Action>` decorator would be a `@required()` decorator that takes a [visibility class](https://typespec.io/docs/language-basics/visibility/#visibility-classes) as an argument.

```typespec
model Dog {
  @required(Lifecycle.Update, Lifecycle.Delete) id?: int64;
  name: string; // This will be required in all contexts
  address?: string; // This will be optional in all contexts
  @required(Lifecycle.Create) age: number; // This will be required when creating a Dog, but optional when updating
}
```

<a name="visibility-requiredness-conflict"></a>
### Visibility and requiredness conflict
This introduces a bit more of an explicit relationship between requiredness and visibility. For a given lifecycle, there are now six possibilities:
- visible and default requiredness
- visible and required
- visible and optional
- invisible and default requiredness
- invisible and required
- invisible and optional

The latter two introduce a bit of a conflict — if a property is invisible, it cannot be "required" as such.
This could be explicitly raised as a validation error, e.g.
```typespec
  @invisible(Lifecycle.Create)
  @required(Lifecycle.Create) id: int64; // Error: id cannot be required in "create" if it is not visible
```

or it could be silently ignored, e.g.
```typespec
  @invisible(Lifecycle.Create)
  @required(Lifecycle.Create) id: int64;
  // is equivalent to (in the context of Create)
  @invisible(Lifecycle.Create) id?: int64;
  // is equivalent to (in the context of Create)
  @invisible(Lifecycle.Create) id: int64;
```

<a name="extend-the-visibility-decorator-with-requiredness"></a>
## Extend the `@visibility` decorator with requiredness

The signature of `@visibility` is
```typespec
extern dec visibility(target: ModelProperty, ...visibilities: valueof (string | EnumMember)[]);
```

Since it uses a [rest parameter](https://typespec.io/docs/extending-typespec/create-decorators/#rest-parameters) already, we cannot add a second parameter to it without a breaking change.

However, let's pretend that we can and explore the implications:

```typespec
extern dec visibility(target: ModelProperty, visibilities: valueof (string | EnumMember)[], required?: boolean = null);
```

In this scenario, we can specify the requiredness alongside the visibility. This eliminates the issue of conflict described above, since we make this change only to `@visibility` and not to `@invisible`.

This gives the `?` a more defined role as "fallback requiredness"; i.e. if not given a requiredness with a `@visibility` decorator, the requiredness is determined by the presence or absence of the `?` symbol.

```typespec
  // visible and required on create and update, invisible otherwise
  @visibility(#[Lifecycle.Create, Lifecycle.Update], true) password: string;
  // is equivalent to
  @visibility(#[Lifecycle.Create, Lifecycle.Update], true) password?: string;
  
  // visible and optional on create and update, invisible otherwise
  @visibility(#[Lifecycle.Create, Lifecycle.Update], false) password: string;
  // is equivalent to
  @visibility(#[Lifecycle.Create, Lifecycle.Update], false) password?: string;
  // is equivalent to
  @visibility(#[Lifecycle.Create, Lifecycle.Update]) password?: string;

  // visible and default requiredness on create and update, invisible otherwise
  @visibility(#[Lifecycle.Create, Lifecycle.Update]) password: string;
```

If we want to have an implementation compatible with the current `@visibility` decorator, we could introduce a new set of visibilities, e.g.
```typespec
enum Optionality {
  Required,
  Optional,
}
```

Which replaces the `true` or `false` boolean in the above examples with `Optionality.Required` or `Optionality.Optional`. These can simply be added to the existing rest parameter of `@visibility`. But it does make the `Optionality` enum "special", in that it implies a different behavior from any other visibility enum. Other visibility enums are used to match a model property's visibility to an operation's visibility.

Is that a bad thing? Specific protocols already "map" certain behaviors to visibilities. And there's already an implication built in to TypeSpec that `Create`/`Update` are "input" visibilities and `Read` is an "output" visibility.

See https://github.com/microsoft/typespec/issues/4486:
> We should be able to map visibility to input or output so those get applied automatically



## Use custom visibility for GraphQL

If this is a GraphQL problem, we can find a GraphQL solution:

```typespec
namespace TypeSpec.GraphQL;

enum Nullability {
  Nullable,
  NonNullable,
}

model User {
  @visibility(Lifecycle.Read, Nullability.NonNullable) id: string;
  @visibility(Lifecycle.Update, Nullability.Nullable)
  @visibility(Lifecycle.Read, Lifecycle.Create, Nullability.NonNullable)
  name: string;
  @visibility(Lifecycle.Update, Nullability.Nullable)
  @visibility(Lifecycle.Create, Nullability.NonNullable)
  password: string;
}
```

```graphql
input UserCreateInput {
  name: String
  password: String!
}

input UserUpdateInput {
  name: String
  password: String!
}

type User {
  id: String!
  name: String
}
```

or what about with `in/out/inout`?

```typespec
inout model User {
  @visibility(Nullability.NonNullable) out id: string;
  @visibility(Nullability.Nullable) inout name: string;
  
  @visibility(Lifecycle.Update, Nullability.Nullable)
  @visibility(Lifecycle.Create, Nullability.NonNullable)
  in password: password;
}
```

```graphql
input UserCreateInput {
  name: String
  password: String!
}

input UserUpdateInput {
  name: String
  password: String!
}

type User {
  id: String!
  name: String
}
```

or just with implied `in/out` by visibility?

```typespec
model User {
  @visibility(Lifecycle.Read, Nullability.NonNullable) id: string; // visibile and non-null only on output
  @visibility(Nullability.Nullable) name: string; // visible and nullable everywhere
  
  @visibility(Lifecycle.Update, Nullability.Nullable) // nullable on update
  @visibility(Lifecycle.Create, Nullability.NonNullable) // non-null (required) on create
  password: password;
}
```

```graphql
input UserCreateInput {
  name: String
  password: String!
}

input UserUpdateInput {
  name: String
  password: String
}

type User {
  id: String!
  name: String
}
```

let's extend this further to all protocols — call it `Requiredness` instead:

```typespec
namespace TypeSpec;

enum Optionality {
  Required,
  Optional,
}

model User {
  @visibility(Lifecycle.Read, Optionality.Required) id: string; // visibile and always present only on output
  @visibility(Optionality.Optional) name: string; // visible and optional everywhere
  
  @visibility(Lifecycle.Update, Optionality.Nullable) // optional on update
  @visibility(Lifecycle.Create, Optionality.Required) // required on create
  password: password;
}
```

but we still have `?` — so what does that do?

```typespec
model User {
  @visibility(Lifecycle.Read, Optionality.Required) id: string; // visibile and always present only on output
  //equivalent to
  @visibility(Lifecycle.Read) id!: string;
  
  @visibility(Optionality.Optional) name: string; // visible and optional everywhere
  //equivalent to
  name?: string;
  
  @visibility(Lifecycle.Update, Optionality.Nullable) // optional on update
  @visibility(Lifecycle.Create, Optionality.Required) // required on create
  password: password;
  // cannot be expressed with `?` or `!`
  // either we ignore it 
}
```


In GraphQL, on input:
non-null means required (must provide a non-null value)
nullable means optional (cannot specify an explicit null value)

on output:
non-null means non-null (aka `| null` is not allowed)
nullable means nullable (aka `| null`)



```typespec
model User {
  @visibility(Lifecycle.Read) id: string; // visibile and non-null only on output
  
  @visibility(Lifecycle.Update) // nullable on update
  @visibility(Lifecycle.Create) // non-null (required) on create
  password: password;
}
```

```graphql
input UserCreateInput {
  name: String
  password: String!
}

input UserUpdateInput {
  name: String
  password: String
}

type User {
  id: String!
  name: String
}
```


What about this? mutations are operations. queries are not operations (for the sake of argument).
> Other visibility enums are used to match a model property's visibility to an operation's visibility.


```typespec
model User {
  @visibility(Lifecycle.Read) id: string; // visibile and non-null only on output
  
  name?: string; // visible and nullable everywhere
  
  @visibility(Lifecycle.Update) // nullable on update
  @visibility(Lifecycle.Create) // non-null (required) on create
  password: password;
  
  // or
  @visibility(Lifecycle.Update, Lifecycle.Create, Lifecycle.Foo)
  @required(Lifecycle.Create) // in GraphQL, this means non-null on create (nullable elsewhere). In OpenAPI, it's a no-op.
  @optional(Lifecycle.Update) // in GraphQL, this is a no-op. In OpenAPI, it's optional on update (required elsewhere).
  password: password;
  
  vs.
  
  @visibility(Lifecycle.Update, Lifecycle.Create)
  @required(Lifecycle.Create) // in GraphQL, this means non-null on create (nullable elsewhere). In OpenAPI, it means required on create.
  @optional(Lifecycle.Update) // in GraphQL, this is a no-op. In OpenAPI, it's also a no-op.
  password?: password;
  
  vs.
  
  @visibility(Lifecycle.Update, Lifecycle.Create)
  @required(Lifecycle.Create) // in GraphQL, this is a no-op. In OpenAPI, it's also a no-op.
  @optional(Lifecycle.Update) // in GraphQL, this means nullable on update (non-null elsewhere). In OpenAPI, it means optional on update (required elsewhere).
  password!: password;
}

interface Mutation {
  @visibility(Lifecycle.Update) updateUser(User): User;
  @visibility(Lifecycle.Create) createUser(User): User;
}
```

creates

```graphql
type Mutation {
  updateUser(input: UserUpdateInput): User
  createUser(input: UserCreateInput): User
}

# has everything with Read visibility
type User {
  id: String!
  name: String
}

# has everything with Create visibility
input UserCreateInput {
  name: String
  password: String!
}

# has everything with Update visibility
input UserUpdateInput {
  name: String
  password: String
}
```



|                                                                                                                                                           | Protocol-agnostic | Required by default (e.g. OAI)                                   | Optional by default (e.g. GraphQL)                               |
|-----------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------|------------------------------------------------------------------|------------------------------------------------------------------|
| `@visibility(Lifecycle.Update, Lifecycle.Create, Vis.Foo)`<br/>`@required(Lifecycle.Create)`<br/>`@optional(Lifecycle.Update)`<br/>`password: password;`  | **Undefined**     | Required on `Create`.<br/>Optional on `Update`.<br/>Required on `Foo`. | Required on `Create`.<br/>Optional on `Update`.<br/>Optional on `Foo`. |
| `@visibility(Lifecycle.Update, Lifecycle.Create, Vis.Foo)`<br/>`@required(Lifecycle.Create)`<br/>`@optional(Lifecycle.Update)`<br/>`password?: password;` | **Optional**      | Required on `Create`.<br/>Optional on `Update`.<br/>Optional on `Foo`. | Required on `Create`.<br/>Optional on `Update`.<br/>Optional on `Foo`. |
| `@visibility(Lifecycle.Update, Lifecycle.Create, Vis.Foo)`<br/>`@required(Lifecycle.Create)`<br/>`@optional(Lifecycle.Update)`<br/>`password!: password;` | **Required**      | Required on `Create`.<br/>Optional on `Update`.<br/>Required on `Foo`. | Required on `Create`.<br/>Optional on `Update`.<br/>Required on `Foo`. |


[optional-properties]: https://typespec.io/docs/language-basics/models/#optional-properties
[json-schema-required]: https://json-schema.org/understanding-json-schema/reference/object#required
[protobuf-required]: https://protobuf.dev/best-practices/dos-donts/#add-required
[http-default-verb-visibility]: https://github.com/microsoft/typespec/blob/103515b524112ef3907ea3113144efb9e39b7d39/packages/http/src/metadata.ts#L263-L287
[visibility-system]: https://typespec.io/docs/language-basics/visibility/
[visibility-modifiers]: https://typespec.io/docs/language-basics/visibility/#visibility-modifiers
[defaultVisibility]: https://typespec.io/docs/standard-library/built-in-decorators/#@defaultVisibility
[withDefaultKeyVisibility]: https://typespec.io/docs/standard-library/built-in-decorators/#@withDefaultKeyVisibility
[graphql-nullable-default]: https://spec.graphql.org/October2021/#sec-Non-Null
