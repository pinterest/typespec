import * as py from "@alloy-js/python";
import { isNeverType, type Interface, type Model, type ModelProperty, type Operation, type RekeyableMap } from "@typespec/compiler";
import { useTsp } from "../../../core/context/tsp-context.js";
import { reportDiagnostic } from "../../../lib.js";
import { For, mapJoin, Prose, Show, type Children } from "@alloy-js/core";
import { createRekeyableMap } from "@typespec/compiler/utils";
import { declarationRefkeys, efRefkey } from "../../utils/refkey.js";
import { getHttpPart } from "@typespec/http";
import type { Typekit } from "@typespec/compiler/typekit";
import { TypeExpression } from "../type-expression/type-expression.jsx";


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

  const refkeys = declarationRefkeys(props.refkey, props.type);
  const basesType = props.bases ?? getExtendsType($, props.type);

  return (
    <py.ClassDeclaration
      doc={docElement}
      name={name}
      bases={basesType ? [basesType] : undefined}
      refkey={refkeys}
    >
      {modelTypeMembers}
      {props.children}
    </py.ClassDeclaration>
  );
}

function getExtendsType($: Typekit, type: Model | Interface): Children | undefined {
  if (!$.model.is(type)) {
    return undefined;
  }

  const extending: Children[] = [];

  if (type.baseModel) {
    if ($.array.is(type.baseModel)) {
      extending.push(<TypeExpression type={type.baseModel} />);
    } else if ($.record.is(type.baseModel)) {
      // Here we are in the additional properties land.
      // Instead of extending we need to create an envelope property
      // do nothing here.
    } else {
      extending.push(efRefkey(type.baseModel));
    }
  }

  const indexType = $.model.getIndexType(type);
  if (indexType) {
    // When extending a record we need to override the element type to be unknown to avoid type errors
    if ($.record.is(indexType)) {
      // Here we are in the additional properties land.
      // Instead of extending we need to create an envelope property
      // do nothing here.
    } else {
      extending.push(<TypeExpression type={indexType} />);
    }
  }

  if (extending.length === 0) {
    return undefined;
  }

  return mapJoin(
    () => extending,
    (ext) => ext,
    { joiner: "," },
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
  const namePolicy = py.usePythonNamePolicy();
  const name = namePolicy.getName(props.type.name, "class-member");

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
        name={name}
        omitNone={true}
      />
    );
  }
}
