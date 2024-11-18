import { beforeEach, describe, it } from "vitest";
import { GraphQLTypeRegistry } from "../src/registry.js";
import { expect } from "./assertions.js";
import { createGraphqlTestRunner } from "./test-host.js";

describe("GraphQL Type Registry", () => {
  let registry: GraphQLTypeRegistry;

  beforeEach(async () => {
    const runner = await createGraphqlTestRunner();
    await runner.diagnose("");
    registry = new GraphQLTypeRegistry(runner.program);
  });

  it("Will navigate program when state is accessed", () => {
    expect(registry.programNavigated).toBe(false);
    expect(registry.rootQueryType).toBeUndefined();
    expect(registry.programNavigated).toBe(true);
  });
});
