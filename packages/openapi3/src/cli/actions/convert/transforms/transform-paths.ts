import { printIdentifier } from "@typespec/compiler";
import {
  OpenAPI3Operation,
  OpenAPI3Parameter,
  OpenAPI3PathItem,
  OpenAPI3RequestBody,
  OpenAPIOperation3_2,
  OpenAPIParameter3_2,
  OpenAPIPathItem3_2,
  OpenAPIRequestBody3_2,
  Refable,
} from "../../../../types.js";
import {
  OperationExampleData,
  TypeSpecOperation,
  TypeSpecOperationParameter,
  TypeSpecRequestBody,
} from "../interfaces.js";
import { Context } from "../utils/context.js";
import { getExtensions, getParameterDecorators } from "../utils/decorators.js";
import { generateOperationId } from "../utils/generate-operation-id.js";
import { getScopeAndName } from "../utils/get-scope-and-name.js";
import { supportedHttpMethods } from "../utils/supported-http-methods.js";

/**
 * Transforms each operation defined under #/paths/{route}/{httpMethod} into a TypeSpec operation.
 * @params models - The array of models to populate with any new models generated from the operation.
 * @param paths
 * @returns
 */
export function transformPaths(
  paths: Record<string, OpenAPI3PathItem> | Record<string, OpenAPIPathItem3_2>,
  context: Context,
): TypeSpecOperation[] {
  const operations: TypeSpecOperation[] = [];
  const usedOperationIds = new Set<string>();

  for (const route of Object.keys(paths)) {
    const routeParameters = paths[route].parameters?.map(transformOperationParameter) ?? [];
    const path = paths[route];
    for (const verb of supportedHttpMethods) {
      const operation = path[verb];
      if (!operation) continue;

      const parameters = operation.parameters?.map(transformOperationParameter) ?? [];
      const tags = operation.tags?.map((t) => t) ?? [];

      const operationResponses = operation.responses ?? {};

      const decorators = [
        ...getExtensions(operation),
        { name: "route", args: [route] },
        { name: verb, args: [] },
      ];

      if (operation.summary) {
        decorators.push({ name: "summary", args: [operation.summary] });
      }

      const fixmes: string[] = [];

      // Handle missing operationId
      let operationId = operation.operationId;
      if (!operationId) {
        operationId = generateOperationId(verb, route, usedOperationIds);
        const warning = `Open API operation '${verb.toUpperCase()} ${route}' is missing an operationId. Generated: '${operationId}'`;
        context.logger.warn(warning);
        fixmes.push(warning);
      } else {
        usedOperationIds.add(operationId);
      }

      const requestBodies = transformRequestBodies(operation.requestBody, context);
      const opExamples = extractOperationExamples(operation, context);

      // Check if we need to split the operation due to incompatible content types
      const splitOperations = splitOperationByContentType(
        operationId,
        decorators,
        dedupeParameters([...routeParameters, ...parameters]),
        operation.description,
        requestBodies,
        operationResponses,
        tags,
        fixmes,
        usedOperationIds,
        opExamples,
      );

      operations.push(...splitOperations);
    }
  }

  return operations;
}

function dedupeParameters(
  parameters: Refable<TypeSpecOperationParameter>[],
): Refable<TypeSpecOperationParameter>[] {
  const seen = new Set<string>();
  const dedupeList: Refable<TypeSpecOperationParameter>[] = [];

  // iterate in reverse since more specific-scoped parameters are added last
  for (let i = parameters.length - 1; i >= 0; i--) {
    // ignore resolving the $ref for now, unlikely to be able to resolve
    // issues without user intervention if a duplicate is present except in
    // very simple cases.
    const param = parameters[i];

    const identifier = "$ref" in param ? param.$ref : `${param.in}.${param.name}`;

    if (seen.has(identifier)) continue;
    seen.add(identifier);

    dedupeList.unshift(param);
  }

  return dedupeList;
}

function transformOperationParameter(
  parameter: Refable<OpenAPI3Parameter> | Refable<OpenAPIParameter3_2>,
): Refable<TypeSpecOperationParameter> {
  if ("$ref" in parameter) {
    return { $ref: parameter.$ref };
  }

  return {
    name: printIdentifier(parameter.name),
    in: parameter.in,
    doc: parameter.description,
    decorators: getParameterDecorators(parameter),
    isOptional: !parameter.required,
    schema: "schema" in parameter ? (parameter.schema ?? {}) : {},
  };
}

