import {
  navigateTypesInNamespace,
  type Model,
  type Namespace,
  type Type,
} from "@typespec/compiler";
import { t } from "@typespec/compiler/testing";
import { $ } from "@typespec/compiler/typekit";
import { describe, expect, it } from "vitest";
import { Tester } from "../test/test-host.js";
import {
  SimpleModelMutation,
  SimpleMutationEngine,
  SimpleMutationOptions,
} from "./mutation/simple-mutation-engine.js";
import { buildTypeGraph } from "./type-graph.js";

/**
 * Helper to get the user-defined namespace from a compiled program.
 * Avoids passing the global namespace (which includes TypeSpec stdlib).
 */
function getUserNamespace(program: any, name: string): Namespace {
  return program.getGlobalNamespaceType().namespaces.get(name)!;
}

describe("buildTypeGraph", () => {
  it("produces a fully independent namespace tree", async () => {
    const runner = await Tester.createInstance();
    const { Foo, program } = await runner.compile(t.code`
      namespace TestNs {
        model ${t.model("Foo")} {
          name: string;
        }
      }
    `);

    const tk = $(program);
    const ns = getUserNamespace(program, "TestNs");
    const graph = buildTypeGraph(tk, ns);

    // The output namespace is not the same object as the input
    expect(graph.globalNamespace).not.toBe(ns);

    // The model in the output is not the same object as the original
    const outputFoo = graph.globalNamespace.models.get("Foo");
    expect(outputFoo).toBeDefined();
    expect(outputFoo).not.toBe(Foo);
    expect(outputFoo!.name).toBe("Foo");
  });

  it("sets .namespace on all member types to the new namespace", async () => {
    const runner = await Tester.createInstance();
    const { Foo, program } = await runner.compile(t.code`
      namespace TestNs {
        model ${t.model("Foo")} {
          name: string;
        }
      }
    `);

    const tk = $(program);
    const ns = getUserNamespace(program, "TestNs");
    const graph = buildTypeGraph(tk, ns);

    const outputFoo = graph.globalNamespace.models.get("Foo")!;
    expect(outputFoo.namespace).toBe(graph.globalNamespace);
  });

  it("works with navigateTypesInNamespace", async () => {
    const runner = await Tester.createInstance();
    const { program } = await runner.compile(t.code`
      namespace TestNs {
        model ${t.model("Foo")} {
          name: string;
        }

        model ${t.model("Bar")} {
          value: int32;
        }
      }
    `);

    const tk = $(program);
    const ns = getUserNamespace(program, "TestNs");
    const graph = buildTypeGraph(tk, ns);

    // navigateTypesInNamespace should visit all types in the cloned namespace
    const visitedModels: string[] = [];
    navigateTypesInNamespace(graph.globalNamespace, {
      model: (m) => {
        visitedModels.push(m.name);
      },
    });

    expect(visitedModels).toContain("Foo");
    expect(visitedModels).toContain("Bar");
  });

  it("substitutes mutated types from the mutations map", async () => {
    const runner = await Tester.createInstance();
    const { Foo, program } = await runner.compile(t.code`
      namespace TestNs {
        model ${t.model("Foo")} {
          name: string;
        }
      }
    `);

    const tk = $(program);
    const ns = getUserNamespace(program, "TestNs");

    // Create a mutated version of Foo
    const mutatedFoo = tk.type.clone(Foo);
    mutatedFoo.name = "FooRenamed";

    const mutations = new Map<Type, Type>();
    mutations.set(Foo, mutatedFoo);

    const graph = buildTypeGraph(tk, ns, { mutations });

    // The mutated model should be in the output under its original key
    const outputFoo = graph.globalNamespace.models.get("Foo")!;
    expect(outputFoo.name).toBe("FooRenamed");
    expect(outputFoo.namespace).toBe(graph.globalNamespace);
  });

  it("removes types listed in deletions", async () => {
    const runner = await Tester.createInstance();
    const { Foo, program } = await runner.compile(t.code`
      namespace TestNs {
        model ${t.model("Foo")} {
          name: string;
        }

        model ${t.model("Bar")} {
          value: int32;
        }
      }
    `);

    const tk = $(program);
    const ns = getUserNamespace(program, "TestNs");

    const graph = buildTypeGraph(tk, ns, { deletions: new Set([Foo]) });

    expect(graph.globalNamespace.models.has("Foo")).toBe(false);
    expect(graph.globalNamespace.models.has("Bar")).toBe(true);
  });

  it("adds synthetic types from additions", async () => {
    const runner = await Tester.createInstance();
    const { Foo, program } = await runner.compile(t.code`
      namespace TestNs {
        model ${t.model("Foo")} {
          name: string;
        }
      }
    `);

    const tk = $(program);
    const ns = getUserNamespace(program, "TestNs");

    // Create a synthetic model
    const syntheticModel = tk.type.clone(Foo);
    syntheticModel.name = "SyntheticModel";

    const graph = buildTypeGraph(tk, ns, { additions: [syntheticModel] });

    expect(graph.globalNamespace.models.has("SyntheticModel")).toBe(true);
    const output = graph.globalNamespace.models.get("SyntheticModel")!;
    expect(output.namespace).toBe(graph.globalNamespace);
  });

  it("preserves decorators on cloned types", async () => {
    const runner = await Tester.createInstance();
    const { Foo, program } = await runner.compile(t.code`
      namespace TestNs {
        @doc("A foo model")
        model ${t.model("Foo")} {
          name: string;
        }
      }
    `);

    const tk = $(program);
    const ns = getUserNamespace(program, "TestNs");
    const graph = buildTypeGraph(tk, ns);

    const outputFoo = graph.globalNamespace.models.get("Foo")!;
    // Decorators should be preserved on the clone
    expect(outputFoo.decorators.length).toBeGreaterThan(0);
  });

  it("handles sub-namespaces recursively", async () => {
    const runner = await Tester.createInstance();
    const { program } = await runner.compile(t.code`
      namespace TestNs {
        namespace Inner {
          model ${t.model("Nested")} {
            name: string;
          }
        }
      }
    `);

    const tk = $(program);
    const ns = getUserNamespace(program, "TestNs");
    const graph = buildTypeGraph(tk, ns);

    const inner = graph.globalNamespace.namespaces.get("Inner");
    expect(inner).toBeDefined();
    expect(inner!.namespace).toBe(graph.globalNamespace);

    const nestedModel = inner!.models.get("Nested");
    expect(nestedModel).toBeDefined();
    expect(nestedModel!.namespace).toBe(inner);
  });

  it("mutated types with decorators added during mutation are preserved", async () => {
    const runner = await Tester.createInstance();
    const { Foo, program } = await runner.compile(t.code`
      namespace TestNs {
        model ${t.model("Foo")} {
          name: string;
        }
      }
    `);

    const tk = $(program);
    const ns = getUserNamespace(program, "TestNs");

    // Simulate a mutation that adds a decorator
    const mutatedFoo = tk.type.clone(Foo);
    const fakeDecorator = () => {};
    mutatedFoo.decorators.push({ decorator: fakeDecorator as any, args: [] });

    const mutations = new Map<Type, Type>();
    mutations.set(Foo, mutatedFoo);

    const graph = buildTypeGraph(tk, ns, { mutations });

    const outputFoo = graph.globalNamespace.models.get("Foo")!;
    // The decorator added during mutation should be present
    expect(outputFoo.decorators.some((d) => d.decorator === fakeDecorator)).toBe(true);
  });
});

