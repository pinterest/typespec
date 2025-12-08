import { sanitizeNameForGraphQL } from "../../lib/type-utils.js";

/**
 * Transform function that renames a type to comply with GraphQL naming rules.
 * @param type - A type with a `name` property to be renamed
 */
export function renameForGraphQL(type: { name: string }): void {
  type.name = sanitizeNameForGraphQL(type.name);
}

