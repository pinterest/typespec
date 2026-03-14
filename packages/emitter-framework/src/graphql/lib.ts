import { createTypeSpecLibrary } from "@typespec/compiler";

export const $graphqlLib = createTypeSpecLibrary({
  name: "emitter-framework",
  diagnostics: {
    "graphql-unsupported-scalar": {
      severity: "warning",
      messages: {
        default: "Unsupported scalar type, falling back to String",
      },
    },
    "graphql-unsupported-type": {
      severity: "error",
      messages: {
        default: "Unsupported type, falling back to String",
      },
      description: "This type is not supported by the GraphQL emitter",
    },
  },
});

export const {
  reportDiagnostic: reportGraphqlDiagnostic,
  createDiagnostic: createGraphqlDiagnostic,
} = $graphqlLib;
