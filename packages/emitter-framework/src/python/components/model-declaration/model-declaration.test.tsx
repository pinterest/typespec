import { List } from "@alloy-js/core";
import { createTestHost, type TestHost } from "@typespec/compiler/testing";
import { strictEqual } from "assert";
import { beforeEach, describe, expect, it } from "vitest";
import { ModelDeclaration } from "../../index.jsx";
import { UnionDeclaration } from "../../../typescript/index.jsx";
import { getOutput, runNavigator } from "../../test-utils.js";

// describe("Python Model Declaration - Record", () => {
//   it("converts a model with an 'is' operator to a Record", async () => {
//     const program = await getProgram(`
//         namespace DemoService;

//         model Person is Record<string>;
//         `);

//     const [namespace] = program.resolveTypeReference("DemoService");
//     const models = Array.from((namespace as Namespace).models.values());

//     expect(getOutput(program, [
//       <List hardline>
//         {models.map((model) => (
//           <ModelDeclaration
//             type={model}
//           />
//         ))}
//       </List>
//     ])).toRenderTo(`
//           from typing_extensions import TypedDict

//           class Person(TypedDict, extra_items=str):
//             pass

//       `,
//     );
//   });
//   it("converts a model with parameters and an 'is' operator to a Record", async () => {
//     const program = await getProgram(`
//         namespace DemoService;

//         model Person is Record<string> {
//           name: string;
//         }
//         `);

//     const [namespace] = program.resolveTypeReference("DemoService");
//     const models = Array.from((namespace as Namespace).models.values());

//     expect(getOutput(program, [
//       <List hardline>
//         {models.map((model) => (
//           <ModelDeclaration
//             type={model}
//           />
//         ))}
//       </List>
//     ])).toRenderTo(`
//           from typing_extensions import TypedDict

//           class Person(TypedDict, extra_items=str):
//             name: str

//       `,
//     );
//   });
//   it("converts a model with parameters and that extends a Record", async () => {
//     const program = await getProgram(`
//         namespace DemoService;

//         model Person extends Record<string> {
//           name: string;
//         }

//         `);

//     const [namespace] = program.resolveTypeReference("DemoService");
//     const models = Array.from((namespace as Namespace).models.values());

//     expect(getOutput(program, [
//       <List hardline>
//         {models.map((model) => (
//           <ModelDeclaration
//             type={model}
//           />
//         ))}
//       </List>
//     ])).toRenderTo(`
//           from typing_extensions import TypedDict

//           class Person(TypedDict, extra_items=str):
//             name: str

//       `,
//     );
//   });
//   it("converts a model with parameters and that has a spread to a Record", async () => {
//     const program = await getProgram(`
//         namespace DemoService;

//         model Person {
//           age: int32;
//           ...Record<string>;
//         }

//         `);

//     const [namespace] = program.resolveTypeReference("DemoService");
//     const models = Array.from((namespace as Namespace).models.values());

//     expect(getOutput(program, [
//       <List hardline>
//         {models.map((model) => (
//           <ModelDeclaration
//             type={model}
//           />
//         ))}
//       </List>
//     ])).toRenderTo(`
//           from typing_extensions import TypedDict

//           class Person(TypedDict, extra_items=str):
//             age: int

//       `,
//     );
//   });
// });

