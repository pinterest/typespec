import { createTypeSpecLibrary } from "@typespec/compiler";

export const $lib = createTypeSpecLibrary({
  name: "python",
  diagnostics: {},
});

export const { reportDiagnostic, createDiagnostic } = $lib;
