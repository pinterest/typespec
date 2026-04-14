import { type Operation, getDoc, getDeprecationDetails } from "@typespec/compiler";
import * as gql from "@alloy-js/graphql";
import { useTsp } from "@typespec/emitter-framework";
import { isNullable, hasNullableElements } from "../../lib/nullable.js";
import { GraphQLTypeExpression } from "./type-expression.js";

export interface OperationFieldProps {
  /** The operation to render as a field */
  operation: Operation;
}

/**
 * Renders an operation as a field with arguments, used for @operationFields.
 */
export function OperationField(props: OperationFieldProps) {
  const { program } = useTsp();
  const params = Array.from(props.operation.parameters.properties.values());
  const doc = getDoc(program, props.operation);
  const deprecation = getDeprecationDetails(program, props.operation);

  return (
    <GraphQLTypeExpression
      type={props.operation.returnType}
      isOptional={false}
      isInput={false}
      isNullable={isNullable(program, props.operation)}
      targetType={props.operation}
    >
      {(returnTypeInfo) => (
        <gql.Field
          name={props.operation.name}
          type={returnTypeInfo.typeName}
          nonNull={
            returnTypeInfo.isList
              ? returnTypeInfo.itemNonNull
              : returnTypeInfo.isNonNull
          }
          description={doc}
          deprecated={deprecation ? deprecation.message : undefined}
        >
          {returnTypeInfo.isList ? (
            <gql.Field.List nonNull={returnTypeInfo.isNonNull} />
          ) : undefined}
          {params.map((param) => (
            <GraphQLTypeExpression
              type={param.type}
              isOptional={param.optional}
              isInput={true}
              isNullable={isNullable(program, param)}
              hasNullableElements={hasNullableElements(program, param)}
              targetType={param}
            >
              {(paramTypeInfo) => (
                <gql.InputValue
                  name={param.name}
                  type={paramTypeInfo.typeName}
                  nonNull={
                    paramTypeInfo.isList
                      ? paramTypeInfo.itemNonNull
                      : paramTypeInfo.isNonNull
                  }
                  description={getDoc(program, param)}
                  deprecated={
                    getDeprecationDetails(program, param)?.message
                  }
                >
                  {paramTypeInfo.isList ? (
                    <gql.InputValue.List
                      nonNull={paramTypeInfo.isNonNull}
                    />
                  ) : undefined}
                </gql.InputValue>
              )}
            </GraphQLTypeExpression>
          ))}
        </gql.Field>
      )}
    </GraphQLTypeExpression>
  );
}
