import type { Scalar } from "@typespec/compiler";
import { expectDiagnosticEmpty } from "@typespec/compiler/testing";
import { describe, expect, it } from "vitest";
import { getSpecificationUrl } from "../src/lib/scalar-specification.js";
import { compileAndDiagnose } from "./test-host.js";

describe("Scalar Specification", () => {
  it("sets specification URL for a custom scalar type", async () => {
    const [program, { UUID }, diagnostics] = await compileAndDiagnose<{
      UUID: Scalar;
    }>(`
      @specifiedBy("https://tools.ietf.org/html/rfc4122")
      @test scalar UUID extends string;
    `);
    
    expectDiagnosticEmpty(diagnostics);
    expect(getSpecificationUrl(program, UUID)).toBe("https://tools.ietf.org/html/rfc4122");
  });

  it("allows setting specification URL for multiple scalar types", async () => {
    const [program, { UUID, Email }, diagnostics] = await compileAndDiagnose<{
      UUID: Scalar;
      Email: Scalar;
    }>(`
      @specifiedBy("https://tools.ietf.org/html/rfc4122")
      @test scalar UUID extends string;

      @specifiedBy("https://tools.ietf.org/html/rfc5322")
      @test scalar Email extends string;
    `);
    
    expectDiagnosticEmpty(diagnostics);
    expect(getSpecificationUrl(program, UUID)).toBe("https://tools.ietf.org/html/rfc4122");
    expect(getSpecificationUrl(program, Email)).toBe("https://tools.ietf.org/html/rfc5322");
  });

  it("works with custom scalar types that don't extend from a base type", async () => {
    const [program, { CustomScalar }, diagnostics] = await compileAndDiagnose<{
      CustomScalar: Scalar;
    }>(`
      @specifiedBy("https://example.com/custom-scalar-spec")
      @test scalar CustomScalar;
    `);
    
    expectDiagnosticEmpty(diagnostics);
    expect(getSpecificationUrl(program, CustomScalar)).toBe("https://example.com/custom-scalar-spec");
  });

  it("can reference specifications with complex URLs", async () => {
    const [program, { ComplexURL }, diagnostics] = await compileAndDiagnose<{
      ComplexURL: Scalar;
    }>(`
      @specifiedBy("https://example.com/spec/v1.2.3?format=full&lang=en#section-3.4")
      @test scalar ComplexURL extends string;
    `);
    
    expectDiagnosticEmpty(diagnostics);
    expect(getSpecificationUrl(program, ComplexURL)).toBe("https://example.com/spec/v1.2.3?format=full&lang=en#section-3.4");
  });
});
