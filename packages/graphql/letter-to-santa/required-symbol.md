# Background

TypeSpec currently has an assumption that model properties and operation parameters are considered to be "required" unless specified otherwise using the `?` symbol.

<a name="default-optional"></a>This gives us functionally two states for a property: default (lacking `?`) and optional (with `?`).

An optional property is expected to always be optional, in any context where it is used.

A property without `?` is generally assumed to be required, but in some contexts it will be made optional.

# Proposal

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

## GraphQL

By default, [all types in GraphQL are nullable](https://spec.graphql.org/October2021/#sec-Non-Null). This means that all fields are optional unless they are explicitly marked as non-nullable using a trailing exclamation mark (e.g. `name: String!`). This is the opposite of TypeSpec's default behavior, where all fields are required unless they are explicitly marked as optional.

In order to implement a nullable-by-default GraphQL schema in TypeSpec, there are a few options:

1. Use the `?` symbol to mark all fields as optional. This would require adding `?` to every field in every model, which could be tedious and error-prone. Additionally, this affects the definition of the model itself when used with other emitters. To avoid this, developers would need to maintain multiple protocol-specific versions of the same model.
1. Use `| null` to mark fields as nullable. Similar to the previous option, this is tedious and affects the definition of the model itself. In GraphQL, there is no notion of a field being "optional", and the semantic notion of the `?` symbol provides the best match to GraphQL nullable.
1. Implement emitter-specific behavior. This is discussed below in "Is this protocol-specific?".
1. This proposal, which we think avoids the drawbacks of the other options. Developers are expected to use the `!` symbol on fields which are required in all contexts and protocols, and the GraphQL emitter will treat these fields as non-nullable.

### SQL

In SQL, columns in a table are nullable by default. This means that a column can contain a `NULL` value unless it is explicitly marked as `NOT NULL`. This is the opposite of TypeSpec's default behavior, where all properties are required unless they are explicitly marked as optional.

Many of the same considerations apply here as in GraphQL.

# Considerations

## Is this protocol-specific?

Another approach would be to define a protocol-specific decorator that would mark properties as required in that protocol.

The idea of explicit requiredness as proposed here is that it is the definition of the model that implies its explicit requiredness, rather than its expression in a certain protocol. For instance, an `id` field on a model type being marked as explicitly required indicates that the model cannot exist without an `id`. Similarly, an `email` field on a `User` or `Account` model may also be explicitly required.

Defining this at the model level allows for consistent behavior across protocols that are implementing the model. If the model definition is used to create a GraphQL schema, a REST API, and a SQL table, the `!` symbol would indicate that the field is required in all of those contexts. Generated code for each protocol can then be consistent with the model definition.

If instead a protocol-specific decorator is used, there will be a discrepancy in behavior among different systems handling the same data.

## How is this different from visibility?

Requiredness is a different concept from visibility. Visibility is about which properties _can_ appear in a view, while requiredness is about what properties _will_ appear in a view. A property with `Lifecycle.read` visibility is included in the read view, but it is not necessarily required to be present.

The precedent has been set with the `@patch` decorator that visibility can affect optionality. We also have a notion that an `id` field, for instance, will always be present on a read view based on visibility.


## Does requiredness make sense on a model level?

@garethj-msft makes an argument that requiredness is a property of the action being performed, not of the model itself.

> I don't believe in API descriptions being your data model, in fact I think of that as an anti-pattern.  Rather I think of them as the model of one or more interaction patterns.
> 
> Rather than 'always exists in the data model", what I find useful in an API definition is "Always must be passed in" or "always will be available to be returned", which from the strict point of view of the consumer are the concerns.  The system data model shouldn't really be a concern of the API caller.

If one follows this argument, then the concept of requiredness on a data model is not useful. Instead, it should always be specified in the context of a particular action. In TypeSpec, this would be best expressed with separate `WidgetCreate`, `WidgetUpdate`, etc. models — which the visibility system exists to make easier and less verbose. It seems reasonable then to combine this notion somehow with visibility, which is explored below in [`@requiredFor<Action>` decorators](#required-for-action), [`@required(visibility)` decorators](#required-visibility-decorator), and [extending the `@visibility` decorator with requiredness](#extend-the-visibility-decorator-with-requiredness).

## What are the implications for current TypeSpec emitters?

Currently, TypeSpec implicitly and explicitly treats model properties without a `?` as required. In a sense, this proposal is not introducing a required state so much as it is introducing a "default requiredness" state. In all current emitters, "default requiredness" can continue to be treated as "required", so that it will not affect current behavior. Indeed, in these emitters the addition of `!` will have no effect at all on the model properties to which it is applied.

# Alternatives Considered

## `@required` decorator

From [discussion of a `@usage` decorator](https://github.com/microsoft/typespec/issues/4486), this general principle is suggested:

> I think a general thing we want for typespec is have the ability to use some decorator to specify some syntax sugar like `@default` or `@optional`, etc. So i believe it would be safer to start with a decorator and move to a syntax later if it is widely used.

In this scenario, however, a decorator does create the possibility of conflict. A property can be marked with both the decorator and the `?` symbol, e.g. `@required name?: string`. This would need to produce a validation error in the decorator.

Since the TypeSpec language does not allow for either the `?` or `!` character [to be used in a property name](https://typespec.io/docs/language-basics/identifiers/), the parser can be modified such that using both (`!?` or `?!`) is a syntax error, just as `??` is today.
This would prevent the possibility of a conflict between the two.

Lastly, it seems awkward to use one system to indicate one side of a binary (`?` for optional) and a different system for the other (`@required` for required). Developers might rightly question why we don't have an `@optional` decorator instead of `?`, or something like `@requiredness(bool)`.

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

Which replaces the `true` or `false` boolean in the above examples with `Optionality.Required` or `Optionality.Optional`. These can simply be added to the existing rest parameter of `@visibility`. But it does make the `Optionality` enum "special", in that it implies a different behavior from any other visibility enum.
