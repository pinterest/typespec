import { type Enum, getDoc, getDeprecationDetails } from "@typespec/compiler";
import * as gql from "@alloy-js/graphql";
import { useTsp } from "@typespec/emitter-framework";

export interface EnumTypeProps {
  /** The enum type to render */
  type: Enum;
}

/**
 * Renders a GraphQL enum type declaration with members
 */
export function EnumType(props: EnumTypeProps) {
  const { program } = useTsp();
  const doc = getDoc(program, props.type);
  const members = Array.from(props.type.members.values());

  return (
    <gql.EnumType name={props.type.name} description={doc}>
      {members.map((member) => {
        const memberDoc = getDoc(program, member);
        const deprecation = getDeprecationDetails(program, member);

        return (
          <gql.EnumValue
            name={member.name}
            description={memberDoc}
            deprecated={deprecation ? deprecation.message : undefined}
          />
        );
      })}
    </gql.EnumType>
  );
}
