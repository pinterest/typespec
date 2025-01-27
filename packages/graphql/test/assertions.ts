import { isType, type GraphQLType } from "graphql";
import { expect } from "vitest";

interface GraphQLAssertions<R = unknown> {
  toEqualType: (expected: GraphQLType) => R;
}

declare module "vitest" {
  interface Assertion<T = any> extends GraphQLAssertions<T> {}
  interface AsymmetricMatchersContaining extends GraphQLAssertions {}
}

expect.extend({
  toEqualType(received: GraphQLType, expected: GraphQLType) {
    if (!isType(expected)) {
      return {
        pass: false,
        message: () => `Expected value ${expected} is not a GraphQLType.`,
      };
    }

    if (!isType(received)) {
      return {
        pass: false,
        message: () => `Received value ${received} is not a GraphQLType.`,
      };
    }

    const { isNot } = this;
    return {
      pass: received.toJSON() === expected.toJSON(),
      message: () => `${received} is${isNot ? " not" : ""} the same as ${expected}`,
    };
  },
});

export { expect };
