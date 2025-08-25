import { code, For, mapJoin, Prose, Show, type Children } from "@alloy-js/core";
import * as py from "@alloy-js/python";
import {
  isNeverType,
  type Interface,
  type Model,
  type ModelProperty,
  type Operation,
  type RekeyableMap,
} from "@typespec/compiler";
import type { Typekit } from "@typespec/compiler/typekit";
import { createRekeyableMap } from "@typespec/compiler/utils";
import { getHttpPart } from "@typespec/http";
import { useTsp } from "../../../core/context/tsp-context.js";
import { reportDiagnostic } from "../../../lib.js";
import { dataclassesModule, typingExtensionsModule } from "../../builtins.js";
import { declarationRefkeys, efRefkey } from "../../utils/refkey.js";
import { Atom } from "../atom/atom.jsx";
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
    docElement = <py.ClassDoc description={[<Prose>{doc}</Prose>]} />;
  }

  let typeMembers: RekeyableMap<string, ModelProperty | Operation> | undefined;
  if ($.model.is(props.type)) {
    typeMembers = $.model.getProperties(props.type);
    const additionalProperties = $.model.getAdditionalPropertiesRecord(props.type);
    const indexType = $.model.getIndexType(props.type);
    const isNotRecord = !indexType || (indexType && !$.record.is(indexType));
    const doesntExtendsRecord = props.type.baseModel && !$.record.is(props.type.baseModel);
    if (additionalProperties && doesntExtendsRecord && isNotRecord) {
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
    typeMembers = createRekeyableMap(
      (props.type as { operations: Map<string, Operation> }).operations,
    );
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
  // See how to check for field optionality
  if (validTypeMembers.length > 0) {
    modelTypeMembers = (
      <For each={validTypeMembers} line>
        {(typeMember) => {
          return <ModelMember type={typeMember} />;
        }}
      </For>
    );
  }

  const refkeys = declarationRefkeys(props.refkey, props.type);
  const basesType = props.bases ?? getExtendsType($, props.type);
  // Assign dataclass if TypedDict isn't one of the basesType
  let dataclass: any = null;

  const basesTypeStr = basesType?.toString() ?? "";
  const hasTypedDict = basesTypeStr.includes("TypedDict");
  if ($.model.is(props.type) && !hasTypedDict) {
    dataclass = dataclassesModule["."]["dataclass"];
  }

  return (
    <>
      <Show when={dataclass}>@{dataclass}</Show>
      <hbr />
      <py.ClassDeclaration
        doc={docElement}
        name={name}
        bases={basesType ? [basesType] : undefined}
        refkey={refkeys}
      >
        {modelTypeMembers}
        {props.children}
      </py.ClassDeclaration>
    </>
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
      // Ex. model Person extends Record<string>
      extending.push(typingExtensionsModule["."]["TypedDict"]);
      extending.push(code`extra_items=str`);
    } else {
      extending.push(efRefkey(type.baseModel));
    }
  }

  const indexType = $.model.getIndexType(type);
  if (indexType) {
    // Ex.: model Person is Record<string>
    if ($.record.is(indexType)) {
      extending.push(typingExtensionsModule["."]["TypedDict"]);
      extending.push(code`extra_items=str`);
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
    { joiner: ", " },
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
    let elements = [];
    if (unpackedType.kind === "Union") {
      elements = (unpackedType as any).options.map((opt: any) => {
        console.log(opt.name, opt.kind);
        return <TypeExpression type={opt} noReference />;
      });
    } else if (unpackedType.kind === "Scalar") {
      elements = [<TypeExpression type={unpackedType} noReference />];
    }
    const unionType = <py.UnionTypeExpression>{elements}</py.UnionTypeExpression>;
    let otherProps = {};
    if (props.optional || props.type.optional) {
      // Optional field with no default value, use a default_factory to object
      // as we can't represent a non-required field in Python's dataclasses
      let fieldValue = code`default_factory=object`;
      if (props.type.defaultValue) {
        // Optional field with default value, default to value
        fieldValue = code`default=${(<Atom value={props.type.defaultValue} />)}`;
      }
      // If one of the union types is null, set default to None
      if (
        unpackedType.kind === "Union" &&
        Array.isArray((unpackedType as any).options) &&
        (unpackedType as any).options.some(
          (opt: any) => opt && opt.kind === "Intrinsic" && opt.name === "null",
        )
      ) {
        fieldValue = code`default=None`;
      }
      otherProps = {
        initializer: code`${dataclassesModule["."]["field"]}(${fieldValue})`,
      };
    }

    return (
      <py.VariableDeclaration
        doc={doc}
        name={name}
        type={unionType}
        omitNone={true}
        {...otherProps}
      />
    );
  }
}
