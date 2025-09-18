import { code, For, mapJoin, Prose, Show, type Children } from "@alloy-js/core";
import * as py from "@alloy-js/python";
import {
  isNeverType,
  type BooleanValue,
  type Interface,
  type Model,
  type ModelProperty,
  type NumericValue,
  type Operation,
  type RekeyableMap,
  type StringValue,
} from "@typespec/compiler";
import type { Typekit } from "@typespec/compiler/typekit";
import { createRekeyableMap } from "@typespec/compiler/utils";
import { getHttpPart } from "@typespec/http";
import { useTsp } from "../../../core/context/tsp-context.js";
import { reportDiagnostic } from "../../../lib.js";
import { dataclassesModule, typingExtensionsModule, typingModule } from "../../builtins.js";
import { declarationRefkeys, efRefkey } from "../../utils/refkey.js";
import { Atom } from "../atom/atom.jsx";
import { TypeExpression } from "../type-expression/type-expression.jsx";

export interface InterfaceDeclarationProps extends Omit<py.ClassDeclarationProps, "name"> {
  type: Model | Interface;
  name?: string;
}

export function InterfaceDeclaration(props: InterfaceDeclarationProps) {
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
    // Model
    typeMembers = $.model.getProperties(props.type);
  } else {
    // Interface
    typeMembers = createRekeyableMap(
      (props.type as { operations: Map<string, Operation> }).operations,
    );
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
          return <InterfaceMember type={typeMember} />;
        }}
      </For>
    );
  }

  const refkeys = declarationRefkeys(props.refkey, props.type);
  const basesType = props.bases ?? getExtendsType($, props.type);
  // Assign dataclass if TypedDict isn't one of the basesType
  let dataclass: any = null;
  if ($.model.is(props.type)) {
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

export interface InterfaceMemberProps {
  type: ModelProperty | Operation;
  doc?: Children;
  optional?: boolean;
}

export function InterfaceMember(props: InterfaceMemberProps) {
  const { $ } = useTsp();
  const doc = props.doc ?? $.type.getDoc(props.type);
  const namePolicy = py.usePythonNamePolicy();
  const name = namePolicy.getName(props.type.name, "class-member");

  if ($.modelProperty.is(props.type)) {
    if (isNeverType(props.type.type)) {
      return null;
    }

    let unpackedType = props.type.type;
    let unionType = undefined;
    let otherProps = {};

    const part = getHttpPart($.program, props.type.type);
    if (part) {
      unpackedType = part.type;
    }
    let elements = [];
    if (unpackedType.kind === "Union") {
      elements = (unpackedType as any).options.map((opt: any) => {
        return <TypeExpression type={opt} noReference />;
      });
    } else if ($.literal.is(unpackedType)) {
      const typingElements = <TypeExpression type={unpackedType} noReference />;
      elements = [code`${typingModule["."]["Literal"]}[${typingElements}]`];
    } else {
      elements = [<TypeExpression type={unpackedType} noReference />];
    }
    unionType = <py.UnionTypeExpression>{elements}</py.UnionTypeExpression>;

    if ($.literal.is(unpackedType)) {
      let value: StringValue | NumericValue | BooleanValue;
      if (typeof unpackedType.value === "string") {
        value = $.value.createString(unpackedType.value);
      } else if (typeof unpackedType.value === "number") {
        value = $.value.createNumeric(unpackedType.value);
      } else {
        value = $.value.createBoolean(unpackedType.value);
      }
      otherProps = {
        initializer: code`${(<Atom value={value} />)}`,
      };
    } else {
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
