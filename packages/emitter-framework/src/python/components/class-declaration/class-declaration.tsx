import { abcModule, dataclassesModule } from "#python/builtins.js";
import { type Children, For, List, mapJoin, Show } from "@alloy-js/core";
import * as py from "@alloy-js/python";
import { type Interface, type Model, type ModelProperty, type Operation } from "@typespec/compiler";
import type { Typekit } from "@typespec/compiler/typekit";
import { createRekeyableMap } from "@typespec/compiler/utils";
import { useTsp } from "../../../core/context/tsp-context.js";
import { reportDiagnostic } from "../../../lib.js";
import { declarationRefkeys, efRefkey } from "../../utils/refkey.js";
import { TypeExpression } from "../type-expression/type-expression.jsx";
import { ClassMember } from "./class-member.jsx";
import { MethodProvider } from "./class-method.jsx";

export interface ClassDeclarationPropsWithType extends Omit<py.ClassDeclarationProps, "name"> {
  type: Model | Interface;
  name?: string;
  abstract?: boolean; // Global override for the abstract flag
  methodType?: "method" | "class" | "static"; // Global override for the method type
}

export type ClassDeclarationProps = ClassDeclarationPropsWithType | py.ClassDeclarationProps;

function isTypedClassDeclarationProps(
  props: ClassDeclarationProps,
): props is ClassDeclarationPropsWithType {
  return "type" in props;
}

// (removed getValidTypeMembers; inline logic where needed)

/**
 * Creates the doc element for the class declaration, either from the props or from the type.
 * Covers the cases where the doc is provided as an array, a string, or a JSX element.
 * @param props - The props for the class declaration.
 * @returns The doc element for the class declaration.
 */
function createDocElement($: Typekit, props: ClassDeclarationProps) {
  let docElement = undefined;
  const docSource = props.doc ?? ("type" in props && $.type.getDoc(props.type)) ?? undefined;
  if (docSource) {
    // Doc provided as an array (paragraphs/nodes). Forward as description to preserve structure.
    if (Array.isArray(docSource)) {
      docElement = <py.ClassDoc description={docSource as Children[]} />;
    }
    // Doc provided as a string. Preserve line breaks by rendering each line on its own.
    else if (typeof docSource === "string") {
      const lines = docSource.split(/\r?\n/);
      docElement = (
        <py.ClassDoc
          description={[
            <List hardline>
              {lines.map((line) => (
                <>{line}</>
              ))}
            </List>,
          ]}
        />
      );
    }
    // Doc provided as JSX (e.g., a prebuilt <py.ClassDoc />). Pass through unchanged.
    else {
      docElement = docSource as any;
    }
  }
  return docElement;
}

/**
 * Creates the class body for the class declaration.
 * Determines if the class body should render any members/children.
 * If it does, returns a ClassBody; otherwise, returns undefined, which will render a "pass";
 * as the class body.
 * @param $ - The Typekit.
 * @param props - The props for the class declaration.
 * @returns The class body for the class declaration, either a ClassBody or undefined.
 */
function createClassBody($: Typekit, props: ClassDeclarationProps, abstract: boolean) {
  const validTypeMembers = isTypedClassDeclarationProps(props)
    ? (() => {
        if ($.model.is(props.type)) {
          return Array.from($.model.getProperties(props.type).values());
        } else {
          const ops = (props.type as { operations: Map<string, Operation> }).operations;
          return Array.from(createRekeyableMap(ops).values());
        }
      })()
    : [];
  const hasValidMember = validTypeMembers.length > 0;
  const hasChildren = Array.isArray(props.children)
    ? (props.children as any[]).length > 0
    : props.children != null;

  if (!(hasValidMember || hasChildren)) return undefined as any;

  if (isTypedClassDeclarationProps(props)) {
    return <ClassBody {...props} validTypeMembers={validTypeMembers} abstract={abstract} />;
  }

  // Fallback for non-typed props (shouldn't be called in practice due to early return in ClassDeclaration)
  return (<>{props.children}</>) as any;
}

/**
 * Creates the extends types for the class declaration.
 * @param $ - The Typekit.
 * @param type - The type to create the extends type for.
 * @returns The extends types for the class declaration.
 */
