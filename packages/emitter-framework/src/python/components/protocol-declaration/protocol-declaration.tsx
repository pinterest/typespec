import { For, code, mapJoin } from "@alloy-js/core";
import * as py from "@alloy-js/python";
import type { Interface, Model, Operation, Type } from "@typespec/compiler";
import type { Typekit } from "@typespec/compiler/typekit";
import { useTsp } from "#core/context/tsp-context.js";
import { typingModule } from "#python/builtins.js";
import { declarationRefkeys } from "#python/utils/refkey.js";
import { TypeExpression } from "#python/components/type-expression/type-expression.jsx";

export interface ProtocolDeclarationProps extends Omit<py.ClassDeclarationProps, "name"> {
  type: Interface | Operation;
  name?: string;
}

export function ProtocolDeclaration(props: ProtocolDeclarationProps) {
  const { $ } = useTsp();

  const refkeys = declarationRefkeys(props.refkey, props.type);
  const protocolBase = typingModule["."]["Protocol"];

  const namePolicy = py.usePythonNamePolicy();
  const originalName = props.name ?? ((props.type as any)?.name ?? "");
  const name = namePolicy.getName(originalName, "class");

  // Interfaces will be converted to Protocols with method stubs for operations
  if (((props.type as any)?.kind === "Interface")) {
    const iface = props.type as Interface;
    const operations = (((iface as any).operations ?? new Map())) as Map<string, any>;
    const methods = mapJoin(
      () => Array.from(operations.values()) as any[],
      (op: any) => {
        const methodName = namePolicy.getName(op.name, "function");
        // TODO: This code is commented out because it generates the most accurate code, with the ellipsis at
        // the end of the method. The current Alloy implementation just renders whatever content in the next line.
        // We should decide to either make Functions (or just Methods) to support this, probably through some new 
        // parameter ("unimplemented" or something), which would render the ellipsis in the same line as the
        // function signature; or use this more "manual" approach that's commented out below.
        // const prm = buildCallableParameters($, op as Operation, { includeSelf: true });
        // const prmList = mapJoin(
        //   () => prm,
        //   (p) => (
        //     <>
        //       {p.name}
        //       {p.type ? <>: {p.type}</> : <></>}
        //     </>
        //   ),
        //   { joiner: ", " },
        // );
        const prm = buildCallableParameters($, op as Operation); // self injected by MethodDeclaration
        const ret = (op as any)?.returnType
          ? (<TypeExpression type={(op as Operation).returnType as Type} />)
          : typingModule["."]["Any"];
        //   return code`def ${methodName}(${prmList}) -> ${ret}: ...`;
        // },
        // { joiner: <>{"\n\n"}</> },
        return (
          <py.MethodDeclaration name={methodName} parameters={prm} returnType={ret}>
            ...
          </py.MethodDeclaration>
        );
      }
    );
    return (
      <py.ClassDeclaration name={name} bases={[protocolBase]} refkey={refkeys} doc={props.doc}>
        {methods}
      </py.ClassDeclaration>
    );
  }

  // Operations will be converted to Callback protocol using a dunder __call__ method
  const op = props.type as Operation;
  // TODO: This code is commented out because it generates the most accurate code, with the ellipsis at
  // the end of the method. The current Alloy implementation just renders whatever content in the next line.
  // We should decide to either make Functions (or just Methods) to support this, probably through some new 
  // parameter ("unimplemented" or something), which would render the ellipsis in the same line as the
  // function signature; or use this more "manual" approach that's commented out below.
  
  // const cbParams = buildCallableParameters($, op, { includeSelf: true });
  // const cbParamsList = mapJoin(
  //   () => cbParams,
  //   (prm) => (
  //     <>
  //       {prm.name}
  //       {prm.type ? <>: {prm.type}</> : <></>}
  //     </>
  //   ),
  //   { joiner: ", " },
  // );
  const cbParams = buildCallableParameters($, op);
  const cbReturn = (op as any)?.returnType
    ? (<TypeExpression type={op.returnType as Type} />)
    : typingModule["."]["Any"];
  return (
    <py.ClassDeclaration name={name} bases={[protocolBase]} refkey={refkeys} doc={props.doc}>
      {/* {code`def __call__(${cbParamsList}) -> ${cbReturn}: ...`} */} 
      <py.DunderMethodDeclaration name="__call__" returnType={cbReturn} parameters={cbParams}>
        ...
      </py.DunderMethodDeclaration>
    </py.ClassDeclaration>
  );
}

function buildCallableParameters(
  $: Typekit,
  op: Operation,
  options: { includeSelf?: boolean } = {},
) {
  const paramsModel = op.parameters as unknown as Model | undefined;
  const items: any[] = [];
  if (options.includeSelf) {
    items.push({ name: "self" });
  }
  if (paramsModel) {
    try {
      const props = $.model.getProperties(paramsModel);
      for (const p of props.values()) {
        items.push({
          name: p.name,
          type: <TypeExpression type={p.type} />,
          optional: p.optional,
        });
      }
    } catch {
      // fallthrough, no params
    }
  }
  return items as py.ParameterDescriptor[];
}


