import { type ModelProperty, getDoc, getDeprecationDetails } from "@typespec/compiler";
import * as gql from "@alloy-js/graphql";
import { useTsp } from "@typespec/emitter-framework";
import { isNullable, hasNullableElements } from "../../lib/nullable.js";
import { GraphQLTypeExpression } from "./type-expression.js";

export interface FieldProps {
  /** The model property to render as a field */
  property: ModelProperty;
  /** Whether this field is in an input type context */
  isInput: boolean;
}

export function Field(props: FieldProps) {
  const { program } = useTsp();

  const doc = getDoc(program, props.property);
  const deprecation = getDeprecationDetails(program, props.property);

  return (
    <GraphQLTypeExpression
      type={props.property.type}
      isOptional={props.property.optional}
      isInput={props.isInput}
      isNullable={isNullable(props.property)}
      hasNullableElements={hasNullableElements(props.property)}
      targetType={props.property}
    >
      {(typeInfo) => {
        if (props.isInput) {
          return (
            <gql.InputField
              name={props.property.name}
              type={typeInfo.typeName}
              nonNull={typeInfo.isList ? typeInfo.itemNonNull : typeInfo.isNonNull}
              description={doc}
              deprecated={deprecation ? deprecation.message : undefined}
            >
              {typeInfo.isList ? (
                <gql.InputField.List nonNull={typeInfo.isNonNull} />
              ) : undefined}
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
            {typeInfo.isList ? (
              <gql.Field.List nonNull={typeInfo.isNonNull} />
            ) : undefined}
          </gql.Field>
        );
      }}
    </GraphQLTypeExpression>
  );
}
