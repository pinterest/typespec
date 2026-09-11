import type { Model, Type } from "@typespec/compiler";
import { expectTypeEquals, t, type TesterInstance } from "@typespec/compiler/testing";
import { $ } from "@typespec/compiler/typekit";
import { beforeEach, expect, it } from "vitest";
import { Tester } from "../../test/test-host.js";
import { getEngine } from "../../test/utils.js";
import {
  SimpleModelMutation,
  SimpleMutationEngine,
  SimpleMutationOptions,
} from "../mutation/simple-mutation-engine.js";

let runner: TesterInstance;
beforeEach(async () => {
  runner = await Tester.createInstance();
});

it("handles mutation of properties", async () => {
  const { Foo, program } = await runner.compile(t.code`
      model ${t.model("Foo")} {
        prop: string;
      }
    `);
  const engine = getEngine(program);
  const fooNode = engine.getMutationNode(Foo);
  const propNode = engine.getMutationNode(Foo.properties.get("prop")!);
  fooNode.connectProperty(propNode);
  propNode.mutate();
  expect(fooNode.isMutated).toBe(true);
  expectTypeEquals(fooNode.mutatedType.properties.get("prop")!, propNode.mutatedType);
});

it("handles mutation of properties lazily", async () => {
  const { Foo, program } = await runner.compile(t.code`
    model ${t.model("Foo")} {
      prop: string;
    }
  `);
  const engine = getEngine(program);
  const fooNode = engine.getMutationNode(Foo);
  fooNode.mutate();

  const propNode = engine.getMutationNode(Foo.properties.get("prop")!);
  fooNode.connectProperty(propNode);
  expect(fooNode.isMutated).toBe(true);
  expect(propNode.isMutated).toBe(true);
  expectTypeEquals(fooNode.mutatedType.properties.get("prop")!, propNode.mutatedType);
});

it("handles deletion of properties", async () => {
  const { Foo, program } = await runner.compile(t.code`
      model ${t.model("Foo")} {
        prop: string;
      }
    `);
  const engine = getEngine(program);
  const fooNode = engine.getMutationNode(Foo);
  const propNode = engine.getMutationNode(Foo.properties.get("prop")!);
  fooNode.connectProperty(propNode);
  propNode.delete();
  expect(fooNode.isMutated).toBe(true);
  expect(fooNode.mutatedType.properties.get("prop")).toBeUndefined();
});

it("handles mutation of properties with name change", async () => {
  const { Foo, program } = await runner.compile(t.code`
      model ${t.model("Foo")} {
        prop: string;
      }
    `);
  const engine = getEngine(program);
  const fooNode = engine.getMutationNode(Foo);
  const propNode = engine.getMutationNode(Foo.properties.get("prop")!);
  fooNode.connectProperty(propNode);
  propNode.mutate((clone) => (clone.name = "propRenamed"));
  expect(fooNode.isMutated).toBe(true);
  expect(fooNode.mutatedType.properties.get("prop")).toBeUndefined();
  expectTypeEquals(fooNode.mutatedType.properties.get("propRenamed")!, propNode.mutatedType);
});

it("handles mutation of base models", async () => {
  const { Foo, Bar, program } = await runner.compile(t.code`
      model ${t.model("Foo")} extends Bar {
        barProp: string;
      }

      model ${t.model("Bar")} {
        bazProp: string;
      }
    `);
  const engine = getEngine(program);
  const fooNode = engine.getMutationNode(Foo);
  const barNode = engine.getMutationNode(Bar);
  fooNode.connectBase(barNode);
  barNode.mutate();
  expect(barNode.isMutated).toBe(true);
  expect(fooNode.isMutated).toBe(true);
  expect(fooNode.mutatedType.baseModel === barNode.mutatedType).toBeTruthy();
});

it("keeps the mutated base model's derivedModels pointing at the mutated derived model", async () => {
  const { Foo, Bar, program } = await runner.compile(t.code`
      model ${t.model("Foo")} extends Bar {
        barProp: string;
      }

      model ${t.model("Bar")} {
        bazProp: string;
      }
    `);
  const engine = getEngine(program);
  const fooNode = engine.getMutationNode(Foo);
  const barNode = engine.getMutationNode(Bar);
  fooNode.connectBase(barNode);
  barNode.mutate();

  expect(barNode.mutatedType.derivedModels).toEqual([fooNode.mutatedType]);
  expect(barNode.mutatedType.derivedModels).not.toContain(Foo);
  // The source graph is left untouched.
  expect(Bar.derivedModels).toEqual([Foo]);
});

