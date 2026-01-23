import type { Enum } from "@typespec/compiler";
import { GraphQLEnumType } from "graphql";
import { TypeMap, type TSPContext, type TypeKey } from "../type-maps.js";

/**
 * TypeMap for converting TypeSpec Enums to GraphQL EnumTypes.
 *
 * Handles registration of TSP enums and lazy materialization into
 * GraphQLEnumType instances.
 */
export class EnumTypeMap extends TypeMap<Enum, GraphQLEnumType> {
  /**
   * Derives the type key from the mutated enum's name.
   */
  protected getNameFromContext(context: TSPContext<Enum>): TypeKey {
    return context.type.name as TypeKey;
  }

  /**
   * Materializes a TypeSpec Enum into a GraphQL EnumType.
   */
  protected materialize(context: TSPContext<Enum>): GraphQLEnumType {
    const tspEnum = context.type;
    const name = tspEnum.name;

    return new GraphQLEnumType({
      name,
      values: Object.fromEntries(
        Array.from(tspEnum.members.values()).map((member) => [
          member.name,
          { value: member.value ?? member.name },
        ]),
      ),
    });
  }
}
