import { strictEqual } from "node:assert";
import { expectDiagnostics, t } from "@typespec/compiler/testing";
import { describe, expect, it } from "vitest";
import { getOperationKind } from "../src/lib/operation-kind.js";
import { emitSingleSchema, Tester } from "./test-host.js";

describe("Operation kinds", () => {
  it("declares a Mutation", async () => {
    const { program, testOperation } = await Tester.compile(t.code`
      @mutation @test op ${t.op("testOperation")}(): string;
    `);
    const operationKind = getOperationKind(program, testOperation);
    expect(operationKind).toBe("Mutation");
  });
  it("declares a Query", async () => {
    const { program, testOperation } = await Tester.compile(t.code`
      @query @test op ${t.op("testOperation")}(): string;
    `);
    const operationKind = getOperationKind(program, testOperation);
    expect(operationKind).toBe("Query");
  });
  it("declares a Subscription", async () => {
    const { program, testOperation } = await Tester.compile(t.code`
      @subscription @test op ${t.op("testOperation")}(): string;
    `);
    const operationKind = getOperationKind(program, testOperation);
    expect(operationKind).toBe("Subscription");
  });
  it("does not allow to declare multiple operation kinds to the same type.", async () => {
    const [{ program, testOperation }, diagnostics] = await Tester.compileAndDiagnose(t.code`
      @query @mutation @test op ${t.op("testOperation")}(): string;
    `);
    expectDiagnostics(diagnostics, [
      {
        code: "@typespec/graphql/graphql-operation-kind-duplicate",
        message: "GraphQL Operation Kind already applied to `testOperation`.",
      },
      {
        code: "@typespec/graphql/graphql-operation-kind-duplicate",
        message: "GraphQL Operation Kind already applied to `testOperation`.",
      },
    ]);
    const operationKind = getOperationKind(program, testOperation);
    expect(operationKind).toBeUndefined();
  });

  describe("SDL output", () => {
    it("emits queries, mutations, and subscriptions", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          model User {
            id: string;
            name: string;
          }

          model Message {
            id: string;
            text: string;
            userId: string;
          }

          @query
          op getUser(id: string): User;

          @query
          op listUsers(): User[];

          @mutation
          op createUser(name: string): User;

          @mutation
          op updateUser(id: string, name: string): User;

          @subscription
          op onMessageReceived(userId: string): Message;
        }
      `;

      const result = await emitSingleSchema(code, {});

      strictEqual(result.includes("type Query {"), true);
      strictEqual(result.includes("getUser(id: String!): User"), true);
      strictEqual(result.includes("listUsers: [User!]"), true);

      strictEqual(result.includes("type Mutation {"), true);
      strictEqual(result.includes("createUser(name: String!): User"), true);
      strictEqual(result.includes("updateUser(id: String!, name: String!): User"), true);

      strictEqual(result.includes("type Subscription {"), true);
      strictEqual(result.includes("onMessageReceived(userId: String!): Message"), true);
    });
  });
});
