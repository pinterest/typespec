import type { DecoratorContext, Model, Namespace, Operation, Type } from "@typespec/compiler";

export interface AdditionalInfo {
  readonly [key: string]: unknown;
  readonly title?: string;
  readonly summary?: string;
  readonly version?: string;
  readonly termsOfService?: string;
  readonly contact?: Contact;
  readonly license?: License;
}

export interface TagMetadata {
  readonly [key: string]: unknown;
  readonly description?: string;
  readonly externalDocs?: ExternalDocs;
}

export interface Contact {
  readonly [key: string]: unknown;
  readonly name?: string;
  readonly url?: string;
  readonly email?: string;
}

export interface License {
  readonly [key: string]: unknown;
  readonly name: string;
  readonly url?: string;
}

export interface ExternalDocs {
  readonly [key: string]: unknown;
  readonly url: string;
  readonly description?: string;
}

/**
 * Specify the OpenAPI `operationId` property for this operation.
 *
 * @param operationId Operation id value.
 * @example
 * ```typespec
 * @operationId("download")
 * op read(): string;
 * ```
 */
export type OperationIdDecorator = (
  context: DecoratorContext,
  target: Operation,
  operationId: string,
) => void;

/**
 * Attach some custom data to the OpenAPI element generated from this type.
 *
 * @param key Extension key.
 * @param value Extension value.
 * @example
 * ```typespec
 * @extension("x-custom", "My value")
 * @extension("x-pageable", #{nextLink: "x-next-link"})
 * op read(): string;
 * ```
 */
export type ExtensionDecorator = (
  context: DecoratorContext,
  target: Type,
  key: string,
  value: unknown,
) => void;

/**
 * Specify that this model is to be treated as the OpenAPI `default` response.
 * This differs from the compiler built-in `@error` decorator as this does not necessarily represent an error.
 *
 * @example
 * ```typespec
 * @defaultResponse
 * model PetStoreResponse is object;
 *
 * op listPets(): Pet[] | PetStoreResponse;
 * ```
 */
export type DefaultResponseDecorator = (context: DecoratorContext, target: Model) => void;

/**
 * Specify the OpenAPI `externalDocs` property for this type.
 *
 * @param url Url to the docs
 * @param description Description of the docs
 * @example
 * ```typespec
 * @externalDocs("https://example.com/detailed.md", "Detailed information on how to use this operation")
 * op listPets(): Pet[];
 * ```
 */
export type ExternalDocsDecorator = (
  context: DecoratorContext,
  target: Type,
  url: string,
  description?: string,
) => void;

/**
 * Specify OpenAPI additional information.
 * The service `title` and `version` are already specified using `@service`.
 *
 * @param additionalInfo Additional information
 */
export type InfoDecorator = (
  context: DecoratorContext,
  target: Namespace,
  additionalInfo: AdditionalInfo,
) => void;

/**
 * Specify OpenAPI additional information.
 *
 * @param name tag name
 * @param tagMetadata Additional information
 * @example
 * ```typespec
 * @service()
 * @tagMetadata("Tag Name", #{description: "Tag description", externalDocs: #{url: "https://example.com", description: "More info.", `x-custom`: "string"}, `x-custom`: "string"})
 * namespace PetStore {}
 * ```
 */
export type TagMetadataDecorator = (
  context: DecoratorContext,
  target: Namespace,
  name: string,
  tagMetadata: TagMetadata,
) => void;

export type TypeSpecOpenAPIDecorators = {
  operationId: OperationIdDecorator;
  extension: ExtensionDecorator;
  defaultResponse: DefaultResponseDecorator;
  externalDocs: ExternalDocsDecorator;
  info: InfoDecorator;
  tagMetadata: TagMetadataDecorator;
};
