import { defineTransformer } from "@typespec/compiler";
import { renameTypesTransform } from "./transformers/rename-types.transform.js";

export const $transformer = defineTransformer({
  transforms: [renameTypesTransform],
  transformSets: {
    graphql_naming: {
      enable: {
        [`@typespec/graphql/${renameTypesTransform.name}`]: true,
      },
    },
  },
});