describe("Python Model Declaration - Non-Record", () => {
  let host: TestHost;

  beforeEach(async () => {
    host = await createTestHost();
  });

  it("converts a model with a field that can be null", async () => {
    const result = await runNavigator(
      `
      namespace DemoService;

      model Person {
        age: int32;
        address: string | null;
      }`,
      host,
    );

    strictEqual(result.exitModels.length, 1);
    strictEqual(result.exitModels[0].name, "Person");
    const models = result.exitModels.values();

    expect(
      getOutput(host.program, [
        <List hardline>
          {Array.from(models).map((model) => (
            <ModelDeclaration type={model} />
          ))}
        </List>,
      ]),
    ).toRenderTo(`
      from dataclasses import dataclass

      @dataclass
      class Person:
        age: int
        address: str | None

      `);
  });
  it("converts a model with an optional field", async () => {
    const result = await runNavigator(
      `
      namespace DemoService;

      model Person {
        id: int32;
        address?: string;
      }`,
      host,
    );

    strictEqual(result.exitModels.length, 1);
    strictEqual(result.exitModels[0].name, "Person");
    const models = result.exitModels.values();

    expect(
      getOutput(host.program, [
        <List hardline>
          {Array.from(models).map((model) => (
            <ModelDeclaration type={model} />
          ))}
        </List>,
      ]),
    ).toRenderTo(`
      from dataclasses import dataclass
      from dataclasses import field

      @dataclass
      class Person:
        id: int
        address: str = field(default_factory=object)

      `);
  });
  it("converts a model with an optional field that has a default", async () => {
    const result = await runNavigator(
      `
      namespace DemoService;

      model Person {
        age: int32;
        address?: string = "N/A";
      }`,
      host,
    );

    strictEqual(result.exitModels.length, 1);
    strictEqual(result.exitModels[0].name, "Person");
    const models = result.exitModels.values();

    expect(
      getOutput(host.program, [
        <List hardline>
          {Array.from(models).map((model) => (
            <ModelDeclaration type={model} />
          ))}
        </List>,
      ]),
    ).toRenderTo(`
      from dataclasses import dataclass
      from dataclasses import field

      @dataclass
      class Person:
        age: int
        address: str = field(default="N/A")

      `);
  });
  it("converts a model with an optional field that can be null", async () => {
    const result = await runNavigator(
      `
      namespace DemoService;

      model Person {
        age: int32;
        address?: string | null;
      }`,
      host,
    );

    strictEqual(result.exitModels.length, 1);
    strictEqual(result.exitModels[0].name, "Person");
    const models = result.exitModels.values();

    expect(
      getOutput(host.program, [
        <List hardline>
          {Array.from(models).map((model) => (
            <ModelDeclaration type={model} />
          ))}
        </List>,
      ]),
    ).toRenderTo(`
      from dataclasses import dataclass
      from dataclasses import field

      @dataclass
      class Person:
        age: int
        address: str | None = field(default=None)

      `);
  });
  it("converts a model with a special property type - never", async () => {
    const result = await runNavigator(
      `
      namespace DemoService;

      model Address<TState> {
        state: TState;
        city: string;
        street: string;
      }

      model EuropeAddress is Address<never>;`,
      host,
    );

    strictEqual(result.exitModels.length, 1);
    strictEqual(result.exitModels[0].name, "EuropeAddress");
    const models = result.exitModels.values();

    expect(
      getOutput(host.program, [
        <List hardline>
          {Array.from(models).map((model) => (
            <ModelDeclaration type={model} />
          ))}
        </List>,
      ]),
    ).toRenderTo(`
          from dataclasses import dataclass

          @dataclass
          class EuropeAddress:
            city: str
            street: str

      `);
  });
  it("converts a model that extends a generic with never", async () => {
    const result = await runNavigator(
      `
      namespace DemoService;

      model Address<TState> {
        state: TState;
        city: string;
      }

      model EuropeAddress extends Address<int32> {
        street: string;
      }`,
      host,
    );

    strictEqual(result.exitModels.length, 2);
    strictEqual(result.exitModels[0].name, "Address");
    strictEqual(result.exitModels[1].name, "EuropeAddress");
    const models = result.exitModels.values();

    expect(
      getOutput(host.program, [
        <List hardline>
          {Array.from(models).map((model) => (
            <ModelDeclaration type={model} />
          ))}
        </List>,
      ]),
    ).toRenderTo(`
          from dataclasses import dataclass

          @dataclass
          class Address:
            state: int
            city: str

          @dataclass
          class EuropeAddress(Address):
            street: str

      `);
  });
  // it("converts a model with model inheritance through extends", async () => {
  //   const result = await runNavigator(
  //     `
  //     namespace DemoService;

  //     model Identified {
  //       id: int32;
  //     }

  //     model Admin extends Identified {
  //       role: "admin";
  //     }`,
  //     host,
  //   );

  //   strictEqual(result.exitModels.length, 2);
  //   strictEqual(result.exitModels[0].name, "Identified");
  //   strictEqual(result.exitModels[1].name, "Admin");
  //   const models = result.exitModels.values();

  //   expect(
  //     getOutput(host.program, [
  //       <List hardline>
  //         {Array.from(models).map((model) => (
  //           <ModelDeclaration type={model} />
  //         ))}
  //       </List>,
  //     ]),
  //   ).toRenderTo(`
  //         from dataclasses import dataclass
  //         from typing import Literal

  //         @dataclass
  //         class Identified:
  //           id: int

  //         @dataclass
  //         class Admin(Identified):
  //           role: Literal["admin"]


  //     `);
  // });
});

// describe("Python Model Declaration", () => {
//   it("declares an interface with multi line docs, explicit docs passed", async () => {
//     const program = await getProgram(`
//         namespace DemoService;

//         /**
//          * This is a test
//          * with multiple lines
//          */
//         model Foo {
//           KnownProp: string;
//         }
//         `);

//     const [namespace] = program.resolveTypeReference("DemoService");
//     const models = Array.from((namespace as Namespace).models.values());

//     expect(getOutput(program, [
//       <List hardline>
//         {models.map((model) => (
//           <ModelDeclaration
//             type={model}
//           />
//         ))}
//       </List>
//     ])).toRenderTo(`
//           class Foo:
//             """
//             This is a test with multiple lines
//             """
//             known_prop

//       `,
//     );
//   });
//   it("declares an interface with multi line docs, docs overridden", async () => {
//     const program = await getProgram(`
//         namespace DemoService;

//         /**
//          * This is a test
//          * with multiple lines
//          */
//         model Foo {
//           KnownProp: string;
//         }
//         `);

//     const [namespace] = program.resolveTypeReference("DemoService");
//     const models = Array.from((namespace as Namespace).models.values());

