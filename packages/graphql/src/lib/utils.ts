import {
  walkPropertiesInherited,
  type Model,
  type ModelProperty,
  type Operation,
  type Type,
} from "@typespec/compiler";

/**
 * Compare two types for structural equality. Uses reference equality as a fast
 * path, then falls back to kind + name comparison for named types.
 *
 * This is necessary because the mutation framework creates new type instances
 * for the same logical type. When decorators are re-invoked on mutated types,
 * reference equality fails even though the types are semantically identical.
 */
function typesEqual(type1: Type, type2: Type): boolean {
  if (type1 === type2) return true;
  if (type1.kind !== type2.kind) return false;

  // For named types (Scalar, Model, Enum, Union), compare by name.
  if ("name" in type1 && "name" in type2) {
    return (type1 as { name: string }).name === (type2 as { name: string }).name;
  }

  return false;
}

export function propertiesEqual(
  prop1: ModelProperty,
  prop2: ModelProperty,
  ignoreNames: boolean = false,
): boolean {
  if (!ignoreNames && prop1.name !== prop2.name) {
    return false;
  }
  return typesEqual(prop1.type, prop2.type) && prop1.optional === prop2.optional;
}

export function modelsEqual(model1: Model, model2: Model, ignoreNames: boolean = false): boolean {
  if (!ignoreNames && model1.name !== model2.name) {
    return false;
  }
  const model1Properties = new Set(walkPropertiesInherited(model1));
  const model2Properties = new Set(walkPropertiesInherited(model2));
  if (model1Properties.size !== model2Properties.size) {
    return false;
  }
  if (
    [...model1Properties].some(
      (prop) => ![...model2Properties].some((p) => propertiesEqual(prop, p, false)),
    )
  ) {
    return false;
  }
  return true;
}

export function operationsEqual(
  op1: Operation,
  op2: Operation,
  ignoreNames: boolean = false,
): boolean {
  if (!ignoreNames && op1.name !== op2.name) {
    return false;
  }
  return typesEqual(op1.returnType, op2.returnType) && modelsEqual(op1.parameters, op2.parameters, true);
}
