import { SourceFile } from "@alloy-js/typescript";
import type { Namespace } from "@typespec/compiler";
import { describe, expect, it } from "vitest";
import { Output } from "../../../core/components/output.jsx";
import { getProgram } from "../../test-host.js";
import { ModelDeclaration } from "../../index.jsx";
import { getOutput } from "../../test-utils.js";
import { For, List } from "@alloy-js/core";

describe("Python Model Declaration", () => {
  it("declares an interface with multi line docs, explicit docs passed", async () => {
    const program = await getProgram(`
        namespace DemoService;

        /**
         * This is a test
         * with multiple lines
         */
        model Foo {
          KnownProp: string;
        }
        `);

    const [namespace] = program.resolveTypeReference("DemoService");
    const models = Array.from((namespace as Namespace).models.values());

    expect(getOutput(program, [
      <List hardline>
        {models.map((model) => (
          <ModelDeclaration
            type={model}
          />
        ))}
      </List>
    ])).toRenderTo(`
          class Foo:
            """
            This is a test with multiple lines
            """
            known_prop
          
      `,
    );
  });
  it("declares an interface with multi line docs, docs overridden", async () => {
    const program = await getProgram(`
        namespace DemoService;

        /**
         * This is a test
         * with multiple lines
         */
        model Foo {
          KnownProp: string;
        }
        `);

    const [namespace] = program.resolveTypeReference("DemoService");
    const models = Array.from((namespace as Namespace).models.values());

    expect(getOutput(program, [
      <List hardline>
        {models.map((model) => (
          <ModelDeclaration
            type={model}
            doc={["This is an overridden doc comment\nwith multiple lines"]}
          />
        ))}
      </List>
    ])).toRenderTo(`
      class Foo:
        """
        This is an overridden doc comment with multiple lines
        """
        known_prop
      
      `,
    );
  });
  it("declares a model with @doc", async () => {
    const program = await getProgram(`
        namespace DemoService;

        @doc("This is a test")
        model Foo {
          knownProp: string;
        }
        `);

    const [namespace] = program.resolveTypeReference("DemoService");
    const models = Array.from((namespace as Namespace).models.values());

    expect(getOutput(program, [
      <List hardline>
        {models.map((model) => (
          <ModelDeclaration type={model} />
        ))}
      </List>
    ])).toRenderTo(`
      class Foo:
        """
        This is a test
        """
        known_prop
      
      `,
    );
  });
  it("declares a model with a property that has doc", async () => {
    const program = await getProgram(`
        namespace DemoService;

        /**
         * This is a test
         */
        model Foo {
          @doc("This is a known property")
          knownProp: string;
        }
        `);

    const [namespace] = program.resolveTypeReference("DemoService");
    const models = Array.from((namespace as Namespace).models.values());

    expect(getOutput(program, [
      <List hardline>
        {models.map((model) => (
              <ModelDeclaration type={model} />
        ))}
      </List>
    ])).toRenderTo(`
      class Foo:
        """
        This is a test
        """
        # This is a known property
        known_prop
      
      `,
    );
  });
  it("creates a model that extends a model for Record spread", async () => {
    const program = await getProgram(`
      namespace DemoService;

      model DifferentSpreadModelRecord {
        knownProp: string;
        ...Record<unknown>;
      }
      `);

    const [namespace] = program.resolveTypeReference("DemoService");
    const models = Array.from((namespace as Namespace).models.values());

    expect(getOutput(program, [
      <List hardline>
        {models.map((model) => (
              <ModelDeclaration type={model} />
        ))}
      </List>
    ])).toRenderTo(`
      class DifferentSpreadModelRecord:
        known_prop
        additional_properties
      
      `);
  });
  it("creates a model for a model that 'is' an array", async () => {
    const program = await getProgram(`
      namespace DemoService;

      model Foo is Array<string>;
      `);

    const [namespace] = program.resolveTypeReference("DemoService");
    const models = (namespace as Namespace).models;

    expect(getOutput(program, [
      <For each={Array.from(models.values())} hardline>
        {(model) => <ModelDeclaration type={model} />}
      </For>
    ])).toRenderTo(`
      class Foo(list[str]):
        pass

      `);
  });
  it("creates a model for a model that 'is' a record ", async () => {
    const program = await getProgram(`
      namespace DemoService;

      model Foo is Record<string>;
      `);

    const [namespace] = program.resolveTypeReference("DemoService");
    const models = (namespace as Namespace).models;

    expect(getOutput(program, [
      <For each={Array.from(models.values())} hardline>
        {(model) => <ModelDeclaration type={model} />}
      </For>
    ])).toRenderTo(`
      class Foo:
        additional_properties
      
      `);
  });
  it("creates a model of a model that spreads a Record", async () => {
    const program = await getProgram(`
      namespace DemoService;

      model Foo {
        ...Record<string>
      }
      `);

    const [namespace] = program.resolveTypeReference("DemoService");
    const models = (namespace as Namespace).models;

    expect(getOutput(program, [
      <For each={Array.from(models.values())} hardline>
        {(model) => <ModelDeclaration type={model} />}
      </For>
    ])).toRenderTo(`
      class Foo:
        additional_properties
      
      `);
  });
  it("creates a model that extends a spread model", async () => {
    const program = await getProgram(`
      namespace DemoService;

      model ModelForRecord {
        state: string;
      }

      model DifferentSpreadModelRecord {
        knownProp: string;
        ...Record<ModelForRecord>;
      }

      model DifferentSpreadModelDerived extends DifferentSpreadModelRecord {
        derivedProp: ModelForRecord;
      }
      `);

    const [namespace] = program.resolveTypeReference("DemoService");
    const models = (namespace as Namespace).models;

    expect(getOutput(program, [
      <For each={Array.from(models.values())} hardline>
        {(model) => <ModelDeclaration type={model} />}
      </For>
    ])).toRenderTo(`
      class ModelForRecord:
        state

      class DifferentSpreadModelRecord:
        known_prop
        additional_properties

      class DifferentSpreadModelDerived(DifferentSpreadModelRecord):
        derived_prop
        additional_properties
      
      `);
  });
});
