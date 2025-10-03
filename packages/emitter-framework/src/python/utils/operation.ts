import { refkey, type Refkey } from "@alloy-js/core";
import * as py from "@alloy-js/python";
import type { Model, ModelProperty, Operation, Type } from "@typespec/compiler";
import { useTsp } from "../../core/index.js";
import { TypeExpression } from "../components/type-expression/type-expression.jsx";
import { efRefkey } from "./refkey.js";

export function getReturnType(
  type: Operation,
  options: { skipErrorFiltering: boolean } = { skipErrorFiltering: false },
): Type {
  const { $ } = useTsp();
  let returnType = type.returnType;

  if (!options.skipErrorFiltering && type.returnType.kind === "Union") {
    returnType = $.union.filter(type.returnType, (variant) => !$.type.isError(variant.type));
  }

  return returnType;
}

export interface BuildParameterDescriptorsOptions {
  params?: (string | py.ParameterDescriptor)[] | undefined;
  mode?: "prepend" | "append" | "replace";
  suffixRefkey?: Refkey;
}

export function buildParameterDescriptors(
  type: Model,
  options: BuildParameterDescriptorsOptions = {},
): py.ParameterDescriptor[] | undefined {
  const { $ } = useTsp();
  const suffixRefkey = options.suffixRefkey ?? refkey();
  const optionsParams = normalizeParameters(options.params);

  if (options.mode === "replace") {
    return optionsParams;
  }

  const modelProperties = $.model.getProperties(type);
  const operationParams = [...modelProperties.values()].map((m) =>
    buildParameterDescriptor(m, suffixRefkey),
  );

  // Merge parameters based on location
  const allParams =
    options.mode === "append"
      ? operationParams.concat(optionsParams)
      : optionsParams.concat(operationParams);

  return allParams;
}

export function buildParameterDescriptor(
  modelProperty: ModelProperty,
  suffixRefkey: Refkey,
): py.ParameterDescriptor {
  const { $ } = useTsp();
  const namePolicy = py.usePythonNamePolicy();
  const paramName = namePolicy.getName(modelProperty.name, "parameter");
  const isOptional = modelProperty.optional || modelProperty.defaultValue !== undefined;
  const doc = $.type.getDoc(modelProperty);
  return {
    doc,
    name: paramName,
    refkey: efRefkey(modelProperty, suffixRefkey),
    type: TypeExpression({ type: modelProperty.type }),
  };
}

/**
 * Convert a parameter descriptor array, string array, or undefined to
 * a parameter descriptor array.
 */
function normalizeParameters(
  params: (string | py.ParameterDescriptor)[] | undefined,
): py.ParameterDescriptor[] {
  if (!params) return [];

  return params.map((param) => {
    if (typeof param === "string") {
      return { name: param };
    }
    return param;
  });
}