it("syncs derivedModels when the base is mutated before the derived model connects", async () => {
  const { Foo, Bar, program } = await runner.compile(t.code`
      model ${t.model("Foo")} extends Bar {
        barProp: string;
      }

      model ${t.model("Bar")} {
        bazProp: string;
      }
    `);
  const engine = getEngine(program);
  const barNode = engine.getMutationNode(Bar);
  barNode.mutate();
  // Freshly cloned: still lists the source derived model.
  expect(barNode.mutatedType.derivedModels).toEqual([Foo]);

  const fooNode = engine.getMutationNode(Foo);
  fooNode.connectBase(barNode);
  expect(fooNode.isMutated).toBe(true);
  expect(barNode.mutatedType.derivedModels).toEqual([fooNode.mutatedType]);
});

it("removes a deleted derived model from the mutated base's derivedModels", async () => {
  const { Foo, Bar, program } = await runner.compile(t.code`
      model ${t.model("Foo")} extends Bar {
        barProp: string;
      }

      model ${t.model("Bar")} {
        bazProp: string;
      }
    `);
  const engine = getEngine(program);
  const fooNode = engine.getMutationNode(Foo);
  const barNode = engine.getMutationNode(Bar);
  fooNode.connectBase(barNode);
  barNode.mutate();
  expect(barNode.mutatedType.derivedModels).toEqual([fooNode.mutatedType]);

  fooNode.delete();
  expect(barNode.mutatedType.derivedModels).toEqual([]);
});

it("handles deletion of base models", async () => {
  const { Foo, Bar, program } = await runner.compile(t.code`
      model ${t.model("Foo")} extends Bar {
        barProp: string;
      }

      model ${t.model("Bar")} {
        bazProp: string;
      }
    `);
  const engine = getEngine(program);
  const fooNode = engine.getMutationNode(Foo);
  const barNode = engine.getMutationNode(Bar);
  fooNode.connectBase(barNode);

  barNode.delete();
  expect(barNode.isDeleted).toBe(true);
  expect(fooNode.isMutated).toBe(true);
  expect(fooNode.mutatedType.baseModel).toBeUndefined();
});

it("handles mutation of indexers", async () => {
  const { Foo, Bar, program } = await runner.compile(t.code`
      model ${t.model("Foo")} is Record<Bar> {};
      model ${t.model("Bar")} {
        bazProp: string;
      }
    `);
  const engine = getEngine(program);
  const fooNode = engine.getMutationNode(Foo);
  const barNode = engine.getMutationNode(Bar);
  fooNode.connectIndexerValue(barNode);

  barNode.mutate();
  expect(barNode.isMutated).toBe(true);
  expect(fooNode.isMutated).toBe(true);
  expect((fooNode.mutatedType.indexer?.value as Type) === barNode.mutatedType).toBeTruthy();
});

it("handles mutation of arrays", async () => {
  const { Foo, Bar, bazProp, program } = await runner.compile(t.code`
      model ${t.model("Foo")} {};
      model ${t.model("Bar")} {
        ${t.modelProperty("bazProp")}: Foo[];
      }
    `);

  const engine = getEngine(program);
  const fooNode = engine.getMutationNode(Foo);
  const barNode = engine.getMutationNode(Bar);
  const bazPropNode = engine.getMutationNode(bazProp);
  barNode.connectProperty(bazPropNode);
  const arrayType = bazProp.type as Model;
  const arrayNode = engine.getMutationNode(arrayType);
  bazPropNode.connectType(arrayNode);
  arrayNode.connectIndexerValue(fooNode);

  fooNode.mutate();
  expect(fooNode.isMutated).toBe(true);
  expect(barNode.isMutated).toBe(true);
  expect(bazPropNode.isMutated).toBe(true);
  expect(
    (bazPropNode.mutatedType.type as Model).indexer!.value === fooNode.mutatedType,
  ).toBeTruthy();
});

