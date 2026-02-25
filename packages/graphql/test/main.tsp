import "@typespec/graphql";

using TypeSpec.GraphQL;

@schema
namespace TestSchema {
  // ===================================================================
  // 1. Custom Scalars
  //    User-defined scalars emit as `scalar <Name>` in GraphQL.
  // ===================================================================

  /** An ISO-8601 date-time string */
  scalar DateTime;

  /** Arbitrary JSON blob */
  scalar JSON;

  // ===================================================================
  // 2. Built-in Scalar Mappings
  //    TypeSpec std-lib scalars map to GraphQL custom scalars automatically:
  //      int64 → BigInt, numeric → Numeric, decimal/decimal128 → BigDecimal,
  //      url → URL (with @specifiedBy), plainDate → PlainDate,
  //      plainTime → PlainTime
  // ===================================================================

  model ScalarShowcase {
    /** Maps to GraphQL BigInt custom scalar */
    bigNumber: int64;
    /** Maps to GraphQL Numeric custom scalar */
    preciseValue: numeric;
    /** Maps to GraphQL BigDecimal custom scalar */
    amount: decimal;
    /** Also maps to BigDecimal (deduped) */
    amount128: decimal128;
    /** Maps to GraphQL URL custom scalar with @specifiedBy */
    homepage: url;
    /** Maps to GraphQL PlainDate custom scalar */
    birthday: plainDate;
    /** Maps to GraphQL PlainTime custom scalar */
    alarmTime: plainTime;
  }

  // ===================================================================
  // 3. Enums
  //    Enum members are converted to CONSTANT_CASE in GraphQL.
  // ===================================================================

  /** The role a user can have in the system */
  enum Role {
    Admin,
    Moderator,
    User,
    Guest,
  }

  /** Content rating categories */
  enum ContentRating {
    GeneralAudience,
    ParentalGuidance,
    Restricted,
  }

  /** Status of a post */
  enum PostStatus {
    Draft,
    Published,
    Archived,
  }

  // ===================================================================
  // 4. GraphQL Interfaces via @Interface and @compose
  //    @Interface marks a model as a GraphQL interface.
  //    @compose specifies which interfaces a model implements.
  // ===================================================================

  /** A node with a globally unique identifier */
  @Interface
  model Node {
    id: string;
  }

  /** A timestamped entity */
  @Interface
  model Timestamped {
    createdAt: DateTime;
    updatedAt: DateTime;
  }

  /** An interface can implement another interface */
  @Interface
  @compose(Node)
  model Authored {
    id: string;
    authorId: string;
  }

  // ===================================================================
  // 5. Output Types (models used only as return values)
  //    These emit as `type` in GraphQL.
  // ===================================================================

  /** A user profile */
  @compose(Node, Timestamped)
  model User {
    id: string;
    createdAt: DateTime;
    updatedAt: DateTime;
    username: string;
    email: string;
    displayName?: string;
    /** Nullable field (not optional, but value can be null) */
    avatarUrl: url | null;
    /** Enum field — previously crashed with "Unknown GraphQL type" */
    role: Role;
    posts: Post[];
    friends: User[];
  }

  /** A blog post */
  @compose(Node, Timestamped, Authored)
  model Post {
    id: string;
    createdAt: DateTime;
    updatedAt: DateTime;
    authorId: string;
    title: string;
    body: string;
    /** Optional nullable — both omittable and can be null */
    subtitle?: string | null;
    /** Enum field — previously crashed with "Unknown GraphQL type" */
    status: PostStatus;
    /** Enum field — enum referenced from model */
    rating: ContentRating;
    tags: string[];
    comments: Comment[];
    metadata: JSON;
  }

  /** A comment on a post */
  @compose(Node, Authored)
  model Comment {
    id: string;
    authorId: string;
    postId: string;
    text: string;
    /** Optional field — nullable in GraphQL output */
    parentCommentId?: string;
  }

  // ===================================================================
  // 6. Input/Output Splitting
  //    Models used as both mutation params and return values
  //    are emitted as both `type Foo` and `input FooInput`.
  // ===================================================================

  /** Geographic coordinates */
  model GeoLocation {
    latitude: float64;
    longitude: float64;
    /** Optional altitude in meters */
    altitude?: float64;
  }

