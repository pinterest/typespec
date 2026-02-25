import { type Operation, getDoc, getDeprecationDetails } from "@typespec/compiler";
import * as gql from "@alloy-js/graphql";
import { useTsp } from "@typespec/emitter-framework";
import { GraphQLTypeResolutionContext } from "../../context/index.js";
import { TypeAnalyzer } from "./type-analyzer.js";

export interface OperationFieldProps {
  /** The operation to render as a field */
  operation: Operation;
}

/**
 * Renders an operation as a field with arguments
 *
 * Used for @operationFields decorator where operations become
 * fields on a type with parameters as arguments.
 */
export function OperationField(props: OperationFieldProps) {
  const { program } = useTsp();
  const params = Array.from(props.operation.parameters.properties.values());
  const doc = getDoc(program, props.operation);
  const deprecation = getDeprecationDetails(program, props.operation);

  return (
    <GraphQLTypeResolutionContext.Provider value={{ mode: "output" }}>
      <TypeAnalyzer type={props.operation.returnType} isOptional={false} targetType={props.operation}>
        {(returnTypeInfo) => (
          <gql.Field
            name={props.operation.name}
            type={returnTypeInfo.typeName}
            nonNull={returnTypeInfo.isList ? returnTypeInfo.itemNonNull : returnTypeInfo.isNonNull}
            description={doc}
            deprecated={deprecation ? deprecation.message : undefined}
          >
            {returnTypeInfo.isList ? <gql.Field.List nonNull={returnTypeInfo.isNonNull} /> : undefined}
            <GraphQLTypeResolutionContext.Provider value={{ mode: "input" }}>
              {params.map((param) => (
                <TypeAnalyzer key={param.name} type={param.type} isOptional={param.optional} targetType={param}>
                  {(paramTypeInfo) => (
                    <gql.InputValue
                      name={param.name}
                      type={paramTypeInfo.typeName}
                      nonNull={paramTypeInfo.isList ? paramTypeInfo.itemNonNull : paramTypeInfo.isNonNull}
                      description={getDoc(program, param)}
                      deprecated={getDeprecationDetails(program, param)?.message}
                    >
                      {paramTypeInfo.isList ? <gql.InputValue.List nonNull={paramTypeInfo.isNonNull} /> : undefined}
                    </gql.InputValue>
                  )}
                </TypeAnalyzer>
              ))}
            </GraphQLTypeResolutionContext.Provider>
          </gql.Field>
        )}
      </TypeAnalyzer>
    </GraphQLTypeResolutionContext.Provider>
  );
}
