import { For } from "@alloy-js/core";
import * as gql from "@alloy-js/graphql";
import { useGraphQLSchema } from "../context/index.js";
import {
  ScalarType,
  EnumType,
  UnionType,
  InterfaceType,
  ObjectType,
  InputType,
} from "./types/index.js";

/**
 * Renders scalar variant types for encoded scalars (e.g., bytes + base64 → Bytes)
 * AND custom user-defined scalars
 */
export function ScalarVariantTypes() {
  const { classifiedTypes } = useGraphQLSchema();

  // Get set of variant names to avoid duplicates
  const variantNames = new Set(classifiedTypes.scalarVariants.map(v => v.graphqlName));

  // Filter custom scalars to only include ones not already in variants
  const customScalars = classifiedTypes.scalars.filter(s => !variantNames.has(s.name));

  return (
    <>
      <For each={classifiedTypes.scalarVariants}>
        {(variant) => (
          <gql.ScalarType
            name={variant.graphqlName}
            specifiedByUrl={variant.specificationUrl}
          />
        )}
      </For>
      <For each={customScalars}>
        {(scalar) => <ScalarType type={scalar} />}
      </For>
    </>
  );
}

/**
 * Renders all enum types in the schema
 */
export function EnumTypes() {
  const { classifiedTypes } = useGraphQLSchema();
  return (
    <For each={classifiedTypes.enums}>
      {(enumType) => <EnumType type={enumType} />}
    </For>
  );
}

/**
 * Renders all union types in the schema
 */
export function UnionTypes() {
  const { classifiedTypes } = useGraphQLSchema();
  return (
    <For each={classifiedTypes.unions}>
      {(union) => <UnionType type={union} />}
    </For>
  );
}

/**
 * Renders all interface types in the schema
 */
export function InterfaceTypes() {
  const { classifiedTypes } = useGraphQLSchema();
  return (
    <For each={classifiedTypes.interfaces}>
      {(iface) => <InterfaceType type={iface} />}
    </For>
  );
}

/**
 * Renders all object types in the schema
 */
export function ObjectTypes() {
  const { classifiedTypes } = useGraphQLSchema();
  return (
    <For each={classifiedTypes.outputModels}>
      {(model) => <ObjectType type={model} />}
    </For>
  );
}

/**
 * Renders all input types in the schema
 */
export function InputTypes() {
  const { classifiedTypes } = useGraphQLSchema();
  return (
    <For each={classifiedTypes.inputModels}>
      {(model) => <InputType type={model} />}
    </For>
  );
}