/**
 * A simple rename mutation for integration testing.
 * Appends "GQL" to model names.
 */
class RenameModelMutation extends SimpleModelMutation<SimpleMutationOptions> {
  mutate() {
    this.mutationNode.mutate((type) => {
      type.name = `${this.sourceType.name}GQL`;
    });
    super.mutate();
  }
}

describe("MutationEngine → buildTypeGraph integration", () => {
  it("produces a TypeGraph from engine-mutated types", async () => {
    const runner = await Tester.createInstance();
    const { Foo, Bar, program } = await runner.compile(t.code`
      namespace TestNs {
        model ${t.model("Foo")} {
          name: string;
        }

        model ${t.model("Bar")} {
          value: int32;
        }
      }
    `);

    const tk = $(program);
    const ns = getUserNamespace(program, "TestNs");

    // Step 1: Run the mutation engine on each model
    const engine = new SimpleMutationEngine<{ Model: RenameModelMutation }>(tk, {
      Model: RenameModelMutation,
    });

    const fooMutation = engine.mutate(Foo);
    const barMutation = engine.mutate(Bar);

    // Step 2: Collect mutations into a Map<Type, Type>
    const mutations = new Map<Type, Type>();
    mutations.set(Foo, fooMutation.mutatedType);
    mutations.set(Bar, barMutation.mutatedType);

    // Step 3: Build the TypeGraph
    const graph = buildTypeGraph(tk, ns, { mutations });

    // Verify: mutated types are in the output namespace
    const outputFoo = graph.globalNamespace.models.get("Foo")!;
    expect(outputFoo.name).toBe("FooGQL");
    expect(outputFoo.namespace).toBe(graph.globalNamespace);

    const outputBar = graph.globalNamespace.models.get("Bar")!;
    expect(outputBar.name).toBe("BarGQL");
    expect(outputBar.namespace).toBe(graph.globalNamespace);
  });

  it("TypeGraph output works with navigateTypesInNamespace", async () => {
    const runner = await Tester.createInstance();
    const { Foo, Bar, program } = await runner.compile(t.code`
      namespace TestNs {
        model ${t.model("Foo")} {
          name: string;
        }

        model ${t.model("Bar")} {
          value: int32;
        }
      }
    `);

    const tk = $(program);
    const ns = getUserNamespace(program, "TestNs");

    // Mutate only Foo, leave Bar unmutated
    const engine = new SimpleMutationEngine<{ Model: RenameModelMutation }>(tk, {
      Model: RenameModelMutation,
    });
    const fooMutation = engine.mutate(Foo);

    const mutations = new Map<Type, Type>();
    mutations.set(Foo, fooMutation.mutatedType);

    const graph = buildTypeGraph(tk, ns, { mutations });

    // navigateTypesInNamespace should find both models in the output
    const visitedModels: string[] = [];
    navigateTypesInNamespace(graph.globalNamespace, {
      model: (m) => visitedModels.push(m.name),
    });

    expect(visitedModels).toContain("FooGQL");
    expect(visitedModels).toContain("Bar");
  });

  it("supports chained stages: TypeGraph → engine → TypeGraph", async () => {
    const runner = await Tester.createInstance();
    const { Foo, program } = await runner.compile(t.code`
      namespace TestNs {
        model ${t.model("Foo")} {
          name: string;
        }
      }
    `);

    const tk = $(program);
    const ns = getUserNamespace(program, "TestNs");

    // Stage 1: Rename Foo → FooGQL
    const engine1 = new SimpleMutationEngine<{ Model: RenameModelMutation }>(tk, {
      Model: RenameModelMutation,
    });
    const mutation1 = engine1.mutate(Foo);
    const mutations1 = new Map<Type, Type>();
    mutations1.set(Foo, mutation1.mutatedType);
    const graph1 = buildTypeGraph(tk, ns, { mutations: mutations1 });

    // Stage 2: Take the output of stage 1, mutate again
    const engine2 = new SimpleMutationEngine<{ Model: RenameModelMutation }>(tk, {
      Model: RenameModelMutation,
    });
    const stage2Input = graph1.globalNamespace.models.get("Foo")!;
    const mutation2 = engine2.mutate(stage2Input);
    const mutations2 = new Map<Type, Type>();
    mutations2.set(stage2Input, mutation2.mutatedType);
    const graph2 = buildTypeGraph(tk, graph1.globalNamespace, { mutations: mutations2 });

    // After two stages: Foo → FooGQL → FooGQLGQL
    const finalFoo = graph2.globalNamespace.models.get("Foo")!;
    expect(finalFoo.name).toBe("FooGQLGQL");
    expect(finalFoo.namespace).toBe(graph2.globalNamespace);

    // Each graph is independent
    expect(graph2.globalNamespace).not.toBe(graph1.globalNamespace);

    // navigateTypesInNamespace works on the final output
    const visited: string[] = [];
    navigateTypesInNamespace(graph2.globalNamespace, {
      model: (m) => visited.push(m.name),
    });
    expect(visited).toContain("FooGQLGQL");
  });
});
