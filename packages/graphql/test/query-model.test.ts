import type { Model } from "@typespec/compiler";
import { expectDiagnosticEmpty } from "@typespec/compiler/testing";
import { describe, expect, it } from "vitest";
import { isCustomQueryModel } from "../src/lib/query-model.js";
import { compileAndDiagnose } from "./test-host.js";

describe("Query Model", () => {
  it("marks a model as a custom query type", async () => {
    const [program, { testModel }, diagnostics] = await compileAndDiagnose<{
      testModel: Model;
    }>(`
      @useAsQuery @test model testModel {
        property: string;
      }
    `);
    
    expectDiagnosticEmpty(diagnostics);
    expect(isCustomQueryModel(program, testModel)).toBe(true);
  });

  it("allows marking a model with both useAsQuery and operationFields", async () => {
    const [program, { customQuery, getUsers }, diagnostics] = await compileAndDiagnose<{
      customQuery: Model;
      getUsers: Model;
    }>(`
      @test op getUsers(): string[];
      
      @useAsQuery 
      @operationFields(getUsers)
      @test model customQuery {
        me: User;
      }

      model User {
        id: string;
        name: string;
      }
    `);
    
    expectDiagnosticEmpty(diagnostics);
    expect(isCustomQueryModel(program, customQuery)).toBe(true);
  });

  it("can be applied to different models", async () => {
    const [program, { firstQuery, secondQuery }, diagnostics] = await compileAndDiagnose<{
      firstQuery: Model;
      secondQuery: Model;
    }>(`
      @useAsQuery @test model firstQuery {
        property: string;
      }
      
      @useAsQuery @test model secondQuery {
        property: string;
      }
    `);
    
    expectDiagnosticEmpty(diagnostics);
    expect(isCustomQueryModel(program, firstQuery)).toBe(true);
    expect(isCustomQueryModel(program, secondQuery)).toBe(true);
  });
});
