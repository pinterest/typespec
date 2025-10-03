import { getOutput } from "#python/test-utils.jsx";
import { Tester } from "#test/test-host.js";
import { List } from "@alloy-js/core";
import * as py from "@alloy-js/python";
import { t } from "@typespec/compiler/testing";
import { describe, expect, it } from "vitest";
import { ClassDeclaration } from "../../../../src/python/components/class-declaration/class-declaration.js";
import { ClassMethod } from "../../../../src/python/components/class-declaration/class-method.js";
import { EnumDeclaration } from "../../../../src/python/components/enum-declaration/enum-declaration.js";

describe("Python Class from model", () => {
  it("creates a class", async () => {
    const { program, Widget } = await Tester.compile(t.code`

    model ${t.model("Widget")} {
      id: string;
      weight: int32;
      aliases: string[];
      isActive: boolean;
      color: "blue" | "red";
      promotionalPrice: float64;
      description?: string = "This is a widget";
      createdAt: int64 = 1717334400;
      tags: string[] = #["tag1", "tag2"];
      isDeleted: boolean = false;
      alternativeColor: "green" | "yellow" = "green";
      price: float64 = 100.0;
    }
    `);

    expect(getOutput(program, [<ClassDeclaration type={Widget} />])).toRenderTo(
      `
          from dataclasses import dataclass

          @dataclass
          class Widget:
            id: str
            weight: int
            aliases: list[str]
            is_active: bool
            color: Literal["blue", "red"]
            promotional_price: float
            description: str = "This is a widget"
            created_at: int = 1717334400
            tags: list[str] = ["tag1", "tag2"]
            is_deleted: bool = False
            alternative_color: Literal["green", "yellow"] = "green"
            price: float = 100.0
          
          `,
    );
  });

  it("declares a class with multi line docs", async () => {
    const { program, Foo } = await Tester.compile(t.code`
      /**
       * This is a test
       * with multiple lines
       */
      model ${t.model("Foo")} {
        knownProp: string;
      }
    `);

    expect(getOutput(program, [<ClassDeclaration type={Foo} />])).toRenderTo(
      `
          from dataclasses import dataclass

          @dataclass
          class Foo:
            """
            This is a test
            with multiple lines
            """
            known_prop: str

          `,
    );
  });

  it("declares a class overriding docs", async () => {
    const { program, Foo } = await Tester.compile(t.code`
      /**
       * This is a test
       * with multiple lines
       */
      model ${t.model("Foo")} {
        knownProp: string;
      }
    `);

    expect(
      getOutput(program, [
        <ClassDeclaration
          type={Foo}
          doc={["This is an overridden doc comment\nwith multiple lines"]}
        />,
      ]),
    ).toRenderTo(
      `
          from dataclasses import dataclass

          @dataclass
          class Foo:
            """
            This is an overridden doc comment
            with multiple lines
            """
            known_prop: str

          `,
    );
  });

  it("declares a class overriding docs with paragraphs array", async () => {
    const { program, Foo } = await Tester.compile(t.code`
      /**
       * Base doc will be overridden
       */
      model ${t.model("Foo")} {
        knownProp: string;
      }
    `);

    expect(
      getOutput(program, [
        <ClassDeclaration type={Foo} doc={["First paragraph", "Second paragraph"]} />,
      ]),
    ).toRenderTo(
      `
          from dataclasses import dataclass

          @dataclass
          class Foo:
            """
            First paragraph

            Second paragraph
            """
            known_prop: str

          `,
    );
  });

  it("declares a class overriding docs with prebuilt JSX ClassDoc", async () => {
    const { program, Foo } = await Tester.compile(t.code`
      /**
       * Base doc will be overridden
       */
      model ${t.model("Foo")} {
        knownProp: string;
      }
    `);

    expect(
      getOutput(program, [
        <ClassDeclaration type={Foo} doc={<py.ClassDoc description={[<>Alpha</>, <>Beta</>]} />} />,
      ]),
    ).toRenderTo(
      `
          from dataclasses import dataclass

          @dataclass
          class Foo:
            """
            Alpha

            Beta
            """
            known_prop: str

          `,
    );
  });

  it("declares a class from amodel with @doc", async () => {
    const { program, Foo } = await Tester.compile(t.code`
        @doc("This is a test")
        model ${t.model("Foo")} {
          knownProp: string;
        }
        `);

    expect(getOutput(program, [<ClassDeclaration type={Foo} />])).toRenderTo(
      `
          from dataclasses import dataclass

          @dataclass
          class Foo:
            """
            This is a test
            """
            known_prop: str

          `,
    );
  });

  it("declares a model property with @doc", async () => {
    const { program, Foo } = await Tester.compile(t.code`
        /**
         * This is a test
         */
        model ${t.model("Foo")} {
          @doc("This is a known property")
          knownProp: string;
        }
        `);

    expect(getOutput(program, [<ClassDeclaration type={Foo} />])).toRenderTo(
      `
          from dataclasses import dataclass

          @dataclass
          class Foo:
            """
            This is a test
            """
            # This is a known property
            known_prop: str

          `,
    );
  });

  it("throws error for model is Record<T>", async () => {
    const { program, Person } = await Tester.compile(t.code`
      model ${t.model("Person")} is Record<string>;
    `);

    expect(() => {
      expect(getOutput(program, [<ClassDeclaration type={Person} />])).toRenderTo("");
    }).toThrow(/Models with additional properties \(Record\[…\]\) are not supported/);
  });

  it("throws error for model is Record<string> with properties", async () => {
    const { program, Person } = await Tester.compile(t.code`
      model ${t.model("Person")} is Record<string> {
        name: string;
      }
    `);

    expect(() => {
      expect(getOutput(program, [<ClassDeclaration type={Person} />])).toRenderTo("");
    }).toThrow(/Models with additional properties \(Record\[…\]\) are not supported/);
  });

  it("throws error for model extends Record<string>", async () => {
    const { program, Person } = await Tester.compile(t.code`
      model ${t.model("Person")} extends Record<string> {
        name: string;
      }
    `);

    expect(() => {
      expect(getOutput(program, [<ClassDeclaration type={Person} />])).toRenderTo("");
    }).toThrow(/Models with additional properties \(Record\[…\]\) are not supported/);
  });

  it("throws error for model with ...Record<string>", async () => {
    const { program, Person } = await Tester.compile(t.code`
      model ${t.model("Person")} {
        age: int32;
        ...Record<string>;
      }
    `);

    expect(() => {
      expect(getOutput(program, [<ClassDeclaration type={Person} />])).toRenderTo("");
    }).toThrow(/Models with additional properties \(Record\[…\]\) are not supported/);
  });

  it("creates a class from a model that 'is' an array ", async () => {
    const { program, Foo } = await Tester.compile(t.code`
      model ${t.model("Foo")} is Array<string>;
    `);

    expect(getOutput(program, [<ClassDeclaration type={Foo} />])).toRenderTo(
      `
      from dataclasses import dataclass

      @dataclass
      class Foo(list[str]):
        pass

    `,
    );
  });

  it("handles a type reference to a union variant in a class property", async () => {
    const { program, Color, Widget } = await Tester.compile(t.code`
      union ${t.union("Color")} {
        red: "RED",
        blue: "BLUE"
      }
  
      model ${t.model("Widget")} {
        id: string = "123";
        weight: int32 = 100;
        color: Color.blue
      }
      `);

    expect(
      getOutput(program, [<EnumDeclaration type={Color} />, <ClassDeclaration type={Widget} />]),
    ).toRenderTo(
      `
      from dataclasses import dataclass
      from enum import StrEnum

      class Color(StrEnum):
        RED = "RED"
        BLUE = "BLUE"


      @dataclass
      class Widget:
        id: str = "123"
        weight: int = 100
        color: Literal[Color.BLUE]

      `,
    );
  });

  it("renders an empty class based on a model with a never-typed member", async () => {
    const { program, Widget } = await Tester.compile(t.code`
    model ${t.model("Widget")} {
      property: never;
    }
    `);

    expect(getOutput(program, [<ClassDeclaration type={Widget} />])).toRenderTo(`
      from dataclasses import dataclass

      @dataclass
      class Widget:
        pass

  `);
  });

  it("can override class name", async () => {
    const { program, Widget } = await Tester.compile(t.code`
    model ${t.model("Widget")} {
      id: string;
      weight: int32;
      color: "blue" | "red";
    }
    `);

    expect(getOutput(program, [<ClassDeclaration name="MyOperations" type={Widget} />]))
      .toRenderTo(`
      from dataclasses import dataclass

      @dataclass
      class MyOperations:
        id: str
        weight: int
        color: Literal["blue", "red"]

      `);
  });

  it("can add a members to the class", async () => {
    const { program, Widget } = await Tester.compile(t.code`
    model ${t.model("Widget")} {
      id: string;
      weight: int32;
      color: "blue" | "red";
    }
    `);

    expect(
      getOutput(program, [
        <ClassDeclaration name="MyOperations" type={Widget}>
          <hbr />
          <List>
            <>custom_property: str</>
          </List>
        </ClassDeclaration>,
      ]),
    ).toRenderTo(`
      from dataclasses import dataclass

      @dataclass
      class MyOperations:
        id: str
        weight: int
        color: Literal["blue", "red"]
        custom_property: str

    `);
  });
  it("creates a class from a model with extends", async () => {
    const { program, Widget, ErrorWidget } = await Tester.compile(t.code`
    model ${t.model("Widget")} {
      id: string;
      weight: int32;
      color: "blue" | "red";
    }
    
    model ${t.model("ErrorWidget")} extends Widget {
      code: int32;
      message: string;
    }
    `);

    expect(
      getOutput(program, [
        <ClassDeclaration type={Widget} />,
        <ClassDeclaration type={ErrorWidget} />,
      ]),
    ).toRenderTo(`
      from dataclasses import dataclass

      @dataclass
      class Widget:
        id: str
        weight: int
        color: Literal["blue", "red"]


      @dataclass
      class ErrorWidget(Widget):
        code: int
        message: str

    `);
  });
});

