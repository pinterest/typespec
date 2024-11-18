import { expectDiagnosticEmpty } from "@typespec/compiler/testing";
import { GraphQLSchema, printSchema } from "graphql";
import { describe, it } from "vitest";
import { GraphQLEmitter } from "../src/schema-emitter.js";
import { expect } from "./assertions.js";
import { emitSingleSchemaWithDiagnostics } from "./test-host.js";

describe("GraphQL emitter", () => {
  it("Can produce a placeholder GraphQL schema", async () => {
    const result = await emitSingleSchemaWithDiagnostics("");
    expectDiagnosticEmpty(result.diagnostics);
    expect(result.graphQLSchema).toBeInstanceOf(GraphQLSchema);
    expect(result.graphQLSchema?.getQueryType()).toEqualType(GraphQLEmitter.placeholderQuery);
  });

  it("Can produce an SDL output", async () => {
    const result = await emitSingleSchemaWithDiagnostics("");
    expectDiagnosticEmpty(result.diagnostics);
    expect(result.graphQLOutput).toEqual(printSchema(result.graphQLSchema!));
  });
});