//     expect(getOutput(program, [
//       <List hardline>
//         {models.map((model) => (
//           <ModelDeclaration
//             type={model}
//             doc={["This is an overridden doc comment\nwith multiple lines"]}
//           />
//         ))}
//       </List>
//     ])).toRenderTo(`
//       class Foo:
//         """
//         This is an overridden doc comment with multiple lines
//         """
//         known_prop

//       `,
//     );
//   });
//   it("declares a model with @doc", async () => {
//     const program = await getProgram(`
//         namespace DemoService;

//         @doc("This is a test")
//         model Foo {
//           knownProp: string;
//         }
//         `);

//     const [namespace] = program.resolveTypeReference("DemoService");
//     const models = Array.from((namespace as Namespace).models.values());

//     expect(getOutput(program, [
//       <List hardline>
//         {models.map((model) => (
//           <ModelDeclaration type={model} />
//         ))}
//       </List>
//     ])).toRenderTo(`
//       class Foo:
//         """
//         This is a test
//         """
//         known_prop

//       `,
//     );
//   });
//   it("declares a model with a property that has doc", async () => {
//     const program = await getProgram(`
//         namespace DemoService;

//         /**
//          * This is a test
//          */
//         model Foo {
//           @doc("This is a known property")
//           knownProp: string;
//         }
//         `);

//     const [namespace] = program.resolveTypeReference("DemoService");
//     const models = Array.from((namespace as Namespace).models.values());

//     expect(getOutput(program, [
//       <List hardline>
//         {models.map((model) => (
//               <ModelDeclaration type={model} />
//         ))}
//       </List>
//     ])).toRenderTo(`
//       class Foo:
//         """
//         This is a test
//         """
//         # This is a known property
//         known_prop

//       `,
//     );
//   });
//   it("creates a model that extends a model for Record spread", async () => {
//     const program = await getProgram(`
//       namespace DemoService;

//       model DifferentSpreadModelRecord {
//         knownProp: string;
//         ...Record<unknown>;
//       }
//       `);

//     const [namespace] = program.resolveTypeReference("DemoService");
//     const models = Array.from((namespace as Namespace).models.values());

//     expect(getOutput(program, [
//       <List hardline>
//         {models.map((model) => (
//               <ModelDeclaration type={model} />
//         ))}
//       </List>
//     ])).toRenderTo(`
//       class DifferentSpreadModelRecord:
//         known_prop
//         additional_properties

//       `);
//   });
//   it("creates a model for a model that 'is' an array", async () => {
//     const program = await getProgram(`
//       namespace DemoService;

//       model Foo is Array<string>;
//       `);

//     const [namespace] = program.resolveTypeReference("DemoService");
//     const models = (namespace as Namespace).models;

//     expect(getOutput(program, [
//       <For each={Array.from(models.values())} hardline>
//         {(model) => <ModelDeclaration type={model} />}
//       </For>
//     ])).toRenderTo(`
//       class Foo(list[str]):
//         pass

//       `);
//   });
//   it("creates a model for a model that 'is' a record ", async () => {
//     const program = await getProgram(`
//       namespace DemoService;

//       model Foo is Record<string>;
//       `);

//     const [namespace] = program.resolveTypeReference("DemoService");
//     const models = (namespace as Namespace).models;

//     expect(getOutput(program, [
//       <For each={Array.from(models.values())} hardline>
//         {(model) => <ModelDeclaration type={model} />}
//       </For>
//     ])).toRenderTo(`
//       class Foo:
//         additional_properties

//       `);
//   });
//   it("creates a model of a model that spreads a Record", async () => {
//     const program = await getProgram(`
//       namespace DemoService;

//       model Foo {
//         ...Record<string>
//       }
//       `);

//     const [namespace] = program.resolveTypeReference("DemoService");
//     const models = (namespace as Namespace).models;

//     expect(getOutput(program, [
//       <For each={Array.from(models.values())} hardline>
//         {(model) => <ModelDeclaration type={model} />}
//       </For>
//     ])).toRenderTo(`
//       class Foo:
//         additional_properties

//       `);
//   });
//   it("creates a model that extends a spread model", async () => {
//     const program = await getProgram(`
//       namespace DemoService;

//       model ModelForRecord {
//         state: string;
//       }

//       model DifferentSpreadModelRecord {
//         knownProp: string;
//         ...Record<ModelForRecord>;
//       }

//       model DifferentSpreadModelDerived extends DifferentSpreadModelRecord {
//         derivedProp: ModelForRecord;
//       }
//       `);

//     const [namespace] = program.resolveTypeReference("DemoService");
//     const models = (namespace as Namespace).models;

//     expect(getOutput(program, [
//       <For each={Array.from(models.values())} hardline>
//         {(model) => <ModelDeclaration type={model} />}
//       </For>
//     ])).toRenderTo(`
//       class ModelForRecord:
//         state

//       class DifferentSpreadModelRecord:
//         known_prop
//         additional_properties

//       class DifferentSpreadModelDerived(DifferentSpreadModelRecord):
//         derived_prop
//         additional_properties

//       `);
//   });
// });
