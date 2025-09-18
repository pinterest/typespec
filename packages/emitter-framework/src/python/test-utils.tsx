import { render, type Children, type OutputDirectory } from "@alloy-js/core";
import { Output as StcOutput, SourceFile as StcSourceFile } from "@alloy-js/core/stc";
import { createPythonNamePolicy, SourceFile } from "@alloy-js/python";
import type {
  Enum,
  Interface,
  Model,
  Namespace,
  NavigationOptions,
  Operation,
  Program,
  SemanticNodeListener,
  Tuple,
  Union,
  UnionVariant,
} from "@typespec/compiler";
import { navigateProgram, type ModelProperty } from "@typespec/compiler";
import type { BasicTestRunner, TestHost } from "@typespec/compiler/testing";
import { assert } from "vitest";
import { Output } from "../../src/core/components/output.jsx";
import {
  dataclassesModule,
  datetimeModule,
  decimalModule,
  typingExtensionsModule,
  typingModule,
} from "./builtins.js";
import { getProgram } from "./test-host.js";

// Reimplementing so we can set the correct extensions
export async function getEmitOutput(tspCode: string, cb: (program: Program) => Children) {
  const program = await getProgram(tspCode);

  const res = render(
    StcOutput().children(StcSourceFile({ path: "test.py", filetype: "py" }).children(cb(program))),
  );
  const testFile = res.contents.find((file) => file.path === "test.py")!;
  assert("contents" in testFile, "test.py file does not have contents");
  return testFile.contents;
}

// Reimplementing so we can set the correct extensions
export function assertFileContents(res: OutputDirectory, contents: string) {
  const testFile = res.contents.find((file) => file.path === "test.py")!;
  assert(testFile, "test.py file not rendered");
  assert("contents" in testFile, "test.py file does not have contents");
  assert.equal(testFile.contents, contents);
}

function getExternals() {
  return [dataclassesModule, datetimeModule, decimalModule, typingModule, typingExtensionsModule];
}

export function getOutput(program: Program, children: Children[]): Children {
  const policy = createPythonNamePolicy();
  return (
    <Output program={program} externals={getExternals()} namePolicy={policy}>
      <SourceFile path="test.py">{children}</SourceFile>
    </Output>
  );
}

async function compileCode(code: string, runner: BasicTestRunner) {
  const { test } = await runner.compile(code);
  return test;
}

async function compileCodeModelProperty(code: string, runner: BasicTestRunner) {
  const test = await compileCode(code, runner);
  return test as ModelProperty;
}

export async function compileCodeModelPropertyType(code: string, runner: BasicTestRunner) {
  const property = await compileCodeModelProperty(code, runner);
  return property.type;
}

export async function compileModelProperty(ref: string, runner: BasicTestRunner) {
  const test = await compileCode(
    `
    model Test {
      @test test: ${ref};
    }
  `,
    runner,
  );

  return test as ModelProperty;
}

export async function compileModelPropertyType(ref: string, runner: BasicTestRunner) {
  return (await compileModelProperty(ref, runner)).type;
}

function createCollector(customListener?: SemanticNodeListener) {
  const result = {
    enums: [] as Enum[],
    exitEnums: [] as Enum[],
    interfaces: [] as Interface[],
    exitInterfaces: [] as Interface[],
    models: [] as Model[],
    exitModels: [] as Model[],
    modelProperties: [] as ModelProperty[],
    exitModelProperties: [] as ModelProperty[],
    namespaces: [] as Namespace[],
    exitNamespaces: [] as Namespace[],
    operations: [] as Operation[],
    exitOperations: [] as Operation[],
    tuples: [] as Tuple[],
    exitTuples: [] as Tuple[],
    unions: [] as Union[],
    exitUnions: [] as Union[],
    unionVariants: [] as UnionVariant[],
    exitUnionVariants: [] as UnionVariant[],
  };

  const listener: SemanticNodeListener = {
    namespace: (x) => {
      result.namespaces.push(x);
      return customListener?.namespace?.(x);
    },
    exitNamespace: (x) => {
      result.exitNamespaces.push(x);
      return customListener?.exitNamespace?.(x);
    },
    operation: (x) => {
      result.operations.push(x);
      return customListener?.operation?.(x);
    },
    exitOperation: (x) => {
      result.exitOperations.push(x);
      return customListener?.exitOperation?.(x);
    },
    model: (x) => {
      result.models.push(x);
      return customListener?.model?.(x);
    },
    exitModel: (x) => {
      result.exitModels.push(x);
      return customListener?.exitModel?.(x);
    },
    modelProperty: (x) => {
      result.modelProperties.push(x);
      return customListener?.modelProperty?.(x);
    },
    exitModelProperty: (x) => {
      result.exitModelProperties.push(x);
      return customListener?.exitModelProperty?.(x);
    },
    enum: (x) => {
      result.enums.push(x);
      return customListener?.enum?.(x);
    },
    exitEnum: (x) => {
      result.exitEnums.push(x);
      return customListener?.exitEnum?.(x);
    },
    union: (x) => {
      result.unions.push(x);
      return customListener?.union?.(x);
    },
    exitUnion: (x) => {
      result.exitUnions.push(x);
      return customListener?.exitUnion?.(x);
    },
    interface: (x) => {
      result.interfaces.push(x);
      return customListener?.interface?.(x);
    },
    exitInterface: (x) => {
      result.exitInterfaces.push(x);
      return customListener?.exitInterface?.(x);
    },
    tuple: (x) => {
      result.tuples.push(x);
      return customListener?.tuple?.(x);
    },
    exitTuple: (x) => {
      result.exitTuples.push(x);
      return customListener?.exitTuple?.(x);
    },
    unionVariant: (x) => {
      result.unionVariants.push(x);
      return customListener?.unionVariant?.(x);
    },
    exitUnionVariant: (x) => {
      result.exitUnionVariants.push(x);
      return customListener?.exitUnionVariant?.(x);
    },
  };
  return [result, listener] as const;
}

export async function runNavigator(
  typespec: string,
  host: TestHost,
  customListener?: SemanticNodeListener,
  options?: NavigationOptions,
) {
  host.addTypeSpecFile("main.tsp", typespec);

  await host.compile("main.tsp", { nostdlib: true });

  const [result, listener] = createCollector(customListener);
  navigateProgram(host.program, listener, options);

  return result;
}
