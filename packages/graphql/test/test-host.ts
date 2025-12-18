import { resolvePath } from "@typespec/compiler";
import { createTester } from "@typespec/compiler/testing";

// Use empty libraries since @typespec/graphql doesn't have a full library setup yet
// (no $lib export). The mutation engine tests don't need library decorators.
export const Tester = createTester(resolvePath(import.meta.dirname, ".."), {
  libraries: [],
});

