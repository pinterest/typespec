import { For } from "@alloy-js/core";
import * as gql from "@alloy-js/graphql";
import type { Enum, Model, Scalar, Union } from "@typespec/compiler";
import type { ScalarVariant } from "../mutation-engine/index.js";
import {
  ScalarType,
  EnumType,
  UnionType,
  InterfaceType,
  ObjectType,
  InputType,
} from "./types/index.js";

export interface ScalarVariantTypesProps {
  scalarVariants: ScalarVariant[];
  scalars: Scalar[];
  scalarSpecifications: Map<string, string>;
}

/**
 * Renders scalar variant types for encoded scalars (e.g., bytes + base64 -> Bytes)
 * AND custom user-defined scalars
 */
export function ScalarVariantTypes(props: ScalarVariantTypesProps) {
  // Get set of variant names to avoid duplicates
  const variantNames = new Set(props.scalarVariants.map((v) => v.graphqlName));

  // Filter custom scalars to only include ones not already in variants
  const customScalars = props.scalars.filter((s) => !variantNames.has(s.name));

  return (
    <>
      <For each={props.scalarVariants}>
        {(variant) => (
          <gql.ScalarType
            name={variant.graphqlName}
            specifiedByUrl={variant.specificationUrl}
          />
        )}
      </For>
      <For each={customScalars}>
        {(scalar) => (
          <ScalarType
            type={scalar}
            specificationUrl={props.scalarSpecifications.get(scalar.name)}
          />
        )}
      </For>
    </>
  );
}

export interface EnumTypesProps {
  enums: Enum[];
}

/**
 * Renders all enum types in the schema
 */
export function EnumTypes(props: EnumTypesProps) {
  return (
    <For each={props.enums}>{(enumType) => <EnumType type={enumType} />}</For>
  );
}

export interface UnionTypesProps {
  unions: Union[];
}

/**
 * Renders all union types in the schema
 */
export function UnionTypes(props: UnionTypesProps) {
  return (
    <For each={props.unions}>{(union) => <UnionType type={union} />}</For>
  );
}

export interface InterfaceTypesProps {
  interfaces: Model[];
}

/**
 * Renders all interface types in the schema
 */
export function InterfaceTypes(props: InterfaceTypesProps) {
  return (
    <For each={props.interfaces}>
      {(iface) => <InterfaceType type={iface} />}
    </For>
  );
}

export interface ObjectTypesProps {
  models: Model[];
}

/**
 * Renders all object types in the schema
 */
export function ObjectTypes(props: ObjectTypesProps) {
  return (
    <For each={props.models}>{(model) => <ObjectType type={model} />}</For>
  );
}

export interface InputTypesProps {
  models: Model[];
}

/**
 * Renders all input types in the schema
 */
export function InputTypes(props: InputTypesProps) {
  return (
    <For each={props.models}>{(model) => <InputType type={model} />}</For>
  );
}