function getExtendsType($: Typekit, type: Model | Interface): Children | undefined {
  if (!$.model.is(type)) {
    return undefined;
  }

  const extending: Children[] = [];

  if (type.baseModel) {
    if ($.array.is(type.baseModel)) {
      extending.push(<TypeExpression type={type.baseModel} />);
    } else if ($.record.is(type.baseModel)) {
      // Record-based scenarios are not supported
      // do nothing here.
    } else {
      extending.push(efRefkey(type.baseModel));
    }
  }

  const indexType = $.model.getIndexType(type);
  if (indexType) {
    if ($.record.is(indexType)) {
      // Record-based scenarios are not supported
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

/**
 * Creates the bases type for the class declaration.
 * @param $ - The Typekit.
 * @param props - The props for the class declaration.
 * @param abstract - Whether the class is abstract.
 * @returns The bases type for the class declaration.
 */
function createBasesType($: Typekit, props: ClassDeclarationProps, abstract: boolean) {
  const globalBasesType = isTypedClassDeclarationProps(props)
    ? getExtendsType($, props.type)
    : undefined;
  let basesType = props.bases ? props.bases : (globalBasesType ?? undefined);
  if (!abstract) return basesType;

  const abcBase = abcModule["."]["ABC"];
  if (Array.isArray(basesType)) return [abcBase, ...basesType];
  if (basesType != null) return [abcBase, basesType];
  return [abcBase];
}

/**
 * Creates the class declaration for the class.
 * @param props - The props for the class declaration.
 * @returns The class declaration.
 */
export function ClassDeclaration(props: ClassDeclarationProps) {
  const { $ } = useTsp();

  // If we are explicitly overriding the class as abstract or the type is not a model, we need to create an abstract class
  let abstract =
    ("abstract" in props && props.abstract) || ("type" in props && !$.model.is(props.type));
  let docElement = createDocElement($, props);
  let basesType = createBasesType($, props, abstract);

  if (!isTypedClassDeclarationProps(props)) {
    return (
      <py.ClassDeclaration
        {...props}
        doc={docElement}
        {...(basesType !== undefined ? { bases: basesType as Children[] } : {})}
      />
    );
  }

  const namePolicy = py.usePythonNamePolicy();

  let name = props.name ?? props.type.name;
  if (!name || name === "") {
    reportDiagnostic($.program, { code: "type-declaration-missing-name", target: props.type });
  }
  name = namePolicy.getName(name, "class");

  const refkeys = declarationRefkeys(props.refkey, props.type);
  let dataclass: any = null;
  if (!abstract) {
    // Array-based models should be rendered as normal classes, not dataclasses (e.g., model Foo is Array<T>)
    const isArrayModel = $.model.is(props.type) && $.array.is(props.type);
    if (!isArrayModel) {
      dataclass = dataclassesModule["."]["dataclass"];
    }
  }
  const classBody = createClassBody($, props, abstract);

  // Throw error for models with additional properties (Record-based scenarios)
  if ($.model.is(props.type)) {
    const additionalPropsRecord = $.model.getAdditionalPropertiesRecord(props.type);
    if (additionalPropsRecord) {
      throw new Error("Models with additional properties (Record[…]) are not supported");
    }
  }

  return (
    <>
      <Show when={dataclass}>
        @{dataclass}
        <hbr />
      </Show>
      <Show when={abstract}>
        <hbr />
      </Show>
      <MethodProvider value={props.methodType}>
        <py.ClassDeclaration
          doc={docElement}
          name={name}
          {...(basesType !== undefined ? { bases: basesType as Children[] } : {})}
          refkey={refkeys}
        >
          {classBody}
        </py.ClassDeclaration>
      </MethodProvider>
    </>
  );
}

interface ClassBodyProps extends ClassDeclarationPropsWithType {
  abstract?: boolean; // Global override for the abstract flag
  methodType?: "method" | "class" | "static"; // Global override for the method type
}

/**
 * Renders the members of an interface from its properties, including any additional children.
 */
function ClassBody(
  props: ClassBodyProps & { validTypeMembers?: (ModelProperty | Operation)[] },
): Children {
  const { $ } = useTsp();
  const validTypeMembers =
    props.validTypeMembers ??
    (() => {
      if ($.model.is(props.type)) {
        return Array.from($.model.getProperties(props.type).values());
      } else {
        const ops = (props.type as { operations: Map<string, Operation> }).operations;
        return Array.from(createRekeyableMap(ops).values());
      }
    })();

  // Throw error for models with additional properties (Record-based scenarios)
  if ($.model.is(props.type)) {
    const additionalPropsRecord = $.model.getAdditionalPropertiesRecord(props.type);
    if (additionalPropsRecord) {
      throw new Error("Models with additional properties (Record[…]) are not supported");
    }
  }

  const hasChildren = Array.isArray(props.children)
    ? (props.children as any[]).length > 0
    : props.children != null;
  const hasBody = validTypeMembers.length > 0 || hasChildren;
  if (!hasBody) return undefined as any;

  return (
    <>
      <Show when={validTypeMembers.length > 0}>
        <For each={validTypeMembers} line>
          {(typeMember) => {
            return (
              <ClassMember
                type={typeMember}
                abstract={props.abstract}
                methodType={props.methodType}
              />
            );
          }}
        </For>
      </Show>
      {props.children}
    </>
  );
}
