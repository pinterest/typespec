import { type Children, createContext, List, splitProps, useContext } from "@alloy-js/core";
import * as py from "@alloy-js/python";
import type { Operation } from "@typespec/compiler";
import type { Typekit } from "@typespec/compiler/typekit";
import { useTsp } from "../../../core/index.js";
import { buildParameterDescriptors, getReturnType } from "../../utils/operation.js";
import { TypeExpression } from "../type-expression/type-expression.jsx";

export const MethodContext = createContext<"method" | "static" | "class" | undefined>(
  undefined,
);
export const MethodProvider = MethodContext.Provider;

export interface MethodPropsWithType extends Omit<py.MethodDeclarationBaseProps, "name"> {
  type: Operation;
  name?: string;
  doc?: Children;
  parametersMode?: "prepend" | "append" | "replace";
  methodType?: "method" | "class" | "static";
  abstract?: boolean;
}

export type MethodProps = MethodPropsWithType | py.MethodDeclarationBaseProps;

function createDocElement($: Typekit, props: MethodProps) {
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
        <py.MethodDoc
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
 * Get the method component based on the resolved method type.
 * We prioritize the methodType prop provided in the Method component,
 * and then the one provided in the context, and then we default to "method".
 */
function getResolvedMethodType(props: MethodProps): "method" | "class" | "static" {
  const ctxMethodType = useContext(MethodContext);
  const propMethodType = "methodType" in props ? (props as any).methodType : undefined;
  return (propMethodType ?? ctxMethodType ?? "method") as "method" | "class" | "static";
}

/**
 * A Python interface method. Pass the `type` prop to create the
 * method by converting from a TypeSpec Operation. Any other props
 * provided will take precedence.
 */
export function Method(props: Readonly<MethodProps>) {
  const { $ } = useTsp();
  const isTypeSpecTyped = "type" in props;
  const docElement = createDocElement($, props);
  const resolvedMethodType = getResolvedMethodType(props);
  const MethodComponent =
    resolvedMethodType === "static"
      ? py.StaticMethodDeclaration
      : resolvedMethodType === "class"
        ? py.ClassMethodDeclaration
        : py.MethodDeclaration;

  // Default to abstract when deriving from a TypeSpec operation (`type` prop present),
  // unless explicitly overridden by props.abstract === false
  const abstractFlag = (() => {
    const explicit = (props as any).abstract as boolean | undefined;
    if (explicit !== undefined) return explicit;
    return !isTypeSpecTyped ? false : undefined;
  })();

  /**
   * If the method does not come from the Typespec class declaration, return a standard Python method declaration.
   * Have in mind that, with that, we lose some of the TypeSpec class declaration overrides.
   */
  if (!isTypeSpecTyped) {
    return <MethodComponent {...props} doc={docElement} abstract={abstractFlag} />;
  }

  const [efProps, updateProps, forwardProps] = splitProps(
    props,
    ["type"],
    ["returnType", "parameters"],
  );

  const name = props.name ?? py.usePythonNamePolicy().getName(efProps.type.name, "function");
  const returnType = props.returnType ?? <TypeExpression type={getReturnType(efProps.type)} />;
  const allParameters = buildParameterDescriptors(efProps.type.parameters, {
    params: props.parameters,
    mode: props.parametersMode,
  });

  return (
    <>
      <MethodComponent
        {...forwardProps}
        {...updateProps}
        name={name}
        returnType={returnType}
        parameters={allParameters}
        doc={docElement}
        abstract={abstractFlag}
      />
    </>
  );
}