/**
 * Splits an operation into multiple operations if it has incompatible content types
 * (e.g., multipart/form-data and application/json)
 */
function splitOperationByContentType(
  operationId: string,
  decorators: any[],
  parameters: Refable<TypeSpecOperationParameter>[],
  doc: string | undefined,
  requestBodies: TypeSpecRequestBody[],
  responses: any,
  tags: string[],
  fixmes: string[],
  usedOperationIds: Set<string>,
  opExamples: OperationExampleData[],
): TypeSpecOperation[] {
  // If no request bodies or only one content type, no splitting needed
  if (requestBodies.length <= 1) {
    return [
      {
        ...getScopeAndName(operationId),
        decorators,
        parameters,
        doc,
        operationId,
        requestBodies,
        responses,
        tags,
        fixmes,
        opExamples: opExamples.length > 0 ? opExamples : undefined,
      },
    ];
  }

  // Group request bodies by compatibility
  const multipartBodies = requestBodies.filter((r) => r.contentType.startsWith("multipart/"));
  const nonMultipartBodies = requestBodies.filter((r) => !r.contentType.startsWith("multipart/"));

  // If all are the same type (all multipart or all non-multipart), no splitting needed
  if (multipartBodies.length === 0 || nonMultipartBodies.length === 0) {
    return [
      {
        ...getScopeAndName(operationId),
        decorators,
        parameters,
        doc,
        operationId,
        requestBodies,
        responses,
        tags,
        fixmes,
        opExamples: opExamples.length > 0 ? opExamples : undefined,
      },
    ];
  }

  // Need to split into separate operations
  const operations: TypeSpecOperation[] = [];

  // Helper to create a suffix from content type
  const getContentTypeSuffix = (contentType: string): string => {
    if (contentType.startsWith("multipart/")) {
      return "Multipart";
    } else if (contentType === "application/json") {
      return "Json";
    } else if (contentType.startsWith("application/")) {
      // Remove 'application/' and capitalize first letter
      const type = contentType.replace("application/", "");
      return type.charAt(0).toUpperCase() + type.slice(1).replace(/[^a-zA-Z0-9]/g, "");
    } else if (contentType.startsWith("text/")) {
      const type = contentType.replace("text/", "");
      return type.charAt(0).toUpperCase() + type.slice(1).replace(/[^a-zA-Z0-9]/g, "");
    }
    // Default: sanitize content type
    return contentType.replace(/[^a-zA-Z0-9]/g, "");
  };

  // Group bodies that can share an operation (same category)
  const bodyGroups: TypeSpecRequestBody[][] = [];

  if (multipartBodies.length > 0) {
    bodyGroups.push(multipartBodies);
  }

  // For non-multipart, group by exact content type
  for (const body of nonMultipartBodies) {
    bodyGroups.push([body]);
  }

  // Create an operation for each group
  for (const bodyGroup of bodyGroups) {
    const suffix = getContentTypeSuffix(bodyGroup[0].contentType);
    const newOperationId = `${operationId}${suffix}`;

    // Track the new operation ID to avoid conflicts
    usedOperationIds.add(newOperationId);

    // Add @sharedRoute decorator
    const newDecorators = [{ name: "sharedRoute", args: [] }, ...decorators];

    operations.push({
      ...getScopeAndName(newOperationId),
      decorators: newDecorators,
      parameters,
      doc,
      operationId: newOperationId,
      requestBodies: bodyGroup,
      responses,
      tags,
      fixmes,
      opExamples: opExamples.length > 0 ? opExamples : undefined,
    });
  }

  return operations;
}