describe("Python Class from interface", () => {
  it("creates a class from an interface declaration", async () => {
    const { program, WidgetOperations } = await Tester.compile(t.code`
    interface ${t.interface("WidgetOperations")} {
      op getName(id: string): string;
    }
    `);

    expect(getOutput(program, [<ClassDeclaration type={WidgetOperations} />])).toRenderTo(`
      from abc import ABC
      from abc import abstractmethod


      class WidgetOperations(ABC):
        @abstractmethod
        def get_name(self, id: str) -> str:
          pass


      `);
  });

  it("should handle spread and non spread interface parameters", async () => {
    const { program, Foo, WidgetOperations } = await Tester.compile(t.code`
    model ${t.model("Foo")} {
      name: string
    }

    interface ${t.interface("WidgetOperations")} {
      op getName(foo: Foo): string;
      op getOtherName(...Foo): string
    }
    `);

    expect(
      getOutput(program, [
        <ClassDeclaration type={Foo} />,
        <ClassDeclaration type={WidgetOperations} />,
      ]),
    ).toRenderTo(`
      from abc import ABC
      from abc import abstractmethod
      from dataclasses import dataclass

      @dataclass
      class Foo:
        name: str



      class WidgetOperations(ABC):
        @abstractmethod
        def get_name(self, foo: Foo) -> str:
          pass

        @abstractmethod
        def get_other_name(self, name: str) -> str:
          pass


    `);
  });

  it("creates a class from an interface with Model references", async () => {
    const { program, WidgetOperations, Widget } = await Tester.compile(t.code`
    /**
     * Operations for Widget
     */
    interface ${t.interface("WidgetOperations")} {
      /**
       * Get the name of the widget
       */
      op getName(
        /**
         * The id of the widget
         */
         id: string
      ): Widget;
    }

    model ${t.model("Widget")} {
      id: string;
      weight: int32;
      color: "blue" | "red";
    }
    `);

    expect(
      getOutput(program, [
        <ClassDeclaration type={WidgetOperations} />,
        <ClassDeclaration type={Widget} />,
      ]),
    ).toRenderTo(`
      from abc import ABC
      from abc import abstractmethod
      from dataclasses import dataclass


      class WidgetOperations(ABC):
        """
        Operations for Widget
        """
        @abstractmethod
        def get_name(self, id: str) -> Widget:
          """
          Get the name of the widget
          """
          pass



      @dataclass
      class Widget:
        id: str
        weight: int
        color: Literal["blue", "red"]

      `);
  });

  it("creates a class from an interface that extends another", async () => {
    const { program, WidgetOperations, WidgetOperationsExtended, Widget } =
      await Tester.compile(t.code`
    interface ${t.interface("WidgetOperations")} {
      op getName(id: string): Widget;
    }

    interface ${t.interface("WidgetOperationsExtended")} extends WidgetOperations{
      op delete(id: string): void;
    }

    model ${t.model("Widget")} {
      id: string;
      weight: int32;
      color: "blue" | "red";
    }
    `);

    expect(
      getOutput(program, [
        <ClassDeclaration type={WidgetOperations} />,
        <ClassDeclaration type={WidgetOperationsExtended} />,
        <ClassDeclaration type={Widget} />,
      ]),
    ).toRenderTo(`
      from abc import ABC
      from abc import abstractmethod
      from dataclasses import dataclass


      class WidgetOperations(ABC):
        @abstractmethod
        def get_name(self, id: str) -> Widget:
          pass




      class WidgetOperationsExtended(ABC):
        @abstractmethod
        def get_name(self, id: str) -> Widget:
          pass

        @abstractmethod
        def delete(self, id: str) -> None:
          pass



      @dataclass
      class Widget:
        id: str
        weight: int
        color: Literal["blue", "red"]

      `);
  });
});

