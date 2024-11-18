import { navigateProgram, type Program, type SemanticNodeListener } from "@typespec/compiler";
import type { GraphQLObjectType } from "graphql";

type Mutable<T> = {
  -readonly [k in keyof T]: T[k];
};

// This class contains the registry of all the GraphQL types that are being used in the program
export class GraphQLTypeRegistry {
  program: Program;
  readonly programNavigated: boolean = false;

  constructor(program: Program) {
    this.program = program;
    return new Proxy(this, {
      get(target: GraphQLTypeRegistry, prop: string, receiver) {
        if (GraphQLTypeRegistry.#publicGetters.includes(prop)) {
          if (!target.programNavigated) {
            const mutableThis = target as Mutable<GraphQLTypeRegistry>;
            navigateProgram(target.program, target.#semanticNodeListener);
            mutableThis.programNavigated = true;
          }
        }
        return Reflect.get(target, prop, receiver);
      },
    });
  }

  static get #publicGetters() {
    return Object.entries(Object.getOwnPropertyDescriptors(GraphQLTypeRegistry.prototype))
      .filter(([key, descriptor]) => {
        return typeof descriptor.get === "function" && key !== "constructor";
      })
      .map(([key]) => key);
  }

  get rootQueryType(): GraphQLObjectType | undefined {
    return;
  }

  // This is the listener based on navigateProgram that will walk the TSP AST and register the types,
  // deferred in some cases, and then materialize them in exitXXX functions
  get #semanticNodeListener(): SemanticNodeListener {
    return {};
  }
}
