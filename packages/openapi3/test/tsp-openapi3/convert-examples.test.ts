import { formatTypeSpec } from "@typespec/compiler";
import { strictEqual } from "node:assert";
import { describe, it } from "vitest";
import { convertOpenAPI3Document } from "../../src/index.js";

const versions = ["3.0.0", "3.1.0", "3.2.0"] as const;

describe.each(versions)("convertOpenAPI3Document examples v%s", (version) => {
  describe("Schema examples", () => {
    it("converts single example on model", async () => {
      const tsp = await convertOpenAPI3Document({
        openapi: version,
        info: {
          title: "Test",
          version: "1.0.0",
        },
        paths: {},
        components: {
          schemas: {
            Pet: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                },
              },
              example: {
                name: "Fluffy",
              },
            },
          },
        },
      } as any);

      strictEqual(
        tsp,
        await formatTypeSpec(
          `
          import "@typespec/http";
          import "@typespec/openapi";
          import "@typespec/openapi3";

          using Http;
          using OpenAPI;

          @service(#{ title: "Test" })
          @info(#{ version: "1.0.0" })
          namespace Test;

          @example(#{ name: "Fluffy" })
          model Pet {
            name?: string;
          }
          `,
          { printWidth: 100, tabWidth: 2 },
        ),
      );
    });

    it("converts property examples", async () => {
      const tsp = await convertOpenAPI3Document({
        openapi: version,
        info: {
          title: "Test",
          version: "1.0.0",
        },
        paths: {},
        components: {
          schemas: {
            Pet: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  example: "Fluffy",
                },
                age: {
                  type: "integer",
                  example: 3,
                },
              },
            },
          },
        },
      } as any);

      strictEqual(
        tsp,
        await formatTypeSpec(
          `
          import "@typespec/http";
          import "@typespec/openapi";
          import "@typespec/openapi3";

          using Http;
          using OpenAPI;

          @service(#{ title: "Test" })
          @info(#{ version: "1.0.0" })
          namespace Test;

          model Pet {
            @example("Fluffy") name?: string;
            @example(3) age?: integer;
          }
          `,
          { printWidth: 100, tabWidth: 2 },
        ),
      );
    });

    it("converts enum examples", async () => {
      const tsp = await convertOpenAPI3Document({
        openapi: version,
        info: {
          title: "Test",
          version: "1.0.0",
        },
        paths: {},
        components: {
          schemas: {
            Status: {
              type: "string",
              enum: ["active", "inactive"],
              example: "active",
            },
          },
        },
      } as any);

      strictEqual(
        tsp,
        await formatTypeSpec(
          `
          import "@typespec/http";
          import "@typespec/openapi";
          import "@typespec/openapi3";

          using Http;
          using OpenAPI;

          @service(#{ title: "Test" })
          @info(#{ version: "1.0.0" })
          namespace Test;

          @example("active")
          enum Status {
            "active",
            "inactive",
          }
          `,
          { printWidth: 100, tabWidth: 2 },
        ),
      );
    });

    it("converts scalar examples", async () => {
      const tsp = await convertOpenAPI3Document({
        openapi: version,
        info: {
          title: "Test",
          version: "1.0.0",
        },
        paths: {},
        components: {
          schemas: {
            UserId: {
              type: "string",
              format: "uuid",
              example: "550e8400-e29b-41d4-a716-446655440000",
            },
          },
        },
      } as any);

      strictEqual(
        tsp,
        await formatTypeSpec(
          `
          import "@typespec/http";
          import "@typespec/openapi";
          import "@typespec/openapi3";

          using Http;
          using OpenAPI;

          @service(#{ title: "Test" })
          @info(#{ version: "1.0.0" })
          namespace Test;

          @example("550e8400-e29b-41d4-a716-446655440000")
          @format("uuid")
          scalar UserId extends string;
          `,
          { printWidth: 100, tabWidth: 2 },
        ),
      );
    });

    it("converts union examples", async () => {
      const tsp = await convertOpenAPI3Document({
        openapi: version,
        info: {
          title: "Test",
          version: "1.0.0",
        },
        paths: {},
        components: {
          schemas: {
            StringOrNumber: {
              oneOf: [{ type: "string" }, { type: "number" }],
              example: "hello",
            },
          },
        },
      } as any);

      strictEqual(
        tsp,
        await formatTypeSpec(
          `
          import "@typespec/http";
          import "@typespec/openapi";
          import "@typespec/openapi3";

          using Http;
          using OpenAPI;

          @service(#{ title: "Test" })
          @info(#{ version: "1.0.0" })
          namespace Test;

          @example("hello")
          @oneOf
          union StringOrNumber {
            string,
            numeric,
          }
          `,
          { printWidth: 100, tabWidth: 2 },
        ),
      );
    });

    it("converts model and property examples together", async () => {
      const tsp = await convertOpenAPI3Document({
        openapi: version,
        info: {
          title: "Test",
          version: "1.0.0",
        },
        paths: {},
        components: {
          schemas: {
            Pet: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  example: "Buddy",
                },
                age: {
                  type: "integer",
                  example: 5,
                },
              },
              example: {
                name: "Fluffy",
                age: 2,
              },
            },
          },
        },
      } as any);

      strictEqual(
        tsp,
        await formatTypeSpec(
          `
          import "@typespec/http";
          import "@typespec/openapi";
          import "@typespec/openapi3";

          using Http;
          using OpenAPI;

          @service(#{ title: "Test" })
          @info(#{ version: "1.0.0" })
          namespace Test;

          @example(#{ name: "Fluffy", age: 2 })
          model Pet {
            @example("Buddy") name?: string;
            @example(5) age?: integer;
          }
          `,
          { printWidth: 100, tabWidth: 2 },
        ),
      );
    });
  });

  describe("OpenAPI 3.1+ examples array", () => {
    it("converts multiple examples from examples array", async () => {
      if (version === "3.0.0") {
        // Skip for 3.0.0 as examples array is 3.1+ feature
        return;
      }

      const tsp = await convertOpenAPI3Document({
        openapi: version,
        info: {
          title: "Test",
          version: "1.0.0",
        },
        paths: {},
        components: {
          schemas: {
            Pet: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                },
              },
              examples: [{ name: "Fluffy" }, { name: "Rex" }],
            },
          },
        },
      } as any);

      strictEqual(tsp.includes('@example(#{ name: "Fluffy" })'), true);
      strictEqual(tsp.includes('@example(#{ name: "Rex" })'), true);
    });
  });

  describe("Operation examples", () => {
    it("converts request body example", async () => {
      const tsp = await convertOpenAPI3Document({
        openapi: version,
        info: {
          title: "Test",
          version: "1.0.0",
        },
        paths: {
          "/pets": {
            post: {
              operationId: "createPet",
              requestBody: {
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                      },
                    },
                    example: {
                      name: "Fluffy",
                    },
                  },
                },
              },
              responses: {
                "200": {
                  description: "Success",
                },
              },
            },
          },
        },
        components: {},
      } as any);

      strictEqual(tsp.includes('@opExample(#{ parameters: #{ name: "Fluffy" } })'), true);
    });

    it("converts response example", async () => {
      const tsp = await convertOpenAPI3Document({
        openapi: version,
        info: {
          title: "Test",
          version: "1.0.0",
        },
        paths: {
          "/pets/{id}": {
            get: {
              operationId: "getPet",
              parameters: [
                {
                  name: "id",
                  in: "path",
                  required: true,
                  schema: { type: "string" },
                },
              ],
              responses: {
                "200": {
                  description: "Success",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          name: { type: "string" },
                        },
                      },
                      example: {
                        name: "Fluffy",
                      },
                    },
                  },
                },
              },
            },
          },
        },
        components: {},
      } as any);

      strictEqual(
        tsp.includes('@opExample(#{ returnType: #{ name: "Fluffy", statusCode: 200 } })'),
        true,
      );
    });

    it("converts request and response examples together", async () => {
      const tsp = await convertOpenAPI3Document({
        openapi: version,
        info: {
          title: "Test",
          version: "1.0.0",
        },
        paths: {
          "/pets": {
            post: {
              operationId: "createPet",
              requestBody: {
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                      },
                    },
                    example: {
                      name: "Fluffy",
                    },
                  },
                },
              },
              responses: {
                "201": {
                  description: "Created",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          name: { type: "string" },
                        },
                      },
                      example: {
                        id: "123",
                        name: "Fluffy",
                      },
                    },
                  },
                },
              },
            },
          },
        },
        components: {},
      } as any);

      strictEqual(tsp.includes('@opExample(#{ parameters: #{ name: "Fluffy" } })'), true);
      strictEqual(
        tsp.includes(
          '@opExample(#{ returnType: #{ id: "123", name: "Fluffy", statusCode: 201 } })',
        ),
        true,
      );
    });

    it("converts named examples with titles", async () => {
      const tsp = await convertOpenAPI3Document({
        openapi: version,
        info: {
          title: "Test",
          version: "1.0.0",
        },
        paths: {
          "/pets/{id}": {
            get: {
              operationId: "getPet",
              parameters: [
                {
                  name: "id",
                  in: "path",
                  required: true,
                  schema: { type: "string" },
                },
              ],
              responses: {
                "200": {
                  description: "Success",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          name: { type: "string" },
                        },
                      },
                      examples: {
                        fluffy: {
                          summary: "Example with Fluffy",
                          value: {
                            name: "Fluffy",
                          },
                        },
                        rex: {
                          summary: "Example with Rex",
                          value: {
                            name: "Rex",
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        components: {},
      } as any);

      strictEqual(
        tsp.includes(
          '@opExample(#{ returnType: #{ name: "Fluffy", statusCode: 200 } }, #{ title: "Example with Fluffy" })',
        ),
        true,
      );
      strictEqual(
        tsp.includes(
          '@opExample(#{ returnType: #{ name: "Rex", statusCode: 200 } }, #{ title: "Example with Rex" })',
        ),
        true,
      );
    });

    it("converts named examples with descriptions", async () => {
      const tsp = await convertOpenAPI3Document({
        openapi: version,
        info: {
          title: "Test",
          version: "1.0.0",
        },
        paths: {
          "/pets": {
            post: {
              operationId: "createPet",
              requestBody: {
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                      },
                    },
                    examples: {
                      withDescription: {
                        summary: "Example pet",
                        description: "A detailed example of creating a pet",
                        value: {
                          name: "Fluffy",
                        },
                      },
                    },
                  },
                },
              },
              responses: {
                "201": {
                  description: "Created",
                },
              },
            },
          },
        },
        components: {},
      } as any);

      // Check that all components are present (formatter may wrap across lines)
      strictEqual(tsp.includes("@opExample"), true);
      strictEqual(tsp.includes('parameters: #{ name: "Fluffy" }'), true);
      strictEqual(tsp.includes('title: "Example pet"'), true);
      strictEqual(tsp.includes('description: "A detailed example of creating a pet"'), true);
    });

    it("converts multiple response examples for different status codes", async () => {
      const tsp = await convertOpenAPI3Document({
        openapi: version,
        info: {
          title: "Test",
          version: "1.0.0",
        },
        paths: {
          "/pets/{id}": {
            get: {
              operationId: "getPet",
              parameters: [
                {
                  name: "id",
                  in: "path",
                  required: true,
                  schema: { type: "string" },
                },
              ],
              responses: {
                "200": {
                  description: "Success",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          name: { type: "string" },
                        },
                      },
                      example: {
                        name: "Fluffy",
                      },
                    },
                  },
                },
                "404": {
                  description: "Not Found",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          error: { type: "string" },
                        },
                      },
                      example: {
                        error: "Pet not found",
                      },
                    },
                  },
                },
              },
            },
          },
        },
        components: {},
      } as any);

      strictEqual(
        tsp.includes('@opExample(#{ returnType: #{ name: "Fluffy", statusCode: 200 } })'),
        true,
      );
      strictEqual(
        tsp.includes('@opExample(#{ returnType: #{ error: "Pet not found", statusCode: 404 } })'),
        true,
      );
    });
  });

  describe("Edge cases", () => {
    it("handles primitive type examples", async () => {
      const tsp = await convertOpenAPI3Document({
        openapi: version,
        info: {
          title: "Test",
          version: "1.0.0",
        },
        paths: {},
        components: {
          schemas: {
            Pet: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  example: "Fluffy",
                },
                age: {
                  type: "number",
                  example: 3.5,
                },
                isActive: {
                  type: "boolean",
                  example: true,
                },
                tags: {
                  type: "array",
                  items: { type: "string" },
                  example: ["friendly", "cute"],
                },
              },
            },
          },
        },
      } as any);

      strictEqual(tsp.includes('@example("Fluffy")'), true);
      strictEqual(tsp.includes("@example(3.5)"), true);
      strictEqual(tsp.includes("@example(true)"), true);
      strictEqual(tsp.includes('@example(#["friendly", "cute"])'), true);
    });

    it("handles null examples", async () => {
      const tsp = await convertOpenAPI3Document({
        openapi: version,
        info: {
          title: "Test",
          version: "1.0.0",
        },
        paths: {},
        components: {
          schemas: {
            Pet: {
              type: "object",
              properties: {
                nickname: {
                  type: "string",
                  nullable: true,
                  example: null,
                },
              },
            },
          },
        },
      } as any);

      strictEqual(tsp.includes("@example(null)"), true);
    });

    it("handles nested object examples", async () => {
      const tsp = await convertOpenAPI3Document({
        openapi: version,
        info: {
          title: "Test",
          version: "1.0.0",
        },
        paths: {},
        components: {
          schemas: {
            Pet: {
              type: "object",
              properties: {
                name: { type: "string" },
                owner: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    email: { type: "string" },
                  },
                },
              },
              example: {
                name: "Fluffy",
                owner: {
                  name: "John",
                  email: "john@example.com",
                },
              },
            },
          },
        },
      } as any);

      strictEqual(
        tsp.includes(
          '@example(#{ name: "Fluffy", owner: #{ name: "John", email: "john@example.com" } })',
        ),
        true,
      );
    });

    it("does not add example decorators when no examples are present", async () => {
      const tsp = await convertOpenAPI3Document({
        openapi: version,
        info: {
          title: "Test",
          version: "1.0.0",
        },
        paths: {},
        components: {
          schemas: {
            Pet: {
              type: "object",
              properties: {
                name: { type: "string" },
              },
            },
          },
        },
      } as any);

      strictEqual(tsp.includes("@example"), false);
      strictEqual(tsp.includes("@opExample"), false);
    });
  });
});
