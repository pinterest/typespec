declare const tags: unique symbol;

export type Tagged<BaseType, Tag extends PropertyKey> = BaseType & { [tags]: { [K in Tag]: void } };
