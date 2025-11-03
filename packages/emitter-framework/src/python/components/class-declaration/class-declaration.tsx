import { abcModule, typingModule } from "#python/builtins.js";
import { type Children, code, For, List, mapJoin, Show } from "@alloy-js/core";
import * as py from "@alloy-js/python";
import { type Interface, type Model, type ModelProperty, type Operation } from "@typespec/compiler";
import type { TemplateDeclarationNode } from "@typespec/compiler/ast";
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
          // For models, extract properties to render as dataclass fields
          return Array.from($.model.getProperties(props.type).values());
        } else {
          // For interfaces, extract operations to render as abstract methods
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
 * @returns The extends types for the class declaration, or undefined for interfaces.
 */
function getExtendsType($: Typekit, type: Model | Interface): Children | undefined {
  // For interfaces, return undefined because inheritance is flattened by TypeSpec
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
      // Use py.Reference to wrap the refkey for proper resolution
      extending.push(<py.Reference refkey={efRefkey(type.baseModel)} />);
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
function createBasesType(
  $: Typekit,
  props: ClassDeclarationProps,
  abstract: boolean,
  extraBases: Children[] = [],
) {
  if (isTypedClassDeclarationProps(props)) {
    const extend = getExtendsType($, props.type);
    if (extend) {
      extraBases.push(extend);
    }
  }
  const allBases = (props.bases ? props.bases : []).concat(extraBases);
  const basesType = allBases.length > 0 ? allBases : undefined;
  if (!abstract) return basesType;

  const abcBase = abcModule["."]["ABC"];
  if (Array.isArray(basesType)) return [...basesType, abcBase];
  if (basesType != null) return [basesType, abcBase];
  return [abcBase];
}

/**
 * Builds TypeVar declarations and the Generic[...] base for templated types,
 * in case the type is a model with template parameters.
 */
function buildTypeVarsAndGenericBase(
  $: Typekit,
  type: Model | Interface,
): { typeVars: Children | null; genericBase?: Children } {
  if (!("isFinished" in type)) {
    return { typeVars: null };
  }
  const templateParameters = (type.node as TemplateDeclarationNode)?.templateParameters;
  if (type.isFinished || !templateParameters) {
    return { typeVars: null };
  }

  const typeVars = (
    <>
      <For each={templateParameters} hardline>
        {(node) => {
          const typeVar = (
            <py.FunctionCallExpression
              target={typingModule["."].TypeVar}
              args={[<py.Atom jsValue={node.id.sv} />]}
            />
          );
          return <py.VariableDeclaration name={node.id.sv} initializer={typeVar} />;
        }}
      </For>
    </>
  );

  const typeArgs: Children[] = [];
  for (const templateParameter of templateParameters) {
    typeArgs.push(code`${templateParameter.id.sv}`);
  }
  const genericBase =
    typeArgs.length > 0 ? (
      <py.TypeReference refkey={typingModule["."].Generic} typeArgs={typeArgs} />
    ) : undefined;

  return { typeVars, genericBase };
}

/**
 * Converts TypeSpec Models and Interfaces to Python classes.
 *
 * - **Models** are converted into Dataclasses with `@dataclass(kw_only=True)` + fields
 * - **Interfaces** are converted into Abstract classes (ABC) with abstract methods
 * - For models that extends another model, we convert that into Python class inheritance
 * - For interfaces that extends another interface, there's no inheritance, since
 *   TypeSpec flattens the inheritance
 *
 * @param props - The props for the class declaration.
 * @returns The class declaration.
 */
export function ClassDeclaration(props: ClassDeclarationProps) {
  const { $ } = useTsp();

  // Interfaces are rendered as abstract classes (ABC) with abstract methods
  // Models are rendered as concrete dataclasses with fields
  // If we are explicitly overriding the class as abstract or the type is not a model, we need to create an abstract class
  const abstract =
    ("abstract" in props && props.abstract) || ("type" in props && !$.model.is(props.type));
  const docElement = createDocElement($, props);

  const extraBases = [];
  let typeVars = null;
  if (isTypedClassDeclarationProps(props)) {
    const generic = buildTypeVarsAndGenericBase($, props.type);
    typeVars = generic.typeVars;
    if (generic.genericBase) {
      extraBases.push(generic.genericBase);
    }
  }

  const basesType = createBasesType($, props, abstract, extraBases);

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
  // Array-based models should be rendered as normal classes, not dataclasses (e.g., model Foo is Array<T>)
  const isArrayModel = $.model.is(props.type) && $.array.is(props.type);
  const useDataclass = !isArrayModel;
  const classBody = createClassBody($, props, abstract);

  // Throw error for models with additional properties (Record-based scenarios)
  if ($.model.is(props.type)) {
    const additionalPropsRecord = $.model.getAdditionalPropertiesRecord(props.type);
    if (additionalPropsRecord) {
      throw new Error("Models with additional properties (Record[…]) are not supported");
    }
  }

  const ClassComponent = useDataclass ? py.DataclassDeclaration : py.ClassDeclaration;

  return (
    <>
      <Show when={!!typeVars}>
        {typeVars}
        <hbr />
        <line />
      </Show>
      <MethodProvider value={props.methodType}>
        <ClassComponent
          doc={docElement}
          name={name}
          {...(basesType !== undefined ? { bases: basesType as Children[] } : {})}
          refkey={refkeys}
          {...(useDataclass ? { kwOnly: true } : {})}
        >
          {classBody}
        </ClassComponent>
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
      // Python dataclasses don't support dynamic properties, so an additionalProperties
      // field would just be another fixed field, not a "catch-all" for arbitrary properties.
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