function transformRequestBodies(
  requestBodies: Refable<OpenAPI3RequestBody> | Refable<OpenAPIRequestBody3_2> | undefined,
  context: Context,
): TypeSpecRequestBody[] {
  if (!requestBodies) {
    return [];
  }

  const description = requestBodies.description;

  if ("$ref" in requestBodies) {
    requestBodies = context.getByRef<OpenAPI3RequestBody>(requestBodies.$ref);
  }

  if (!requestBodies) {
    return [];
  }

  const typespecBodies: TypeSpecRequestBody[] = [];
  for (const contentType of Object.keys(requestBodies.content)) {
    const contentBody = requestBodies.content[contentType];
    typespecBodies.push({
      contentType,
      isOptional: !requestBodies.required,
      doc: description ?? requestBodies.description,
      encoding: "encoding" in contentBody ? contentBody.encoding : undefined,
      schema: "schema" in contentBody ? contentBody.schema : {},
    });
  }

  return typespecBodies;
}

/**
 * Extracts examples from an OpenAPI operation.
 * Handles request body examples and response examples.
 */
function extractOperationExamples(
  operation: OpenAPI3Operation | OpenAPIOperation3_2,
  context: Context,
): OperationExampleData[] {
  const examples: OperationExampleData[] = [];

  // Extract from request body
  if (operation.requestBody) {
    let requestBody = operation.requestBody;

    // Resolve $ref if present
    if ("$ref" in requestBody) {
      requestBody = context.getByRef<OpenAPI3RequestBody>(requestBody.$ref) ?? requestBody;
    }

    if (!("$ref" in requestBody) && requestBody.content) {
      for (const mediaTypeObj of Object.values(requestBody.content)) {
        // Single example
        if ("example" in mediaTypeObj && mediaTypeObj.example !== undefined) {
          examples.push({
            parameters: mediaTypeObj.example,
          });
        }

        // Multiple named examples
        if ("examples" in mediaTypeObj && mediaTypeObj.examples) {
          for (const [name, exampleObj] of Object.entries(mediaTypeObj.examples)) {
            let resolvedExample: any = exampleObj;

            // Resolve $ref if present
            if (typeof exampleObj === "object" && exampleObj !== null && "$ref" in exampleObj) {
              const ref = (exampleObj as any).$ref;
              if (typeof ref === "string") {
                resolvedExample =
                  context.getByRef<{ value?: unknown; summary?: string; description?: string }>(
                    ref,
                  ) ?? exampleObj;
              }
            }

            if (!("$ref" in resolvedExample)) {
              examples.push({
                parameters: resolvedExample.value,
                title: resolvedExample.summary || name,
                description: resolvedExample.description,
              });
            }
          }
        }
      }
    }
  }

  // Extract from responses
  if (operation.responses) {
    for (const [statusCode, response] of Object.entries(operation.responses)) {
      let resolvedResponse = response;

      // Resolve $ref if present
      if ("$ref" in response) {
        resolvedResponse = context.getByRef<any>(response.$ref) ?? response;
      }

      if (
        !("$ref" in resolvedResponse) &&
        resolvedResponse.content &&
        typeof resolvedResponse.content === "object"
      ) {
        for (const mediaTypeObj of Object.values(resolvedResponse.content)) {
          const mtObj = mediaTypeObj as any;

          // Single example
          if ("example" in mtObj && mtObj.example !== undefined) {
            const exampleValue =
              typeof mtObj.example === "object" && mtObj.example !== null
                ? { ...mtObj.example, statusCode: Number(statusCode) }
                : mtObj.example;

            examples.push({
              returnType: exampleValue,
            });
          }

          // Multiple named examples
          if ("examples" in mtObj && mtObj.examples) {
            for (const [name, exampleObj] of Object.entries(mtObj.examples)) {
              let resolvedExample: any = exampleObj;

              // Resolve $ref if present
              if (typeof exampleObj === "object" && exampleObj !== null && "$ref" in exampleObj) {
                const ref = (exampleObj as any).$ref;
                if (typeof ref === "string") {
                  resolvedExample =
                    context.getByRef<{ value?: unknown; summary?: string; description?: string }>(
                      ref,
                    ) ?? exampleObj;
                }
              }

              if (!("$ref" in resolvedExample)) {
                const exampleValue =
                  typeof resolvedExample.value === "object" && resolvedExample.value !== null
                    ? { ...resolvedExample.value, statusCode: Number(statusCode) }
                    : resolvedExample.value;

                examples.push({
                  returnType: exampleValue,
                  title: resolvedExample.summary || name,
                  description: resolvedExample.description,
                });
              }
            }
          }
        }
      }
    }
  }

  return examples;
}