it("handles circular models", async () => {
  const { Foo, Bar, program } = await runner.compile(t.code`
      model ${t.model("Foo")} {
        bar: Bar;
      };
      model ${t.model("Bar")} {
        foo: Foo;
      }
    `);

  const engine = getEngine(program);
  const fooNode = engine.getMutationNode(Foo);
  const barNode = engine.getMutationNode(Bar);
  const fooPropBar = engine.getMutationNode(Foo.properties.get("bar")!);
  const barPropFoo = engine.getMutationNode(Bar.properties.get("foo")!);
  fooNode.connectProperty(fooPropBar);
  fooPropBar.connectType(barNode);
  barNode.connectProperty(barPropFoo);
  barPropFoo.connectType(fooNode);

  fooNode.mutate();
  expect(fooNode.isMutated).toBe(true);
  expect(barNode.isMutated).toBe(true);
});

it("rewires a template argument to the mutated argument type", async () => {
  const { Foo, Bar, program } = await runner.compile(t.code`
      model Wrapper<T> {
        item: T;
      }
      model ${t.model("Foo")} {
        name: string;
      }
      model ${t.model("Bar")} {
        wrapped: Wrapper<Foo>;
      }
    `);
  const instance = Bar.properties.get("wrapped")!.type as Model;
  const sourceMapper = instance.templateMapper!;
  expect(sourceMapper.args[0]).toBe(Foo);

  const engine = getEngine(program);
  const instanceNode = engine.getMutationNode(instance);
  const fooNode = engine.getMutationNode(Foo);
  instanceNode.connectTemplateArg(0, fooNode);
  fooNode.mutate();

  expect(instanceNode.isMutated).toBe(true);
  const mutatedMapper = instanceNode.mutatedType.templateMapper!;
  expect(mutatedMapper.args[0]).toBe(fooNode.mutatedType);
  const [parameter] = (sourceMapper as unknown as { map: Map<unknown, unknown> }).map.keys();
  expect(mutatedMapper.getMappedType(parameter as never)).toBe(fooNode.mutatedType);
  // The mutated model got its own mapper; the source mapper is untouched.
  expect(mutatedMapper).not.toBe(sourceMapper);
  expect(instance.templateMapper!.args[0]).toBe(Foo);
  expect(sourceMapper.getMappedType(parameter as never)).toBe(Foo);
});

it("mutates template arguments as part of a model mutation", async () => {
  const { Foo, Bar, program } = await runner.compile(t.code`
      model Wrapper<T> {
        item: T;
      }
      model ${t.model("Foo")} {
        name: string;
      }
      model ${t.model("Bar")} {
        wrapped: Wrapper<Foo>;
      }
    `);
  const instance = Bar.properties.get("wrapped")!.type as Model;

  const engine = new SimpleMutationEngine($(program), {});
  const options = new SimpleMutationOptions();
  const mutation = engine.mutate(instance, options) as SimpleModelMutation<SimpleMutationOptions>;
  const fooMutation = engine.mutate(Foo, options) as SimpleModelMutation<SimpleMutationOptions>;
  expect(mutation.templateArgs.get(0)).toBe(fooMutation);

  // Force the argument to mutate; the instance's mapper must follow.
  fooMutation.mutationNode.mutate((foo: Model) => {
    foo.name = "MutatedFoo";
  });
  const mutatedMapper = mutation.mutatedType.templateMapper!;
  expect(mutatedMapper.args[0]).toBe(fooMutation.mutatedType);
  expect((mutatedMapper.args[0] as Model).name).toBe("MutatedFoo");
  // The `item: T` property and the template argument resolve to the same object.
  expect(mutation.mutatedType.properties.get("item")!.type).toBe(mutatedMapper.args[0]);
  expect(instance.templateMapper!.args[0]).toBe(Foo);
});

it("leaves value template arguments alone", async () => {
  const { Bar, program } = await runner.compile(t.code`
      model Wrapper<T, N extends valueof int32> {
        item: T;
      }
      model ${t.model("Bar")} {
        wrapped: Wrapper<string, 3>;
      }
    `);
  const instance = Bar.properties.get("wrapped")!.type as Model;
  const engine = new SimpleMutationEngine($(program), {});
  const mutation = engine.mutate(
    instance,
    new SimpleMutationOptions(),
  ) as SimpleModelMutation<SimpleMutationOptions>;
  expect(mutation.templateArgs.has(1)).toBe(false);
  mutation.mutationNode.mutate();
  expect(mutation.mutatedType.templateMapper!.args[1]).toBe(instance.templateMapper!.args[1]);
});
