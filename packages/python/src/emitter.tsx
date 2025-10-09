import { For, SourceDirectory } from "@alloy-js/core";
import * as py from "@alloy-js/python";
import { EmitContext } from "@typespec/compiler";
import { $ } from "@typespec/compiler/typekit";
import { Output, writeOutput } from "@typespec/emitter-framework";
import * as ef from "@typespec/emitter-framework/python";

/**
 * Main function to handle the emission process.
 * @param context - The context for the emission process.
 */
export async function $onEmit(context: EmitContext) {
  const tk = $(context.program);
  const globalNs = tk.program.getGlobalNamespaceType();

  const output = (
    <Output
      program={context.program}
      externals={[ef.abcModule, ef.dataclassesModule, ef.typingModule, py.enumModule]}
    >
      <SourceDirectory path="src">
        <For each={globalNs.namespaces}>
          {(name, type) => {
            return (
              <py.SourceFile path={`${name.toLowerCase()}.py`}>
                <For each={type.enums}>
                  {(name, type) => {
                    return <ef.EnumDeclaration type={type} />;
                  }}
                </For>
                <For each={type.models}>
                  {(name, type) => {
                    return <ef.ClassDeclaration type={type} abstract={!type.isFinished} />;
                  }}
                </For>
              </py.SourceFile>
            );
          }}
        </For>
      </SourceDirectory>
    </Output>
  );

  await writeOutput(context.program, output, context.emitterOutputDir);
}
