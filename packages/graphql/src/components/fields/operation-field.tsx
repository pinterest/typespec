import { type Operation, getDoc, getDeprecationDetails } from "@typespec/compiler";
import * as gql from "@alloy-js/graphql";
import { useTsp } from "@typespec/emitter-framework";
import { GraphQLTypeResolutionContext } from "../../context/index.js";
import { isNullable, hasNullableElements } from "../../lib/nullable.js";
import { GraphQLTypeExpression } from "./type-expression.js";

export interface OperationFieldProps {
  /** The operation to render as a field */
  operation: Operation;
}

/**
 * Renders an operation as a field with arguments.
 *
 * Used for @operationFields decorator where operations become
 * fields on a type with parameters as arguments.
 *
 * Nullability for parameters is tracked by the mutation engine on each
 * mutated ModelProperty (see nullable.ts). This component queries the
 * state maps and passes the results to GraphQLTypeExpression.
 */
export function OperationField(props: OperationFieldProps) {
  const { program } = useTsp();
  const params = Array.from(props.operation.parameters.properties.values());
  const doc = getDoc(program, props.operation);
  const deprecation = getDeprecationDetails(program, props.operation);

  return (
    <GraphQLTypeResolutionContext.Provider value={{ mode: "output" }}>
      <GraphQLTypeExpression
        type={props.operation.returnType}
        isOptional={false}
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
            <GraphQLTypeResolutionContext.Provider value={{ mode: "input" }}>
              {params.map((param) => (
                <GraphQLTypeExpression
                  key={param.name}
                  type={param.type}
                  isOptional={param.optional}
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
            </GraphQLTypeResolutionContext.Provider>
          </gql.Field>
        )}
      </GraphQLTypeExpression>
    </GraphQLTypeResolutionContext.Provider>
  );
}
