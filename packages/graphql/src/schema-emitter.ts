import {
  emitFile,
  getNamespaceFullName,
  interpolatePath,
  type EmitContext,
  type Program,
} from "@typespec/compiler";
import {
  GraphQLBoolean,
  GraphQLObjectType,
  GraphQLSchema,
  printSchema,
  validateSchema,
  type GraphQLSchemaConfig,
} from "graphql";
import type { ResolvedGraphQLEmitterOptions } from "./emitter.js";
import { createDiagnostic, type GraphQLEmitterOptions } from "./lib.js";
import { listSchemas, type Schema } from "./lib/schema.js";
import { GraphQLTypeRegistry } from "./registry.js";
import type { GraphQLSchemaRecord } from "./types.js";

export const PLACEHOLDER_FIELD = {
  type: GraphQLBoolean,
  description:
    "A placeholder field. If you are seeing this, it means no operations were defined that could be emitted.",
};

export function createGraphQLEmitter(
  context: EmitContext<GraphQLEmitterOptions>,
  options: ResolvedGraphQLEmitterOptions,
) {
  const program = context.program;

  return {
    emitGraphQL,
  };

  function resolveOutputFile(schema: Schema, multipleSchema: boolean): string {
    return interpolatePath(options.outputFile, {
      "schema-name": multipleSchema ? schema.name || getNamespaceFullName(schema.type) : "schema",
    });
  }

  async function emitGraphQL() {
    const emitter = new GraphQLEmitter(program, options);

    for (const schemaRecord of emitter.schemaRecords) {
      program.reportDiagnostics(schemaRecord.diagnostics);
    }

    if (program.compilerOptions.noEmit || program.hasError()) {
      return;
    }

    const multipleSchema = emitter.schemaRecords.length > 1;

    for (const schemaRecord of emitter.schemaRecords) {
      await emitFile(program, {
        path: resolveOutputFile(schemaRecord.schema, multipleSchema),
        content: serializeDocument(schemaRecord.graphQLSchema),
        newLine: options.newLine,
      });
    }
  }
}

function serializeDocument(schema: GraphQLSchema): string {
  return printSchema(schema);
}

export class GraphQLEmitter {
  #options: ResolvedGraphQLEmitterOptions;
  program: Program;

  constructor(program: Program, options: ResolvedGraphQLEmitterOptions) {
    this.#options = options;
    this.program = program;
  }

  #schemaDefinitions?: Schema[];
  get schemaDefinitions(): Schema[] {
    if (!this.#schemaDefinitions) {
      const schemas = listSchemas(this.program);
      if (schemas.length === 0) {
        schemas.push({ type: this.program.getGlobalNamespaceType() });
      }
      this.#schemaDefinitions = schemas;
    }
    return this.#schemaDefinitions;
  }

  #registry?: GraphQLTypeRegistry;
  get registry() {
    if (!this.#registry) {
      this.#registry = new GraphQLTypeRegistry(this.program);
    }
    return this.#registry;
  }

  #schemaRecords?: GraphQLSchemaRecord[];
  get schemaRecords(): GraphQLSchemaRecord[] {
    if (!this.#schemaRecords) {
      this.#schemaRecords = this.#buildGraphQLSchemas();
    }
    return this.#schemaRecords;
  }

  static get placeholderQuery(): GraphQLObjectType {
    return new GraphQLObjectType({
      name: "Query",
      fields: {
        // An Object type must define one or more fields.
        // https://spec.graphql.org/October2021/#sec-Objects.Type-Validation
        _: PLACEHOLDER_FIELD,
      },
    });
  }

  #buildGraphQLSchemas(): GraphQLSchemaRecord[] {
    const schemaRecords: GraphQLSchemaRecord[] = [];

    for (const schema of this.schemaDefinitions) {
      const schemaConfig: GraphQLSchemaConfig = {};
      if (!("query" in schemaConfig)) {
        // The query root operation type must be provided and must be an Object type.
        // https://spec.graphql.org/draft/#sec-Root-Operation-Types
        schemaConfig.query = GraphQLEmitter.placeholderQuery;
      }
      // Build schema
      const graphQLSchema = new GraphQLSchema(schemaConfig);
      // Validate schema
      const validationErrors = validateSchema(graphQLSchema);
      const diagnostics = validationErrors.map((error) => {
        const locations = error.locations?.map((loc) => `line ${loc.line}, column ${loc.column}`);
        return createDiagnostic({
          code: "graphql-validation-error",
          format: {
            message: error.message,
            locations: locations ? locations.join(", ") : "none",
          },
          target: schema.type,
        });
      });

      schemaRecords.push({ schema, graphQLSchema, diagnostics });
    }

    return schemaRecords;
  }
}