describe("Python Class overrides", () => {
  it("creates a class with a method if a model is provided and a class method is provided", async () => {
    const { program, WidgetOperations } = await Tester.compile(t.code`
    model ${t.model("WidgetOperations")} {
      id: string;
      weight: int32;
    }
    `);

    expect(
      getOutput(program, [
        <ClassDeclaration type={WidgetOperations}>
          <hbr />
          <hbr />
          <List>
            <ClassMethod name="do_work" returnType="None" doc="This is a test" />
          </List>
        </ClassDeclaration>,
      ]),
    ).toRenderTo(`
      from dataclasses import dataclass

      @dataclass
      class WidgetOperations:
        id: str
        weight: int

        def do_work(self) -> None:
          """
          This is a test
          """
          pass


      `);
  });

  it("creates a class with a method if a model is provided and a class method is provided and methodType is set to method", async () => {
    const { program, WidgetOperations } = await Tester.compile(t.code`
    model ${t.model("WidgetOperations")} {
      id: string;
      weight: int32;
    }
    `);

    expect(
      getOutput(program, [
        <ClassDeclaration type={WidgetOperations} methodType="method">
          <hbr />
          <hbr />
          <List>
            <ClassMethod name="do_work" returnType="None" doc="This is a test" />
          </List>
        </ClassDeclaration>,
      ]),
    ).toRenderTo(`
      from dataclasses import dataclass

      @dataclass
      class WidgetOperations:
        id: str
        weight: int

        def do_work(self) -> None:
          """
          This is a test
          """
          pass


      `);
  });

  it("creates a class with a classmethod if a model is provided, a class method is provided and methodType is set to class", async () => {
    const { program, WidgetOperations } = await Tester.compile(t.code`
    model ${t.model("WidgetOperations")} {
      id: string;
      weight: int32;
    }
    `);

    expect(
      getOutput(program, [
        <ClassDeclaration type={WidgetOperations} methodType="class">
          <hbr />
          <hbr />
          <List>
            <ClassMethod name="do_work" returnType="None" doc="This is a test" />
          </List>
        </ClassDeclaration>,
      ]),
    ).toRenderTo(`
      from dataclasses import dataclass

      @dataclass
      class WidgetOperations:
        id: str
        weight: int

        @classmethod
        def do_work(cls) -> None:
          """
          This is a test
          """
          pass


      `);
  });

  it("creates a class with a staticmethod if a model is provided, a class method is provided and methodType is set to static", async () => {
    const { program, WidgetOperations } = await Tester.compile(t.code`
    model ${t.model("WidgetOperations")} {
      id: string;
      weight: int32;
    }
    `);

    expect(
      getOutput(program, [
        <ClassDeclaration type={WidgetOperations} methodType="static">
          <hbr />
          <hbr />
          <List>
            <ClassMethod name="do_work" returnType="None" doc="This is a test" />
          </List>
        </ClassDeclaration>,
      ]),
    ).toRenderTo(`
      from dataclasses import dataclass

      @dataclass
      class WidgetOperations:
        id: str
        weight: int

        @staticmethod
        def do_work() -> None:
          """
          This is a test
          """
          pass


      `);
  });

  it("creates a class with abstract method if an interface is provided", async () => {
    const { program, WidgetOperations } = await Tester.compile(t.code`
    interface ${t.interface("WidgetOperations")} {
      op getName(id: string): string;
    }
    `);

    expect(getOutput(program, [<ClassDeclaration type={WidgetOperations} />])).toRenderTo(`
      from abc import ABC
      from abc import abstractmethod


      class WidgetOperations(ABC):
        @abstractmethod
        def get_name(self, id: str) -> str:
          pass


      `);
  });

  it("creates a class with abstract method if an interface is provided and methodType is set to method", async () => {
    const { program, WidgetOperations } = await Tester.compile(t.code`
    interface ${t.interface("WidgetOperations")} {
      op getName(id: string): string;
    }
    `);

    expect(getOutput(program, [<ClassDeclaration type={WidgetOperations} methodType="method" />]))
      .toRenderTo(`
      from abc import ABC
      from abc import abstractmethod


      class WidgetOperations(ABC):
        @abstractmethod
        def get_name(self, id: str) -> str:
          pass


      `);
  });

  it("creates a class with abstract classmethod if an interface is provided and methodType is set to class", async () => {
    const { program, WidgetOperations } = await Tester.compile(t.code`
    interface ${t.interface("WidgetOperations")} {
      op getName(id: string): string;
    }
    `);

    expect(getOutput(program, [<ClassDeclaration type={WidgetOperations} methodType="class" />]))
      .toRenderTo(`
      from abc import ABC
      from abc import abstractmethod


      class WidgetOperations(ABC):
        @classmethod
        @abstractmethod
        def get_name(cls, id: str) -> str:
          pass


      `);
  });

  it("creates a class with abstract staticmethod if an interface is provided and methodType is set to static", async () => {
    const { program, WidgetOperations } = await Tester.compile(t.code`
    interface ${t.interface("WidgetOperations")} {
      op getName(id: string): string;
    }
    `);

    expect(getOutput(program, [<ClassDeclaration type={WidgetOperations} methodType="static" />]))
      .toRenderTo(`
      from abc import ABC
      from abc import abstractmethod


      class WidgetOperations(ABC):
        @staticmethod
        @abstractmethod
        def get_name(id: str) -> str:
          pass


      `);
  });
});