  /** A physical address */
  model Address {
    street: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
    location?: GeoLocation;
  }

  // ===================================================================
  // 7. Input-only Types
  //    Models used only as mutation parameters emit as `input` only.
  // ===================================================================

  /** Input for creating a new post */
  model CreatePostInput {
    title: string;
    body: string;
    tags: string[];
  }

  /** Input for updating an existing post (all fields nullable for partial updates) */
  model UpdatePostInput {
    title: string | null;
    body: string | null;
    tags: string[] | null;
  }

  /** Pagination parameters (all fields nullable — omitting means "no constraint") */
  model PaginationInput {
    first: int32 | null;
    after: string | null;
    last: int32 | null;
    before: string | null;
  }

  // ===================================================================
  // 8. Unions
  //    Named unions emit as `union Foo = A | B`.
  //    Anonymous unions in return types get auto-named.
  // ===================================================================

  /** A notification a user may receive */
  model Notification {
    id: string;
    message: string;
    read: boolean;
  }

  /** A system-level alert */
  model SystemAlert {
    id: string;
    severity: string;
    description: string;
  }

  /** Named union of object types */
  union FeedItem {
    post: Post,
    comment: Comment,
  }

  /** Named union of different event types */
  union NotificationEvent {
    notification: Notification,
    alert: SystemAlert,
  }

  // ===================================================================
  // 9. Field Arguments via @operationFields
  //    Operations assigned to models become fields with arguments.
  // ===================================================================

  /** Resolve paginated followers for a user */
  op followers(first: int32, after: string | null): User[];

  /** Search a user's posts by keyword */
  op searchPosts(query: string, limit: int32): Post[];

  @operationFields(followers, searchPosts)
  model UserProfile {
    id: string;
    username: string;
    bio?: string;
  }

  // ===================================================================
  // 10. Queries
  //     @query marks an operation as a Query root field.
  // ===================================================================

  @query
  op getScalarShowcase(): ScalarShowcase;

  @query
  op getUser(id: string): User;

  @query
  op getPost(id: string): Post;

  /** Returns a list of posts with optional pagination */
  @query
  op listPosts(pagination: PaginationInput): Post[];

  @query
  op getUserProfile(id: string): UserProfile;

  /** Union return type — previously crashed with "Unknown GraphQL type" */
  @query op getFeedItem(id: string): FeedItem;

  /** Union return type — named union of different event types */
  @query op getNotificationEvent(userId: string): NotificationEvent;

  @query
  op getNotification(userId: string): Notification;

  // ===================================================================
  // 11. Mutations
  //     @mutation marks an operation as a Mutation root field.
  //     Parameters that are model types get emitted as input types.
  // ===================================================================

  @mutation
  op createPost(input: CreatePostInput): Post;

  @mutation
  op updatePost(id: string, input: UpdatePostInput): Post;

  @mutation
  op deletePost(id: string): boolean;

  /** Mutation using a model as both input and output → triggers input/output splitting */
  @mutation
  op updateAddress(userId: string, address: Address): Address;

  // ===================================================================
  // 12. Subscriptions
  //     @subscription marks an operation as a Subscription root field.
  // ===================================================================

  @subscription
  op onPostCreated(): Post;

  @subscription
  op onCommentAdded(postId: string): Comment;

  @subscription
  op onNotification(userId: string): Notification;

  // ===================================================================
  // 13. Nullability & Optionality Showcase
  //     Demonstrates the four combinations:
  //       required non-null  → Type!
  //       optional           → Type     (nullable in output)
  //       nullable           → Type     (nullable)
  //       optional + null    → Type     (nullable)
  // ===================================================================

  model NullabilityShowcase {
    /** Required non-null → String! */
    required: string;
    /** Optional → String (nullable in output) */
    optional?: string;
    /** Nullable → String (nullable) */
    nullable: string | null;
    /** Optional and nullable → String (nullable) */
    optionalNullable?: string | null;

    /** Required list of non-null items → [String!]! */
    requiredList: string[];
    /** Optional list → [String!] (nullable list) */
    optionalList?: string[];
    /** List of nullable items → [String]! */
    nullableItemList: Array<string | null>;
  }

  @query
  op getNullabilityShowcase(): NullabilityShowcase;
}
