# GraphQL Emitter Design

Authors: @AngelEVargas, @swatkatz, @steverice

Last updated: Feb 13, 2025

## Motivation
From the TypeSpec docs:

> TypeSpec is a protocol agnostic language. It could be used with many different protocols independently or together

TypeSpec's standard library includes support for emitting OpenAPI 3.0, JSON Schema 2020-12 and Protobuf.

As GraphQL is a [widely used protocol](https://landscape.graphql.org/card-mode) for querying data by client applications, providing GraphQL support in the TypeSpec standard library can help bring all valuable [TypeSpec features](https://typespec.io/) to the GraphQL ecosystem.
This proposal describes the design for a GraphQL emitter that can be added to TypeSpec's standard library and can be used to emit a valid GraphQL schema from a valid TypeSpec definition.

## General Emitter Design Guidelines
Refer to [4604](https://github.com/microsoft/typespec/discussions/4604)

## GraphQL spec and validation rules

| GraphQL Validation Rule                                                                                                                                                                                                                                                                                                     | Emitter Compliance Guidelines                                                                                                                                                                                                                                                                                                            |
|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| All types within a GraphQL schema must have unique names. No two provided types may have the same name. No provided type may have a name which conflicts with any built in types (including Scalar and Introspection types).                                                                                                | All anonymous types in TSP will need a default name (something like namespace \+ parent\_type \+ field\_name). If a type in TSP results in multiple types in the output, each output type should be unique by having a prefix or suffix (something like type \+ “Interface”)                                                             |
| All types and directives defined within a schema must not have a name which begins with “\_\_” (two underscores), as this is used exclusively by GraphQL’s introspection system. GraphQL Identifiers have [this validation](https://spec.graphql.org/October2021/#sec-Names) (names can only start with an `_` or `letter`) | TSP has a [wider set of valid names](https://typespec.io/docs/language-basics/identifiers/) so we’ll throw an emitter validation error for invalid GraphQL names. The developer can use the [upcoming `invisibility` decorator](https://github.com/microsoft/typespec/pull/4825/files) to define another field with a GraphQL valid name |
| The **query** root operation type must be provided and must be an Object type.                                                                                                                                                                                                                                              | If the resulting GraphQL schema has no query type, create a dummy query type with no fields                                                                                                                                                                                                                                              |
| Custom scalars should provide a `@specifiedBy` directive or the `specifiedByURL` introspection field that must link to a human readable specification of data format, serialization, and coercion rules for the scalar                                                                                                      | Use existing open source specification for custom scalars that already provide these details and use the `@specifiedBy` directive in the schema to point to them                                                                                                                                                                         |
| Object Types and Input Types are two completely different types in GraphQL                                                                                                                                                                                                                                                  | See object type and input types for more details                                                                                                                                                                                                                                                                                         |
| An object type must define one or more fields                                                                                                                                                                                                                                                                               | Throw an error if we encounter an empty object                                                                                                                                                                                                                                                                                           |

## Basic emitter building blocks

The following building blocks are used by the emitter code:

```
emitter.ts (starting point)
Responsibilities:
- Resolving emitter options like noEmit, strictEmit, ...
- Create the actual gql-emitter with the output filePath and options

gql-emitter.ts (main file)

Creates a GraphQLEmitter class that initializes the registry, and typeSelector
 - Starts navigateProgram that collects all the types and builds the GraphQL AST
 - Creates the top-level query/mutation/subscriptions
 - Creates a new GraphQLSchema (js object)
 - Validates schema
 - Returns schema if no errors

If not error
 - printSchema(schema) (GraphQL method that handles all the formatting etc)
 - Write string to file

registry.ts (several maps to collect types)
Mostly has 2 types methods:
- addXXX (addGraphQLType)
- getXXX (getGraphQLType)

The add methods add the partial type to a collector and the get methods are called in the exit visitors to finish building the type as all the information is available to do so.

selector.ts (exposes the function to select the right GraphQL type based on TSP type)
 - typeSelector(type: Type): GraphQLOutputType | GraphQLInputType
```

The main design constraint is that we only want to traverse the TSP program once to collect and build the GraphQL types.

## Detailed Emitter Design

## Design Scenarios
We need to consider two main scenarios when designing the GraphQL emitter:

1. When the TypeSpec code is specifically designed for emitting GraphQL, we can equip developers with GraphQL-specific decorators, and objects. This will aid in crafting TypeSpec code that generates well-designed GraphQL schemas. Given that GraphQL does not employ HTTP or REST concepts, developers should be able to bypass those libraries. However, it should still be feasible to emit OpenAPI or any other schema by adding the appropriate decorators (like `@route`) to the existing TypeSpec code used to generate the GraphQL schema and the existing graphql emitter should continue to work as expected.
2. When a developer aims to create a GraphQL service from an existing TypeSpec schema originally used for emitters like OpenAPI, we focus on producing a GraphQL schema that represents the TypeSpec with no loss of specificity. Instead of assuming intent, we will provide errors and warnings as soon as possible when something in the TypeSpec schema is not directly compatible with GraphQL and the means of making it compatible are not deterministic.

## Output Types

### Context and design challenges

GraphQL distinguishes between [Input and Output Types](https://spec.graphql.org/draft/#sec-Input-and-Output-Types). While there is no way in TypeSpec to allow the developers to specify this, the compiler provides a mechanism that identifies each model as Input and/or Output using `UsageFlags`.

In GraphQL:

- `Scalar` and `Enum` types can be used as both: Input and Output
- `Object`, `Interface` and `Union` types can be used only as Output
- `Input Object` types can't be used as Output

### Design Proposal
Use the `UsageFlags` to identify the `input` and `output` types for GraphQL.

**🔴 Design Decision:** As [TSP will allow](https://discord.com/channels/1247582902930116749/1250119513681301514/1298313513567256576) a model to be both `input` and `output` type and indeed that would be useful for GraphQL as well, the GraphQL emitter will support this case. In order to differentiate between the `input` and `output` types we propose creating a new GraphQL type for inputs with the name of the type \+ `Input` suffix.

When creating an operation that returns models, all directly or indirectly referenced models, should be emitted as valid GraphQL output types.

#### Mapping

| TypeSpec           | GraphQL         | Notes                  |
|:-------------------|:----------------|:-----------------------|
| `Model.name`       | `Object.name`   | See Naming conventions |
| `Model.properties` | `Object.fields` |                        |

### Examples



<table>
  <tr>
    <th>TypeSpec</th>
    <th>GraphQL</th>
  </tr>
  <tr>
    <td>

```typespec
/** Simple output model */
model Image {
  id: int32,
  url: str,
}

/** Operation */
op getImage(
  id: int32,
  size: str,
): Image;
```

</td>
    <td>

```graphql
type Image {
  id: Int!
  url: String!
}
type Query {
  getImage(id: Int!, size:String!): Image!
}
```

</td>
  </tr>
  <tr>
    <td>

```typespec
/** empty output model */
model Image {}
/** Operation with empty model */
op getImage(id: int32, size: str): Image;
```

</td>
    <td>

<p>This results in an error</p>

</td>
  </tr>
  <tr>
    <td>

```typespec
/** empty model as a field */
model Image {}
/** regular model */
model User {
  image: Image;
}
op getUser(id: int): User;
```

</td>
    <td>

<p>This results in an error</p>

</td>
  </tr>
  <tr>
    <td>

```typespec
/** ? vs null output model */
model Image {
  id?: int32
  url: str | null;
}
/** operation */
op getImage(
  id: int32,
  size: str,
): Image;
```

</td>
    <td>

```graphql
type Image {
  id: Int
  url: String
}
type Query {
  getImage(id: Int!, size:String!): Image!
}
```

Based on <a href="https://spec.graphql.org/draft/#sec-Value-Completion">result coercion rules</a> if `url` is non-null, then `null` or `undefined` will raise an error. So, we need to mark `url` as not required in GraphQL.
    </td>
  </tr>
</table>

More complicated examples with unions, interfaces, and lists are described in their respective sections.

## Input Types

### Context and design challenges

Use the `UsageFlags.INPUT` to determine if a TSP `model` is an `input` type. The following validation rules apply to `input` types:

* Unions and Interfaces are not part of the `input` type.
* `Input` types may not be defined as an [unbroken chain of Non-Null singular fields](https://spec.graphql.org/October2021/#sec-Input-Objects.Circular-References) as shown below


```typespec
# This is invalid

input Example {
  self: Example!
  name: String
}

# This is also invalid
input First {
  second: Second!
  name: String
}

input Second {
  first: First!
  value: String
}
```

* For an `optional` input type, a `null` value can be provided, and that would be assigned to this type. `Optional` input types can also be “missing” from the input map. `Null` and `missing` are treated differently.

### Design Proposal

To emit a valid GraphQL and still represent the schema defined in TypeSpec, the emitter will follow these rules:

- If the Input model is `Scalar` or `Enum`, the type is generated normally.
- If the input type is a `Model` and all the properties of the `Model` are of valid Input types, a new `Input` object will be created in GraphQL, with the typename as the original type \+ `Input` suffix.
  - **🔴 Design decision:** All models are created with the `Input` suffix regardless of whether or not it is used as both, because the model can be used as both `input` and `output` in the future and changing the type name will cause issues with schema evolution.
  - **Cons:** the `Input` suffix can be annoying or result in types like `UserInputInput`
- If the `model` or its properties are invalid Input types, an error will be raised.
  - **🔴 Design decision:** In order to provide a different definition of the same field so that the GraphQL type can be represented more accurately, we will use [visibility](#visibility--never), see the examples to see what that could look like.
- If the `model` contains an unbroken chain of non-null singular fields, throw an error and fail the emitter process

#### Mapping

| TypeSpec           | GraphQL         | Notes                  |
|:-------------------|:----------------|:-----------------------|
| `Model.name`       | `Object.name`   | See Naming conventions |
| `Model.properties` | `Object.fields` |                        |

### Examples
<table>
    <tr>
      <th>TypeSpec</th>
      <th>GraphQL</th>
    </tr>
    <tr>
      <td>

```typespec
/** Valid Input Model */
model UserData {
  name: string;
  email?: string;
  age: int | null;
}
/** created user */
model User {
  ... UserData
  id: int32;
}
@mutation
op createUser(userData: UserData): User
```

</td>
      <td>

```graphql
input UserDataInput {
  name: String!
  email: String
  age: Int
}
type User {
  name: String!
  email: String
  age: Int
  id: Int!
}
type Mutation {
  createUser(userData: UserDataInput!): User!
}
```

</td>
    </tr>
    <tr>
      <td>

```typespec
/** invalid input model */
model UserData {
  pet?: Pet;
  name: string;
  email?: string;
  age: int | null;
}
/** created user */
model User {
  ... UserData
  id: int32;
}
union Pet {
  dog: Dog,
  cat: Cat
}
@mutation
op createUser(userData: UserData): User
```

</td>
      <td>
        <p>This results in an error</p>

</td>
    </tr>
    <tr>
      <td>

```typespec
/** common fields */
model UserFields {
  name: string;
  email?: string;
  age: int | null;
}
/** invalid input model */
model UserData {
  pet?: Pet;
  ... UserFields
}
model UserDataGql {
  dog?: Dog
  cat?: Cat
  ... UserFields
}
union UserInputPerProtocol {
  @invisbile(HttpVis)
  UserDataGql,
  @invisible(GraphQLVis)
  UserData,
}
/** created user */
model User {
  ... UserData
  id: int32;
}
union Pet {
  dog: Dog,
  cat: Cat
}
@mutation
op createUser(userData: UserInputPerProtocol): User
```

</td>
      <td>

```graphql
input UserDataGqlInput {
  dog: Dog
  cat: Cat
  name: String!
  email: String
  age: Int
}
type User {
  pet: Pet
  name: String!
  email: String
  age: Int
  id: Int!
}
union Pet = Dog | Cat
type Mutation {
  createUser(userData: UserDataGqlInput!): User!
}
```

</td>
    </tr>
    <tr>
      <td>

```typespec
model UserData {
  identity: Identity;
  numFollowers: int;
  profession: Profession
}
model Profession {
  isEmployed: boolean;
  employer: string;
}
model Identity {
  user: UserData;
  gender: string;
}
model User {
  id: string;
}
op createUser(userData: UserData): User
```

</td>
      <td>
        <p>Throw an error in emitter validation</p>
      </td>
    </tr>
</table>

### Design Alternatives

**For specifying GraphQL/HTTP specific types:**

1. Create a new decorator to allow the TSP entities to belong to different protocols. This would be part of the TSP library similar to `invisible` and `visible`
2. Use this new way to define protocol specific entities

**Auto-resolve unwrapping of unions**

1. Even with the `@invisible` decorator applied to `union variants`, the emitter creators will have to deal with the auto-unwrapping of unions with just one variant. As this would be common functionality to all emitters, perhaps this should be done in a common place like by the TSP compiler

## Scalars

### Context and design challenges

[GraphQL](https://spec.graphql.org/October2021/#sec-Scalars.Built-in-Scalars) only provides five built-in scalars: Int, String, Float, Boolean and ID.
Any other scalar should be added as a custom scalar, and the @specifiedBy directive should be added to provide a specification.
The ID scalar type represents an unique identifier, as defined [here](https://spec.graphql.org/October2021/#sec-ID).

### Design Proposal

The emitter will use the mappings provided below to map TypeSpec to GraphQL scalars, trying to emit as a built-in scalar when possible.
For the custom scalars, if the TypeSpec documentation mentions a specification, that will be used for the @specifiedBy directive. If not provided, we will use a link to the TypeSpec documentation: [https://typespec.io/docs/standard-library/built-in-data-types/](https://typespec.io/docs/standard-library/built-in-data-types/)
Encodings provided by the @encode decorator in TSP code would also be considered to build the proper custom scalar.
We are proposing a new TypeSpec native decorator @specifiedBy over scalars to allow developers to provide their own references. If provided, the emitter will use the information to generate the GraphQL directive.
To handle the ID type, the emitters library will include a TypeSpec scalar:

```typespec
/** GraphQL ID") */
scalar ID extends string;
```

**Type Mappings to GraphQL Built-In Scalars**

| TypeSpec                                                   | GraphQL   | Notes                                                                                                                                                       |
|:-----------------------------------------------------------|:----------|:------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `string`                                                   | `String`  |                                                                                                                                                             |
| `boolean`                                                  | `Boolean` |                                                                                                                                                             |
| `int32` `int16` `int8` `safeint` `uint32` `uint16` `uint8` | `Int`     | [GraphQL Int is a 32-bit Integer](https://spec.graphql.org/October2021/#sec-Int) Alternatively, we can define a Scalar for every specific TypeSpec type     |
| `float` `float32` `float64`                                | `Float`   | [GraphQL Float is double-precision](https://spec.graphql.org/October2021/#sec-Float) Alternatively, we can define a Scalar for every specific TypeSpec type |

**Type Mappings to GraphQL custom Scalars**

| TypeSpec               | encoding        | GraphQL                      | Primitive                           | specifiedBy                                                                   |
|:-----------------------|:----------------|:-----------------------------|:------------------------------------|:------------------------------------------------------------------------------|
| `integer` `int64`      |                 | `scalar BigInt`              | `String`                            |                                                                               |
| `numeric`              |                 | `scalar Numeric`             | `String`                            |                                                                               |
| `decimal` `decimal128` |                 | `scalar BigDecimal`          | `String`                            |                                                                               |
| `bytes`                | `base64`        | `scalar Bytes`               | `String`                            | [RFC4648](https://datatracker.ietf.org/doc/html/rfc4648)                      |
|                        | `base64url`     | `scalar BytesUrl`            | `String`                            | [RFC4648](https://datatracker.ietf.org/doc/html/rfc4648#section-5)            |
| `utcDateTime`          | `rfc3339`       | `scalar UTCDateTime`         | `String`                            | [RFC3339](https://datatracker.ietf.org/doc/html/rfc3339)                      |
|                        | `rfc7231`       | `scalar UTCDateTimeHuman`    | `String`                            | [RFC7231](https://datatracker.ietf.org/doc/html/rfc7231)                      |
|                        | `unixTimestamp` | `scalar UTCDateTimeUnix`     | `Int`                               |                                                                               |
| `offsetDateTime`       | `rfc3339`       | `scalar OffsetDateTime`      | `String`                            | [RFC3339](https://datatracker.ietf.org/doc/html/rfc3339)                      |
|                        | `rfc7231`       | `scalar OffsetDateTimeHuman` | `String`                            | [RFC7231](https://datatracker.ietf.org/doc/html/rfc7231)                      |
|                        | `unixTimestamp` | `scalar OffsetDateTimeUnix`  | `Int`                               |                                                                               |
| `unixTimestamp32`      |                 | `scalar OffsetDateTimeUnix`  | `Int`                               |                                                                               |
| `duration`             | `ISO8601`       | `scalar Duration`            | `String`                            | [ISO 8601-1:2019](https://www.iso.org/obp/ui/#iso:std:iso:8601:-1:ed-1:v1:en) |
|                        | `seconds`       | `scalar DurationSeconds`     | `Int` or `Float`, based on `@encode` |                                                                               |
| `plainDate`            |                 | `scalar PlainDate`           | `String`                            |                                                                               |
| `plainTime`            |                 | `scalar PlainTime`           | `String`                            |                                                                               |
| `url`                  |                 | `scalar URL`                 | `String`                            | [URL living standard](https://url.spec.whatwg.org/)                           |
| `unknown`              |                 | `scalar Unknown`             | `String`                            |                                                                               |

### Examples
<table>
    <tr>
      <th>TypeSpec</th>
      <th>GraphQL</th>
    </tr>
    <tr>
      <td>

```typespec
scalar password extends string;
scalar ternary;
```

</td>
      <td>

```graphql
scalar Password
scalar Ternary
```

</td>
    </tr>
</table>

## Unions

### Context and design challenges

* In GraphQL, all Unions should be named, while in TypeSpec anonymous Unions can be used.
* Scalars, Interfaces and Unions can't be member types of an Union. Therefore, in GraphQL nested Unions are not permitted.
* Unions can't be part of a GraphQL Input Object.

### Design Proposal

Generate 1:1 mapping for regular unions.
For nested unions, a single union will be recursively composed with all the variants implicitly defined in TypeSpec.
As the `interface` models are decorated with an `@Interface` decorator, throw a validation error when defining a `union` variant for a model type that is decorated with this.
Wrap the scalars in a wrapping object type and emit a union with those types.

Create explicit unions in GraphQL for anonymous TSP unions, naming them using the context where the Union is declared, for example using model and property names, or the operation and parameter names, or the operation name if used as a return type. And all cases with the "Union" suffix. (See examples). Note that this approach may generate identical GraphQL unions with distinct names. We will throw an error if there are naming conflicts.

There are some special cases with distinct treatments, like:

* Unions containing *`null`* type: see Nullability

#### Mapping

| TypeSpec      | GraphQL       | Notes                                                                                                                |
|:--------------|:--------------|:---------------------------------------------------------------------------------------------------------------------|
| `Union.name`  | `Union.name`  | Anonymous Unions can be represented as: <br><p>• ModelPropertyUnion<br>• OperationParameterUnion<br>• OperationUnion |
| `Union.types` | `Union.types` |                                                                                                                      |

### Examples
<table>
    <tr>
      <th>TypeSpec</th>
      <th>GraphQL</th>
    </tr>
    <tr>
      <td>

```typespec
/** Named Union */
union Animal {
  bear: Bear,
  lion: Lion,
}
```

</td>
      <td>

```graphql
union Animal = Bear | Lion
```

</td>
    </tr>
    <tr>
      <td>
        <p>Nested unions</p>

```typespec
/** Named Union */
union Animal {
  bear: Bear,
  lion: Lion,
}

/** Nested Union */
union Pet {
  cat: Cat,
  dog: Dog,
  animal: Animal,
}
```

</td>
      <td>

```graphql
union Pet = Cat | Dog | Bear | Lion
```

</td>
    </tr>
    <tr>
      <td>
        <p>Anonymous union in param</p>

```typespec
/** Anonymous Union in a parameter */
@query
op setUserAddress(
  id: int32,
  data: FullAddress | BasicAddress,
): User;
```

</td>
      <td>

```graphql
union SetUserAddresDataUnion = FullAddress | BasicAddress

type Query {
  setUserAddress(id: Int!, data: SetUserAddressDataUnion!): User!
}
```

</td>
    </tr>
    <tr>
      <td>
        <p>Named union of scalars</p>

```typespec
/** Named Union of Scalars */
union TwoScalars {
  text: string,
  numeric: float32,
}
```

</td>
      <td>

```graphql
union TwoScalars = TextUnionVariant | NumericUnionVariant

type TextUnionVariant {
  value: String!
}

type NumericUnionVariant {
  value: Float!
}
```

</td>
    </tr>
    <tr>
      <td>
        <p>Named union of scalars and models</p>

```typespec
union CompositeAddress {
  oneLineAddress: string,
  fullAddress: FullAddress,
  basicAddress: BasicAddress
}
```

</td>
      <td>

```graphql
type OneLineAddressUnionVariant {
  value: String!
}

union CompositeAddress = OneLineAddressUnionVariant | FullAddress | BasicAddress
```

</td>
    </tr>
    <tr>
      <td>
        <p>Anonymous union in return type</p>

```typespec
/** Anonymous Union in a return type */
op getUser(id: int32): User | Error;
```

</td>
      <td>

```graphql
union GetUserUnion = User | Error

type Query {
  getUser(id: Int!): GetUserUnion!
}
```

</td>
    </tr>
</table>

### Design Alternatives

**Union of scalars design alternative:**

- Don’t wrap the scalars, and just emit `Any` type.
  - Pros : We are not opinionated about how to represent scalars
  - Cons: there might be a lot of `Any` types


### Open Questions

- Think in a better naming rules to reduce or avoid duplicates

## Field Arguments

### Context and design challenges

* Fields (model properties) can receive [arguments](https://spec.graphql.org/draft/#sec-Language.Arguments).
* Field Arguments follow the same rules as operation parameters. (Actually, operation parameters are field arguments)
* The models directly or indirectly used in the field arguments should be declared as Input
* [Arguments are Unordered](https://spec.graphql.org/draft/#sec-Language.Arguments.Arguments-Are-Unordered)
* TypeSpec does not support arguments on model properties.

### Design Proposal

* Create a new decorator called `operationFields` that references `operations` or `interfaces` to be added to a model
* This will be used by the emitter to generate a field with arguments on the corresponding GraphQL type
* Operations and namespaces that are used in the `operationFields` decorator are not emitted as part of the root GraphQL operations like `query`, `mutation`, or `subscription`


```typespec
extern dec operationFields(target: Model, ...onOperations: Operation[] | Interface[])
```



#### Mapping

| TypeSpec               | GraphQL              | Notes                                              |
|:-----------------------|:---------------------|:---------------------------------------------------|
| `@operationFields`     | `Model`              | List of operations or interfaces are the arguments |
| `Operation.name`       | `Field.name`         | Model is the target of the decorator.              |
| `Operation.returnType` | `Field.type`         | Model is the target of the decorator.              |
| `Operation.parameters` | `Field.ArgumentsMap` | Model is the target of the decorator.              |

#### Decorators

| Decorator          | Target  | Parameters                                                                                    | Validations |
|:-------------------|:--------|:----------------------------------------------------------------------------------------------|:------------|
| `@operationFields` | `Model` | The operations or interfaces to be added as a field with arguments on the GraphQL object type |             |
| `@useAsQuery`      | `Model` | None                                                                                          |             |

### Examples
<table>
    <tr>
      <th>TypeSpec</th>
      <th>GraphQL</th>
    </tr>
    <tr>
      <td>

```typespec
@operationFields(ImageService.urls, followers)
model User {
  id: integer;
  name: string;
}

namespace ImageService {
  @operationFields(Images)
  model Image {
    id: integer;
    name: string;
  }
  op analyze(category: string): string
  op urls(size: string): url[] | null
}

// This decorator is used to create a custom query model
@useAsQuery
@operationFields(followers)
model MyOwnQuery {
  me: User
}

op followers(sort: string): User[]
```

</td>
      <td>

```graphql
type User {
  id: Int!
  name: String!
  followers(sort: String!): [User]!
  imageServiceUrls(size: String!): [URL!]
}

""" When model and operations are within the same namespace, don't append the namespace """
type Image {
  id: Int!
  name: String!
  analyze(category: String!): String!
  urls(size: String!): [URL!]
}

schema {
  query: MyOwnQuery
}

type MyOwnQuery {
  me: User
  followers(sort: String): [User]
}
```

</td>
    </tr>
</table>

Additional examples that show namespaces in GraphQL can be found here:

1. [Example with namespaces and operationFields within namespaces](https://typespec.io/playground/?c=aW1wb3J0ICJAdHlwZXNwZWMvaHR0cCI7Cgp1c2luZyBUeXBlU3BlYy5IdHRwO9AVUmVmbGVjdGlvbjsKCmV4dGVybiBkZWMgb3BlcmHEF0ZpZWxkcyh0YXJnZXQ6IE1vZGVsLCAuLi5vbk%2FIJHM6IMkMW10gfCBJbnRlcmZhY2VbXSk7CgpAc2VydmljZSh7CiAgdGl0bGU6ICJXaWRnZXQgU8YbIiwKfSkKCi8vIFRoaXMgaXMgYWxsIFVzZXIgc3R1ZmYKbmFtZXNwYWNlxRVzIMRLbeQAjcYlxA8gIGlkOiBpbnRlZ2VyO8URLi4uxSBDb21t5QDjICB9xAXKOsYax0DEZTogc3RyaW5nxkFhZ2XPU2dlbmRlcswmz1JQcm9maWxlSW5wdXTHWO4Ah8gzQHJvdXRlKCIvxBtzTXV05gFNIikKIMVz5QFCIMkYx0xAcG9zdCBvcCBjcmVhdGUocMZvOtF8KcYT5gC2QOQAjW9wIGJsb2NrKOsBKMsmfQogIPEAl1F1ZXJpZfAAlccW6ACT5AHJb3DkAbMox1DlAgdudWxsxll98QHb5AELZW508QHexxjGW0DwAodoYXPEXuQAjeYBcchH9wIAbGlrZXPPFGRpc9QX5AGkx07lAT%2FoARJvcCDHdu8BN2Jvb2xlYeYCVe0AjewB%2BmPGE%2BQCMcRDcy7qAZN0ZXh08QJH6QF9x0z%2FAhf6AhfHeTrtAJUpyQ%2FnAhZkZWxldGXEN8YK7wDjyy32AJ7%2FAh7tAh5ieeUBRXVz5AEN0WRbXegCKfEB9cQ3cy7pAPEpCuoDbOoBHyB72jvnAJDNOccU1jfoAN%2FSdfEBl99Bz3vvATjFPcYaxBJ55QEy5AEhc%2BcCL8co5AGB5wHRc%2BkBMsodyUXoAJbRSMgZ30rESi8qCkdlbuQAz2VzIHRoZSBmb2xsb3fkBjZHcmFwaFFMIHNjaGVtYQoK5AZy%2FgC5IdxvIcRvxUT%2FALhvbtdJyx%2FIS8x%2BxU9hbGw6IFvEFyFdyifxAYkKIO4CoUludCEpOiBbxynHPC8vIEFsbOUBF8RHcywgbm90IHdyaXR0ZW4gb3V0IGZ1bGx5LCBjaGVja8Uo5wQ9IGluxQ%2FnAMUgdGhvdWdo6gC05QCC5AN%2BxHkK5QSPYO0A1eoEVi4uLvAAyMUY7wRsLAogyH3uANRC5gS58QEN0GIqLw%3D%3D&e=%40typespec%2Fopenapi3&options=%7B%22linterRuleSet%22%3A%7B%22extends%22%3A%5B%22%40typespec%2Fhttp%2Fall%22%5D%7D%7D)
2. [Example when namespaces are only used in the TSP context if the design doesn’t make use of them, but are disambiguated at the top level](https://typespec.io/playground/?c=aW1wb3J0ICJAdHlwZXNwZWMvaHR0cCI7Cgp1c2luZyBUeXBlU3BlYy5IdHRwO9AVUmVmbGVjdGlvbjsKCmV4dGVybiBkZWMgb3BlcmHEF0ZpZWxkcyh0YXJnZXQ6IE1vZGVsLCAuLi5vbk%2FIJHM6IMkMW10gfCBJbnRlcmZhY2VbXSk7CgpAc2VydmljZSh7CiAgdGl0bGU6ICJXaWRnZXQgU8YbIiwKfSkKCi8vIFRoaXMgaXMgYWxsIFVzZXIgc3R1ZmYKbmFtZXNwYWNlxRVzIMRLbeQAjcYlxA8gIGlkOiBpbnRlZ2VyO8URLi4uxSBDb21t5QDjICB9xAXKOsYax0DEZTogc3RyaW5nxkFhZ2XPU2dlbmRlcswmz1JQcm9maWxlSW5wdXTHWO4Ah8gzQHJvdXRlKCIvxBtzTXV05gFNIinEHG3HDwogxX%2FlAU4gySTHWEBwb3N0IG9wIGNyZWF0ZShwxns68QCIKcYT5gDCQOQAmW9wIGJsb2NrKOsBNMsmfQogIPEAo1F1ZXJpZecAoXF1ZXJ57QCexx%2FoAJzkAd5vcOQByCjHWeUCHG51bGzGYn3xAfDkASBlbnTxAfPHGMZbQPACnGhhc8Re5ACW5gGGyEf3AhVsaWtlc88UZGlz1BfkAbnHTuUBSOgBG29wIMd27wFAYm9vbGVh5gJq7QCN7AIPY8YT5AJGxENzLuoBnHRleHTxAlzpAYbHTP8CLP8CLOcCLOcAhTrtAKEpyQ%2FnAitkZWxldGXEN8YK7wDvyy32AKr%2FAjP2AjNieeUBWnVz5AEi0W1bXekCPioKR2Vu5AINZXMgdGhlIGZvbGxvd%2BQE4UdyYXBoUUwgc2NoZW1hCgonJycKTm90ZSB0aGF06AGBcyBnZXRzIGFkZGVkIGZyb23FReoCd3TkAptiZWxvbmdzIHRvxUXkBWblALd55QC15ACkc0HmAuNb5AC2IeQAnshgQuwAyUludCHEJucAxyFdIeQAxMVQ6AGsylND%2FwPRxErFb8gxQukDzcdo6AJU6ACMx1L1AffEMMcQxFHIM0TqAfPHVckl5gO8QWxs5QEz5QZ7LCBub3Qgd3JpdHRlbuYA2OkFm8hDCuUDU2DpAPnEIeoDGi4uLska7APE7wMwLAog6QN%2BKdAx0E4qLw%3D%3D&e=%40typespec%2Fopenapi3&options=%7B%22linterRuleSet%22%3A%7B%22extends%22%3A%5B%22%40typespec%2Fhttp%2Fall%22%5D%7D%7D)

### Design Alternatives

* \[DISCARDED\] `@parameters({arg1: type1; arg2: type2;})` decorator targeting Model Properties.
  We prototyped this, but found issues when validating/generating the Input types.
* \[DISCARDED\] `@mapArguments(modelProperty, arg1, agr2, …)` decorator over Operations, where arg1, arg2, etc. are the name of the parameters of the target operation to map as arguments of the modelProperty. 
* \[DISCARDED\] `@modelRoute(model)` decorator over Operations, where the model is passed as a parameter to the decorator. This would be used to map the operation as a new parameterized field of a model.

## Interfaces

### Context and design challenges

There is no way to represent GraphQL Interfaces in TSP directly. We’ll use a combination of special decorators and the spread operator to achieve this for the GraphQL emitter.
Only [Output Types](#output-types) can be decorated as an `Interface`. If an `Input Type` is decorated as an `Interface`, **a decorator validation error must be thrown.**

### Design Proposal

GraphQL Interfaces will be defined using the two specific decorators outlined below:

```typespec
extern dec Interface(target: Model);
extern dec compose(target: Model, ...implements: Interface.target[]);
```

The `@Interface` decorator will designate the TSP model to be used as an Interface in GraphQL. This model will be emitted as the `GraphQLInterface` type.

The `@compose` decorator designates which `Interface`s should the current model be composed of. The `@compose` decorator can only refer to other models that are marked with the `@Interface` decorator and not vanilla model types.

#### Mapping

| TypeSpec     | GraphQL                   | Notes                                                                                               |
|:-------------|:--------------------------|:----------------------------------------------------------------------------------------------------|
| `@Interface` | `interface`               |                                                                                                     |
| `Model`      | `interface (Output Type)` | Note only output models can be interfaces                                                           |
| `@compose`   | `extends Iface1, Iface2…` | @compose can be used either with a combination of the @Interface decorator or on the model directly |

#### Decorators

| Decorator    | Target | Parameters                         | Validations                                                                                                             |
|:-------------|:-------|:-----------------------------------|:------------------------------------------------------------------------------------------------------------------------|
| `@Interface` | Model  |                                    | Can be assigned only to an output model                                                                                 |
| `@compose`   | Model  | Targets of the Interface decorator | Can be assigned only to an output model All the fields of the models from `compose` must be present in the target model |

### Examples
<table>
    <tr>
      <th>TypeSpec</th>
      <th>GraphQL</th>
    </tr>
    <tr>
      <td>

```typespec
alias ID = string

@Interface
model Node {
  id: ID;
}

@Interface
@compose(Node)
model Person {
  id: ID;  // This is from Node
  ... Identity // This is just for TSP spread
}

model Identity {
  birthDate: plainDate;
  age?: integer;
}

@compose(Person)
model Actor {
  ... Person
  rating: string;
}
```

<p>Fields within the composed model can be defined using either <code>...</code> operator or manually, both are valid</p>
      </td>
      <td>

```graphql
scalar PlainDate

interface Node {
  id: ID!
}

interface Person implements Node {
  id: ID!
  birthDate: PlainDate!
  age: Int
}

type Actor implements Node & Person {
  id: ID!
  birthDate: PlainDate!
  age: Int
  rating: String!
}
```

<p>GraphQL requires both Person and Node to be explicitly implemented by Actor.</p>
      </td>
    </tr>
</table>

### Design Alternatives

* \[Discarded\] Spread the fields of models defined in `compose` automatically – this wouldn’t be great because then `compose` would change the shape of the model just for GraphQL
* \[Discarded\] Don’t define the `Interface` and assume interfaces from models used in `compose`. Since GraphQL has an explicit concept of `Interface` we’re representing that using this decorator. If validation rules specific to `Interface`s need to be applied in the future, it will be possible to do so

## Enums

> [!WARNING]
> This section is under review and possible reconsideration.

### Context and design challenges

TSP enum member types have no meaning in GraphQL and the enum member values should follow the naming convention shown below (similar to all other literal names). From the GraphQL spec: “[*EnumValue*](https://spec.graphql.org/October2021/#EnumValue)
[*Name*](https://spec.graphql.org/October2021/#Name) **but not true false null”**

where [*Name*](https://spec.graphql.org/October2021/#Name) should start with \[A-Za-z\] or \<underscore\> and can be followed by letter, digit, or \<underscore\>

GraphQL Recommendation: “It is recommended that Enum values be “all caps”. Enum values are only used in contexts where the precise enumeration type is known. Therefore it’s not necessary to supply an **enumeration type name** in the literal.”

### Design Proposal

Use TypeSpec enums in the [value context](https://typespec.io/docs/language-basics/values/#enum-member--union-variant-references) as GraphQL doesn’t need the type information.

TypeSpec enums with no types that can only be identifiers or string literals will be translated to all caps GraphQL enums as long as the identifiers are valid GraphQL names. If they are invalid, the emitter will throw a validation error.

🔴 **Design decision:** TypeSpec enums with integer or floating point values will be converted to a string value using the following rules to create `result`:

1. Initialize `result` to `_`
2. If the integer is negative add the word `NEGATIVE_` to the result string
3. Create a string representation of the integer or create a string representation of the floating point value where `.` is converted to an `_`
4. Append the string representation to `result`

**Pros:** The GraphQL enum is a string representation of the `value` and reflects the true intention of the developer

**Cons:** The server side implementation will have to figure out the translation between the GraphQL enum and the internal representation of the enum where the algorithm isn’t obvious (i.e. they will basically have to implement the steps above).

Inline enums that don’t have an enum name will be assigned a distinct name based on where the field appears in the TSP schema. The name derived from the field will be followed by an `Enum` suffix. To provide disambiguation, the full name should be `namespace` \+ `modelName` \+ `fieldName`. See the examples table for an example.

```typespec
Inline enum:
size?: "small" | "medium" | "large"
```

#### Mapping

| TypeSpec       | GraphQL        | Notes                  |
|:---------------|:---------------|:-----------------------|
| `Enum.name`    | `Enum.name`    | See Naming conventions |
| `Enum.members` | `Enum.members` |                        |

### Examples
<table>
    <tr>
      <th>TypeSpec</th>
      <th>GraphQL</th>
    </tr>
    <tr>
      <td>

```typespec
/** Simple Enum */
enum Direction {
  North,
  East,
  South,
  West,
}
```

</td>
      <td>

```graphql
enum Direction {
  NORTH
  EAST
  SOUTH
  WEST
}
```

</td>
    </tr>
    <tr>
      <td>

```typespec
/** Enum with Values */
enum Hour {
  Nothing: 0,
  HalfofHalf: 0.25,
  SweetSpot: 0.5,
  AlmostFull: 0.75,
}
```

</td>
      <td>
        <p>Convert the hour values into GraphQL enum values</p>

```graphql
enum Hour {
  _0
  _0_25
  _0_5
  _0_75
}
```

<p>Note that we don’t use the type as TSP types might only have meaning within the TSP code and not the emitted protocol</p>
      </td>
    </tr>
    <tr>
      <td>

```typespec
enum Boundary {
  zero: 0,
  negOne: -1,
  one: 1
}
```

</td>
      <td>
        <p>Convert Boundary values into GraphQL enum values</p>

```graphql
enum Boundary {
  _0
  _NEGATIVE_1
  _1
}
```

</td>
    </tr>
    <tr>
      <td>

```typespec
namespace DemoService;
model Person {
  size?: "small" | "medium" | "large"
}
```

</td>
      <td>
        <p>Derive a unique name based on the namespace, model, field name \+ “Enum”</p>

```graphql
enum DemoServicePersonSizeEnum {
  SMALL
  MEDIUM
  LARGE
}
```

</td>
    </tr>
</table>

### Design Alternatives

1. Use the type name instead of values for integer and floating point values. But, we would need to be consistent and use TSP enums in the type context rather than the value context which feels wrong.
2. Emit `Any` for enums with values as integers or floating points and let the developer define an alternate type [using visibility](#visibility--never).
   1. If the `@invisible` decorator can be applied to `EnumMembers`, we can provide alternate enum members for GraphQL in the same enum definition which change the emitter to emit the GraphQL enum values as shown below:



```typespec
enum Hour {
  @invisible(GraphQLVis) Nothing: 0,
  @invisible(GraphQLVis) HalfofHalf: 0.25,
  @invisible(GraphQLVis) SweetSpot: 0.5,
  @invisible(GraphQLVis) AlmostFull: 0.75,
  ... GraphQLHour
}

@invisible(HttpVis)
enum GraphQLHour {
  Nothing: "zero",
  HalfofHalf: "quarter",
  SweetSpot: "half",
  AlmostFull: "threeQuarters",
}
```


====================================  GRAPHQL  ====================================

```graphql
enum Hour {
   ZERO
   QUARTER
   HALF
   THREEQUARTER
}
```

## Operations

### Context and design challenges

There are three kinds of [GraphQL Operations](https://spec.graphql.org/draft/#sec-Executing-Operations): Query, Mutation and Subscription. While in [TypeSpec](https://typespec.io/docs/language-basics/operations) there is no difference between them.

- At least one query operation should be included in the schema.
- The models directly or indirectly used in the operation parameters should be declared as [Input types](#input-types)
- The models directly or indirectly used as the operation result type should be declared as Output types

### Design Proposal

To distinguish between Queries, Mutations and Subscription, we are proposing to include a set of three decorators in TypeSpec: @query, @mutation and @subscription.  These will decorate the TSP Operations to indicate the GraphQL kind.
The decorators would also be added to an interface, understanding that all operations within the interface would be of the provided kind.
The GraphQL emitter will generate the proper GraphQL kind for each Operation, according to these rules:

1. Follow the explicit definition of any of the decorators: @query, @mutation, @subscription
2. If the decorator is not provided, then:
   1. If the strictEmit option is on, the operation would be omitted from the GraphQL schema
   2. If the strictEmit option is off, then:
      1. If the Operation is marked with @http.get or @http.head the Operation will be generated as a Query
      2. If the Operation is marked as @http.put, @http.post @http.patch or @http.delete, the Operation will be generated as a Mutation
      3. if the Operation is not  marked with any http verb, we fallback to the OpenAPI emitter behavior as follows:
         1. If any of the parameters of the Operation is marked with @http.path, the emitter defaults to `query,`
         2. Else, the operation will be emitted as Mutations, because the OpenAPI emitter defaults to `post`.


The Operation parameters will be converted to GraphQL arguments following the rules for the GraphQL Input types.
The Operation return type should be a valid GraphQL Output Type.
In line with the Field Arguments design, the operations decorated directly or indirectly with the @operationFields decorator, would not be added as query, mutations or subscriptions.
When no operation is emitted, an empty schema will be generated.
When mutations are provided, but there are no query operations, a dummy Query will be added to the schema to make it valid.

#### Mapping

| TypeSpec                                                     | GraphQL          | Notes                                                                              |
|:-------------------------------------------------------------|:-----------------|:-----------------------------------------------------------------------------------|
| `@GraphQL.query` `@GraphQL.mutation` `@GraphQL.subscription` | (operation) `Type` | If decorators are not present, some rules will apply to define the operation Type. |
| `Operation.name`                                             | `name`           | See Naming conventions                                                             |
| `Operation.returnType`                                       | `type`           | See Output Types                                                                   |
| `Operation.parameters`                                       | `args`           | See Input Types                                                                    |

**Decorators**

| Decorator       | Target                   | Parameters | Validations (on VS Code and at TSP compile time)                      |
|:----------------|:-------------------------|:-----------|:----------------------------------------------------------------------|
| `@query`        | `Operation`, `Interface` | N/A        | Just one of these decorators should be applied to the same Operation. |
| `@mutation`     | `Operation`, `Interface` | N/A        |                                                                       |
| `@subscription` | `Operation`, `Interface` | N/A        |                                                                       |

### Examples
<table>
    <tr>
      <th>TypeSpec</th>
      <th>GraphQL</th>
    </tr>
    <tr>
      <td>

```typespec
/** Explicit Query */
@GraphQL.query
op getUser(id: int32): User;

/** Explicit Mutation */
@GraphQl.mutation
op setUserName(
  id: int32,
  name: string
): User;

@doc("Mutation bg @HTT.post")
@HTTP.post
op setUserPronouns(
  id: int32,
  prononuns: String,
): User;

/** Mutation bc body param */
op setUserAddress(
  id: int32,
  @HTTP.body
  address: Address
): User;

@doc("Query bc HTTP.get")
@HTTP.get
op getUsersByAddress(
  @HTTP.body
  address: Address
): User[];

@doc("Query bc HTTP.path")
@HTTP.get
op getUserAddressById(
  @HTTP.path
  id: int32,
): Address;

/** Mutation by default */
op getCurrentUser(): User;
```

</td>
      <td>

```graphql
type Query {
  getUser(id: Int): User!
  getUsersByAddress(address: Address): [User!]
  getUserAddressById(id: Int): Address!
}

type Mutation {
  setUserName(id: Int, name: String): User!
  setUserPronouns(id: Int, pronouns: String): User!
  setUserAddress(id: Int, address: Address): User!
  getCurrentUser(id: Int): User!
}
```

</td>
    </tr>
    <tr>
      <td>

```typespec
/** Schema with a single Mutation */
@GraphQl.mutation
op setUserName(
  id: int32,
  name: string
): User;
```

</td>
      <td>

```graphql
""" Dummy Query """
type Query {
  _: Boolean
}

type Mutation {
  setUserName(id:Int, name: String): User
}
```

</td>
    </tr>
    <tr>
      <td>

```typespec
/** ERROR: Duplicated GraphQL operation kind */
@GraphQl.query
@GraphQl.mutation
op setUser(
  id: int32,
  name: string
): User;
```

</td>
      <td>
        <p><strong>Decorator Validation Errors</strong></p>
      </td>
    </tr>
</table>

## Lists

### Context and design challenges

TSP defines a `list` and `Array` builtin types and both of those need to be converted to GraphQL lists. GraphQL lists are wrappers over output and input types.

### Design Proposal

For TSP lists (`[]`) and arrays (`Array`) used as types of properties, parameters and operations, we will emit the corresponding list of types in GraphQL.

#### Mapping

| TypeSpec     | GraphQL     | Notes |
|:-------------|:------------|:------|
| `List.type`  | `List.type` |       |
| `Array.type` | `List.type` |       |

### Examples
<table>
    <tr>
      <th>TypeSpec</th>
      <th>GraphQL</th>
    </tr>
    <tr>
      <td>

```typespec
/** Lists as property types */
model User {
  id: int32;
  pronouns: string[];
  groups: Group[];
}

/** Lists as op return types */
op getUserAddresses(
  id: int32;
): User[];

model Pet {
  id: int32;
  names: Array<string>;
}
```

</td>
      <td>

```graphql
type User {
  id: Int!
  pronouns: [String!]!
  groups: [Group!]!
}

type Query {
  getUserAddresses(id: Int!): [User!]!
}

type Pet {
  id: Int!
  names: [String!]!
}
```

</td>
    </tr>
    <tr>
      <td>

```typespec
model Foo {
  a: string[];
  b: Array<string | null>;
  c?: string[];
  d: string[] | null;
}
```

</td>
      <td>

```graphql
type Foo {
  a: [String!]!
  b: [String]!
  c: [String!]
  d: [String!]
}
```

<p>Note the difference in the requiredness of the values vs the list itself for the various options</p>
      </td>
    </tr>
</table>

## Nullable vs Optional

> [!WARNING]
> This section is under review. The approach described here will be overhauled if our [Contextual Requiredness proposal](https://github.com/pinterest/typespec/blob/santa/optionality/packages/graphql/letter-to-santa/optionality.md) is accepted. 

### Context and design challenges

In [GraphQL](https://spec.graphql.org/October2021/#sec-Non-Null.Nullable-vs-Optional), all properties and parameters are nullable by default, and the *`!`* operator is applied to indicate non-nullability.
And although all fields are optional; for parameters, Input fields are required if they are marked as non-nullable.

In TypeSpec non-nullable is the default, while nullability is expressed by an Union that includes the *`null`* type. Also in TypeSpec: all the fields are required, unless are marked optional with the *`?`* operator.

### Design Proposal

All output types and return types will be emitted in GraphQL as non-nullable (*`!`* operator), except when the field is marked as optional, or when the type of the field is an Union containing the TypeSpec *`null`* type.

We can also use the same rules for Input fields, but we will force the field as required if the property or the argument is not nullable. Alternatively, we can throw an error.

| TypeSpec                 | GraphQL Output  | GraphQL Input   |
|:-------------------------|:----------------|:----------------|
| `name: string;`          | `name: String!` | `name: String!` |
| `name?: string;`         | `name: String`  | `name: String!` |
| `name: string \| null;`  | `name: String`  | `name: String`  |
| `name?: string \| null;` | `name: String`  | `name: String ` |

### Examples
<table>
    <tr>
      <th>TypeSpec</th>
      <th>GraphQL</th>
    </tr>
    <tr>
      <td>

```typespec
model User {
  id: int32;
  name: string;
  pronouns?: string;
  birthYear: int32 | null;
  followers: User[];
  pet: Pet | null;
}
op getCurrentUser: User;
op getPet(user: User): Pet | null;
```

</td>
      <td>

```graphql
type User {
  id: Int!
  name: String!
  pronouns: String
  birthYear: Int
  followers: [User]!
  pet: Pet
}
type Query {
  getCurrentUser: User!
  getPet(user: User!): Pet
}
```

</td>
    </tr>
    <tr>
      <td>

```typespec
model User {
  id: int32;
  name: string;
  pronouns?: string;
  birthYear?: int32 | null;
  pet: Pet | null;
}
op patchUser(
  user: User
): User;
op patchUserNullable(
  user: User | null
): User;
op patchUserOptional(
  user?: User
): User;
op patchUserNullableOptional(
  user?: User | null
): User;
```

</td>
      <td>

```graphql
type User {
  id: Int!
  name: String!
  pronouns: String
  birthYear: Int
  pet: Pet
}
input UserInput {
  id: Int!
  name: String!
  pronouns: String!
  birthYear: Int
  pet: Pet
}
type Query {
  patchUser(user: UserInput!): User!
  patchUserNullable(user: UserInput): User!
  patchUserOptional(user: UserInput!): User!
  patchUserNullableOptional(user: UserInput): User!
}
```

</td>
    </tr>
</table>

### Design Alternatives

* \[DISCARDED\] Ignore TSP Optional operator and use only nullability.
* Throw an error for Input types when they are nullable and not optional.

## Visibility & Never

### Context and design challenges

* TypeSpec have two ways to filter out properties from Models:
  * Visibility, using `@visibilty`, `@invisible`, `@withVisibility`, et al decorators.
  * `never` type
* The filtering based on explicit filtered models using `@withVisibility` is already considered in the compiler, so it will be also included in the emitter.
* HTTP library has the [automatic visibility](https://typespec.io/docs/libraries/http/operations/#automatic-visibility) concept that automatically filters the properties from the model based on the HTTP type of the operation, with no need of generating explicit filtered models.
* According to the note in the TypeSpec [documentation](https://typespec.io/docs/language-basics/models/#never), it is the responsibility of the emitters to exclude the fields of type *`never`*.


### Design Proposal
Add to the emitter the handling of the *`never`* type, and exclude any field from the Model before emitting the Model.
Note: This may result in empty models. We need to define what to do with fields pointing to empty Models.

Create a new [visibility class](https://typespec.io/docs/language-basics/visibility/#basic-concepts) named `OperationType`:

```typespec
enum OperationType {
  Query,
  Mutation,
  Subscription,
}
```

For implicit filtered models (automatic visibility):

GraphQL does not have an equivalent concept like HTTP verbs that map to the `Lifecycle` visibility modifiers. However, GraphQL mutations will commonly adhere to these type of "CRUD" operations.

TSP developers will need to take advantage of the [`@parameterVisibility`](https://typespec.io/docs/standard-library/built-in-decorators/#@parameterVisibility) and [`@returnTypeVisibility`](https://typespec.io/docs/standard-library/built-in-decorators/#@returnTypeVisibility) decorators to filter the models based on the semantic operation type.
In the case where the operation does not have explicit visibility specified and is already decorated with an HTTP verb, the emitter will use [the HTTP library specification](https://typespec.io/docs/libraries/http/operations/#automatic-visibility) to apply the related visibility to the input types.

If none of the standard "CRUD" operations apply, whether the [operation](#operations) is a query, mutation, or subscription will apply the `OperationType.Query`, `OperationType.Mutation`, or `OperationType.Subscription` visibility to input types, respectively.

For practical reasons, we will follow lead of the HTTP library on response types and filter them to `Lifecycle.Read` by default.

Generated model names will be suffixed with the appropriate operation type, e.g. `UserQueryInput`, `UserRead`, `UserCreateInput`, `UserMutationInput`, etc.
The new models would be generated only if they are distinct from the original Model.

### Examples
<table>
    <tr>
      <th>TypeSpec</th>
      <th>GraphQL</th>
    </tr>
    <tr>
      <td>

```typespec
/** Never and explicit filtering */
model PostBase<TState>; {
  @visibility(Lifecycle.Read)
  id: int32;
  title: string;
  isPopular: boolean;
  @visibility(Lifecycle.Update)
  poster?: Person;
  postState: TState;
  postCountry?: Country;
}
model Post is PostBase<int32>;
model PostGql is PostBase<never>;
@withVisibility(Lifecycle.Read)
model PostRead {
  ...Post;
}
```

</td>
      <td>

```graphql
""" postState is Int """
type Post {
  id: Int!
  title: String!
  isPopular: Boolean!
  poster: Person
  postState: Int!
  postCountry: Country
}

""" No postState is present due to never """
type PostGql {
  id: Int!
  title: String!
  isPopular: Boolean!
  poster: Person
  postCountry: Country
}

""" No poster because the visibility is read """
type PostRead {
  id: Int!
  title: String!
  isPopular: Boolean!
  postState: Int!
  postCountry: Country
}
```

</td>
    </tr>
    <tr>
      <td>

```typespec
/** Automatic visibility with HTTP */
model User {
  name: string;
  @visibility(Lifecycle.Read, Lifecycle.Update) id: string;
  @visibility(Lifecycle.Create) password: string;
  @visibility(Lifecycle.Read) lastPwdReset: plainDate;
}
@route("/users")
interface Users {
  @post create(user: User): User;
  @get get(@path id: string): User;
  @patch set(user: User): User;
}
```

</td>
      <td>

```graphql
scalar plainDate

""" Create automatic types """
type User {
  name: String!
  id: String!
  password: String!
  lastPwdReset: plainDate!
}

type UserRead {
  name: String!
  id: String!
  lastPwdReset: plainDate!
}

type UserCreateInput {
  name: String!
  password: String!
}

type UserUpdateInput {
  name: String!
  id: String!
}

type Query {
  get(id: String!): UserRead!
}

type Mutation {
  create(user: UserCreateInput): UserRead!
  set(user: UserUpdateInput!): UserRead!
}
```

</td>
    </tr>
    <tr>
      <td>

```typespec
/** Automatic visibility with GraphQL */
model User {
  name: string;
  @visibility(Lifecycle.Read, Lifecycle.Update) id: string;
  @visibility(Lifecycle.Create) password: string;
  @visibility(Lifecycle.Read) lastPwdReset: plainDate;
}
interface Users {
  @mutation create(user: User): User;
  @query get(id: string): User;
  @mutation set(user: User): User;
}
```

</td>
      <td>

```graphql
scalar plainDate

type User {
  name: String!
  id: String!
  password: String!
  lastPwdReset: plainDate!
}

type UserRead {
  name: String!
  id: String!
  lastPwdReset: plainDate!
}

type UserMutationInput {
  name: String!
  id: String!
  password: String!
}

type Query {
  get(id: String!): UserRead!
}

type Mutation {
  create(user: UserCreateInput): UserRead!
  set(user: UserUpdateInput!): UserRead!
}
```

</td>
    </tr>
</table>

### Open Questions

* Define what to do with fields pointing to empty models
* Should we keep the original Models in the schema, even if they are not used?
* We should expect that `<Model>Read` types will be the most common; should we have the `Lifecycle.Read`-filtered model instead be called `<Model>`, and the unfiltered model be something like `<Model>Full`?

## User feedback:

The emitter will generate feedback for the developers through errors and warnings. But the warning list could be enormous and not easy to read, especially when trying to emit a GraphQL from a large TSP specification not specifically designed for GraphQL.
With this in mind we are proposing to emit a "How to improve your TypeSpec scheme for GraphQL" report based on the warnings and other signals. The purpose is to help developers to generate a better GraphQL schema, introducing the GraphQL decorators and other tricks to their TypeSpec code. The report should be more readable than the warnings.

## Typespec extension suggestions
- [Requiredness and Optionality in TypeSpec](https://github.com/pinterest/typespec/blob/santa/optionality/packages/graphql/letter-to-santa/optionality.md)
