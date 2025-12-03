import { Refable } from "../../../../types.js";
import {
  OperationExampleData,
  TypeSpecOperation,
  TypeSpecOperationParameter,
  TypeSpecRequestBody,
} from "../interfaces.js";
import { Context } from "../utils/context.js";
import { normalizeObjectValueToTSValueExpression } from "../utils/decorators.js";
import { generateDocs } from "../utils/docs.js";
import { generateDecorators } from "./generate-decorators.js";
import { generateOperationReturnType } from "./generate-response-expressions.js";

/**
 * Generates @opExample decorators from operation example data.
 */
function generateOpExampleDecorators(opExamples: OperationExampleData[] | undefined): string[] {
  if (!opExamples || opExamples.length === 0) return [];

  return opExamples.map((example) => {
    const exampleParts: string[] = [];

    if (example.parameters !== undefined) {
      const paramsExpr = normalizeObjectValueToTSValueExpression(example.parameters);
      exampleParts.push(`parameters: ${paramsExpr}`);
    }

    if (example.returnType !== undefined) {
      const returnExpr = normalizeObjectValueToTSValueExpression(example.returnType);
      exampleParts.push(`returnType: ${returnExpr}`);
    }

    const exampleValue = `#{${exampleParts.join(", ")}}`;

    if (example.title || example.description) {
      const options: string[] = [];
      if (example.title) options.push(`title: ${JSON.stringify(example.title)}`);
      if (example.description) options.push(`description: ${JSON.stringify(example.description)}`);
      return `@opExample(${exampleValue}, #{${options.join(", ")}})`;
    }

    return `@opExample(${exampleValue})`;
  });
}

export function generateOperation(operation: TypeSpecOperation, context: Context): string {
  const definitions: string[] = [];

  if (operation.doc) {
    definitions.push(generateDocs(operation.doc));
  }

  definitions.push(...generateOpExampleDecorators(operation.opExamples));

  definitions.push(...operation.tags.map((t) => `@tag("${t}")`));

  definitions.push(generateDecorators(operation.decorators).join(" "));

  // generate parameters
  const parameters: string[] = [
    ...operation.parameters.map((p) => generateOperationParameter(operation, p, context)),
    ...generateRequestBodyParameters(operation.requestBodies, context),
  ];

  const responses = generateOperationReturnType(operation, context);

  if (operation.fixmes?.length) {
    definitions.push("\n", ...operation.fixmes.map((f) => `// FIXME: ${f}\n`));
  }

  definitions.push(`op ${operation.name}(${parameters.join(", ")}): ${responses};`);

  return definitions.join(" ");
}

function generateOperationParameter(
  operation: TypeSpecOperation,
  parameter: Refable<TypeSpecOperationParameter>,
  context: Context,
) {
  if ("$ref" in parameter) {
    return `...${context.getRefName(parameter.$ref, operation.scope)}`;
  }

  const definitions: string[] = [];

  if (parameter.doc) {
    definitions.push(generateDocs(parameter.doc));
  }

  definitions.push(...generateDecorators(parameter.decorators));

  definitions.push(
    `${parameter.name}${parameter.isOptional ? "?" : ""}: ${context.generateTypeFromRefableSchema(parameter.schema, operation.scope)}`,
  );

  return definitions.join(" ");
}

function generateRequestBodyParameters(
  requestBodies: TypeSpecRequestBody[],
  context: Context,
): string[] {
  if (!requestBodies.length) {
    return [];
  }

  const definitions: string[] = [];

  // Generate the content-type header if defined content-types is not just 'application/json'
  const contentTypes = requestBodies.map((r) => r.contentType);
  if (!supportsOnlyJson(contentTypes)) {
    definitions.push(`@header contentType: ${contentTypes.map((c) => `"${c}"`).join(" | ")}`);
  }

  // Check if any content type is multipart
  const isMultipart = requestBodies.some((r) => r.contentType.startsWith("multipart/"));
  // Get the set of referenced types
  const body = Array.from(
    new Set(
      requestBodies
        .filter((r) => !!r.schema)
        .map((r) => context.generateTypeFromRefableSchema(r.schema!, [], isMultipart, r.encoding)),
    ),
  ).join(" | ");

  if (body) {
    let doc = "";
    if (requestBodies[0].doc) {
      doc = generateDocs(requestBodies[0].doc);
    }
    if (isMultipart) {
      definitions.push(`${doc}@multipartBody body: ${body}`);
    } else {
      definitions.push(`${doc}@body body: ${body}`);
    }
  }

  return definitions;
}

function supportsOnlyJson(contentTypes: string[]) {
  return contentTypes.length === 1 && contentTypes[0] === "application/json";
}
