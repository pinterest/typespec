import { type ModelProperty, getDoc, getDeprecationDetails } from "@typespec/compiler";
import * as gql from "@alloy-js/graphql";
import { useTsp } from "@typespec/emitter-framework";
import { GraphQLTypeResolutionContext } from "../../context/index.js";
import { TypeAnalyzer } from "./type-analyzer.js";

export interface FieldProps {
  /** The model property to render as a field */
  property: ModelProperty;
  /** Whether this field is in an input type context */
  isInput: boolean;
}

/**
 * Renders a GraphQL field (property on a type or input type)
 *
 * Automatically handles:
 * - Description from doc comments
 * - Type resolution with input/output awareness
 * - Nullability based on optional flag and nullable unions
 * - Array types using Field.List
 * - Directives like @deprecated
 *
 * Uses gql.Field for output fields and gql.InputField for input fields
 */
export function Field(props: FieldProps) {
  const { program } = useTsp();
  const mode = props.isInput ? "input" : "output";

  const doc = getDoc(program, props.property);
  const deprecation = getDeprecationDetails(program, props.property);

  // Analyze the type to determine structure (array, nullable, etc.)
  return (
    <GraphQLTypeResolutionContext.Provider value={{ mode }}>
      <TypeAnalyzer type={props.property.type} isOptional={props.property.optional} targetType={props.property}>
        {(typeInfo) => {

          if (props.isInput) {
            return (
              <gql.InputField
                name={props.property.name}
                type={typeInfo.typeName}
                nonNull={typeInfo.isList ? typeInfo.itemNonNull : typeInfo.isNonNull}
                description={doc}
              >
                {typeInfo.isList ? <gql.InputField.List nonNull={typeInfo.isNonNull} /> : undefined}
              </gql.InputField>
            );
          }

          return (
            <gql.Field
              name={props.property.name}
              type={typeInfo.typeName}
              nonNull={typeInfo.isList ? typeInfo.itemNonNull : typeInfo.isNonNull}
              description={doc}
              deprecated={deprecation ? deprecation.message : undefined}
            >
              {typeInfo.isList ? <gql.Field.List nonNull={typeInfo.isNonNull} /> : undefined}
            </gql.Field>
          );
        }}
      </TypeAnalyzer>
    </GraphQLTypeResolutionContext.Provider>
  );
}
