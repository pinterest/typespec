import { type Model, getDoc } from "@typespec/compiler";
import * as gql from "@alloy-js/graphql";
import { useTsp } from "@typespec/emitter-framework";
import { useGraphQLSchema } from "../../context/index.js";
import { Field } from "../fields/index.js";

export interface InputTypeProps {
  /** The input type to render */
  type: Model;
}

/**
 * Renders a GraphQL input type declaration
 *
 * Determines the correct input type name:
 * - If the model is also an output type, appends "Input"
 * - Otherwise, uses the name as-is (already has "Input" suffix like CreateBookInput)
 */
export function InputType(props: InputTypeProps) {
  const { program } = useTsp();
  const { modelVariants } = useGraphQLSchema();
  const doc = getDoc(program, props.type);
  const properties = Array.from(props.type.properties.values());

  // CRITICAL: Preserve input name resolution logic from design.md
  // If there's an output variant with the same name, add Input suffix
  const hasOutputVariant = modelVariants.outputModels.has(props.type.name);
  const inputTypeName = hasOutputVariant ? `${props.type.name}Input` : props.type.name;

  return (
    <gql.InputObjectType name={inputTypeName} description={doc}>
      {properties.map((prop) => (
        <Field property={prop} isInput={true} />
      ))}
    </gql.InputObjectType>
  );
}
