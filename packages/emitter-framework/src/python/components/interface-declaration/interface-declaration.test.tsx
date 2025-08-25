import { Tester } from "#test/test-host.js";
import { t, type TesterInstance } from "@typespec/compiler/testing";
import { beforeEach, describe, expect, it } from "vitest";
import { InterfaceDeclaration } from "../../index.jsx";
import { getOutput } from "../../test-utils.js";

describe("Python Model Declaration - Non-Record", () => {
  let runner: TesterInstance;

  beforeEach(async () => {
    runner = await Tester.createInstance();
  });

  it("converts a model with a field that can be null", async () => {
    const result = await runner.compile(t.code`
      @test model ${t.model("Person")} {
        age: int32;
        address: string | null;
      }
    `);

    expect(getOutput(runner.program, [<InterfaceDeclaration type={result.Person} />])).toRenderTo(`
      from dataclasses import dataclass

      @dataclass
      class Person:
        age: int
        address: str | None

      `);
  });
  it("converts a model with an optional field", async () => {
    const result = await runner.compile(t.code`
      @test model ${t.model("Person")} {
        id: int32;
        address?: string;
      }
    `);

    expect(getOutput(runner.program, [<InterfaceDeclaration type={result.Person} />])).toRenderTo(`
      from dataclasses import dataclass
      from dataclasses import field

      @dataclass
      class Person:
        id: int
        address: str = field(default_factory=object)

      `);
  });
  it("converts a model with an optional field that has a default", async () => {
    const result = await runner.compile(t.code`
      @test model ${t.model("Person")} {
        age: int32;
        address?: string = "N/A";
      }
    `);

    expect(getOutput(runner.program, [<InterfaceDeclaration type={result.Person} />])).toRenderTo(`
      from dataclasses import dataclass
      from dataclasses import field

      @dataclass
      class Person:
        age: int
        address: str = field(default="N/A")

      `);
  });
  it("converts a model with an optional field that can be null", async () => {
    const result = await runner.compile(t.code`
      @test model ${t.model("Person")} {
        age: int32;
        address?: string | null;
      }
    `);

    expect(getOutput(runner.program, [<InterfaceDeclaration type={result.Person} />])).toRenderTo(`
      from dataclasses import dataclass
      from dataclasses import field

      @dataclass
      class Person:
        age: int
        address: str | None = field(default=None)

      `);
  });
  // it("converts a model with a special property type - never", async () => {
  //   const result = await runner.compile(t.code`
  //     @test model ${t.model("Address")}<TState> {
  //       state: TState;
  //       city: string;
  //       street: string;
  //     }
  //     @test model ${t.model("EuropeAddress")} is Address<never>;
  //   `);

  //   expect(
  //     getOutput(runner.program, [
  //       <InterfaceDeclaration type={result.Address} />,
  //       <InterfaceDeclaration type={result.EuropeAddress} />,
  //     ]),
  //   ).toRenderTo(`
  //         from dataclasses import dataclass

  //         @dataclass
  //         class Address:
  //           state: any
  //           city: str
  //           street: str


  //         @dataclass
  //         class EuropeAddress:
  //           city: str
  //           street: str

  //     `);
  // });
  // it("converts a model that extends a generic with never", async () => {
  //   const result = await runner.compile(t.code`
  //     @test model ${t.model("Address")}<TState> {
  //       state: TState;
  //       city: string;
  //     }
  //     @test model ${t.model("EuropeAddress")} extends Address<int32> {
  //       street: string;
  //     };
  //   `);

  //   expect(
  //     getOutput(runner.program, [
  //       <InterfaceDeclaration type={result.Address} />,
  //       <InterfaceDeclaration type={result.EuropeAddress} />,
  //     ]),
  //   ).toRenderTo(`
  //         from dataclasses import dataclass

  //         @dataclass
  //         class Address:
  //           state: any
  //           city: str


  //         @dataclass
  //         class EuropeAddress(Address):
  //           street: str

  //     `);
  // });
  it("converts a model with model inheritance through extends", async () => {
    const result = await runner.compile(t.code`
      @test model ${t.model("Identified")} {
        id: int32;
      }
      @test model ${t.model("Admin")} extends Identified {
        role: "admin";
      };
    `);

    expect(
      getOutput(runner.program, [
        <InterfaceDeclaration type={result.Identified} />,
        <InterfaceDeclaration type={result.Admin} />,
      ]),
    ).toRenderTo(`
          from dataclasses import dataclass
          from typing import Literal

          @dataclass
          class Identified:
            id: int


          @dataclass
          class Admin(Identified):
            role: Literal["admin"] = "admin"

      `);
  });
  it("converts a model with model inheritance through spreads", async () => {
    const result = await runner.compile(t.code`
      @test model ${t.model("Animal")} {
        species: string;
      }

      @test model ${t.model("Dog")} {
        ...Animal;
        age: int32;
      }
    `);

    expect(
      getOutput(runner.program, [
        <InterfaceDeclaration type={result.Animal} />,
        <InterfaceDeclaration type={result.Dog} />,
      ]),
    ).toRenderTo(`
      from dataclasses import dataclass

      @dataclass
      class Animal:
        species: str


      @dataclass
      class Dog:
        species: str
        age: int

      `);
  });
  it("declares a model with multi line docs, explicit docs passed", async () => {
    const result = await runner.compile(t.code`
      /**
       * This is a test
       * with multiple lines
       */
      @test model ${t.model("Foo")} {
        KnownProp: string;
      }
    `);

    expect(
      getOutput(runner.program, [
        <InterfaceDeclaration type={result.Foo} />,
      ]),
    ).toRenderTo(`
      from dataclasses import dataclass

      @dataclass
      class Foo:
        """
        This is a test with multiple lines
        """
        known_prop: str

      `);
  });
  it("declares a model with multi line docs, docs overridden", async () => {
    const result = await runner.compile(t.code`
      /**
       * This is a test
       * with multiple lines
       */
      @test model ${t.model("Foo")} {
        KnownProp: string;
      }
    `);

    expect(
      getOutput(runner.program, [
        <InterfaceDeclaration
          type={result.Foo}
          doc={["This is an overridden doc comment\nwith multiple lines"]}
        />
      ]),
    ).toRenderTo(`
      from dataclasses import dataclass

      @dataclass
      class Foo:
        """
        This is an overridden doc comment with multiple lines
        """
        known_prop: str

      `);
  });
  it("declares a model with @doc", async () => {
    const result = await runner.compile(t.code`
      /**
       * This is a test
       * with multiple lines
       */
      @doc("This is a test")
      @test model ${t.model("Foo")} {
        knownProp: string;
      }
    `);

    expect(
      getOutput(runner.program, [
        <InterfaceDeclaration type={result.Foo} />,
      ]),
    ).toRenderTo(`
      from dataclasses import dataclass

      @dataclass
      class Foo:
        """
        This is a test
        """
        known_prop: str

      `);
  });
  it("declares a model with a property that has doc", async () => {
    const result = await runner.compile(t.code`
      /**
       * This is a test
       */
      @test model ${t.model("Foo")} {
        @doc("This is a known property")
        knownProp: string;
      }
    `);

    expect(
      getOutput(runner.program, [
        <InterfaceDeclaration type={result.Foo} />,
      ]),
    ).toRenderTo(`
      from dataclasses import dataclass

      @dataclass
      class Foo:
        """
        This is a test
        """
        # This is a known property
        known_prop: str

      `);
  });
});
