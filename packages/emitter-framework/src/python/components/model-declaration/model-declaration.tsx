import * as py from "@alloy-js/python";
import { isNeverType, type Model, type ModelProperty, type Operation, type RekeyableMap } from "@typespec/compiler";
import { useTsp } from "../../../core/context/tsp-context.js";
import { reportDiagnostic } from "../../../lib.js";
import { For, Prose, type Children } from "@alloy-js/core";
import { createRekeyableMap } from "@typespec/compiler/utils";
import { getHttpPart } from "@typespec/http";


export interface ModelDeclarationProps extends Omit<py.ClassDeclarationProps, "name"> {
  type: Model;
  name?: string;
}

export function ModelDeclaration(props: ModelDeclarationProps) {
  const { $ } = useTsp();

  const namePolicy = py.usePythonNamePolicy();

  let name = props.name ?? props.type.name;

  if (!name || name === "") {
    reportDiagnostic($.program, { code: "type-declaration-missing-name", target: props.type });
  }

  name = namePolicy.getName(name, "class");
  const doc = props.doc ?? $.type.getDoc(props.type);
  let docElement = null;
  if (doc) {
    docElement = (
      <py.ClassDoc
        description={[
          <Prose>{doc}</Prose>,
        ]}
      />
    );
  }

  let typeMembers: RekeyableMap<string, ModelProperty | Operation> | undefined;
  if ($.model.is(props.type)) {
    typeMembers = $.model.getProperties(props.type);
    const additionalProperties = $.model.getAdditionalPropertiesRecord(props.type);
    if (additionalProperties) {
      typeMembers.set(
        "additionalProperties",
        $.modelProperty.create({
          name: "additionalProperties",
          optional: true,
          type: additionalProperties,
        }),
      );
    }
  } else if ("operations" in props.type) {
    typeMembers = createRekeyableMap((props.type as { operations: Map<string, Operation> }).operations);
  } else {
    typeMembers = createRekeyableMap(new Map());
  }

  // Ensure that we have members to render, otherwise skip rendering the ender property.
  const validTypeMembers = Array.from(typeMembers.values()).filter((member) => {
    if ($.modelProperty.is(member) && isNeverType(member.type)) {
      return false;
    }
    return true;
  });
  let modelTypeMembers = null;
  if (validTypeMembers.length > 0) {
    modelTypeMembers = (
      <For each={validTypeMembers} line>
        {(typeMember) => {
          return <ModelMember type={typeMember} />
        }}
      </For>
    );
  }

  return (
    <py.ClassDeclaration
      doc={docElement}
      name={name}
    >
      {modelTypeMembers}
      {props.children}
    </py.ClassDeclaration>
  );
}

export interface ModelMemberProps {
  type: ModelProperty | Operation;
  doc?: Children;
  optional?: boolean;
}

export function ModelMember(props: ModelMemberProps) {
  const { $ } = useTsp();
  const doc = props.doc ?? $.type.getDoc(props.type);

  if ($.modelProperty.is(props.type)) {
    if (isNeverType(props.type.type)) {
      return null;
    }

    let unpackedType = props.type.type;
    const part = getHttpPart($.program, props.type.type);
    if (part) {
      unpackedType = part.type;
    }

    return (
      <py.VariableDeclaration
        doc={doc}
        name={props.type.name}
        omitNone={true}
      />
    );
  }
}
