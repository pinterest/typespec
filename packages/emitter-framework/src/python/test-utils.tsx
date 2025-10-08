import { Output } from "#core/components/index.js";
import { type Children } from "@alloy-js/core";
import * as py from "@alloy-js/python";
import type { Program } from "@typespec/compiler";
import {
  abcModule,
  dataclassesModule,
  datetimeModule,
  decimalModule,
  typingModule,
} from "./builtins.js";

export function getOutput(program: Program, children: Children[]): Children {
  const policy = py.createPythonNamePolicy();
  const printOptions = {
    printWidth: 80,
    tabWidth: 4,
    insertFinalNewLine: false,
  };
  return (
    <Output
      program={program}
      externals={[
        abcModule,
        dataclassesModule,
        datetimeModule,
        decimalModule,
        typingModule,
        py.abcModule,
        py.enumModule,
      ]}
      printOptions={printOptions}
      namePolicy={policy}
    >
      <py.SourceFile path="test.py">{children}</py.SourceFile>
    </Output>
  );
}
