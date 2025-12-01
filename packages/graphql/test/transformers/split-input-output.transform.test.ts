import { t, type TransformerTesterInstance } from "@typespec/compiler/testing";
import { beforeEach, describe, expect, it } from "vitest";
import { splitInputOutputTransform } from "../../src/transformers/split-input-output.transform.js";
import { Tester } from "../test-host.js";

describe("Model splitting", () => {
  let tester: TransformerTesterInstance;
  beforeEach(async () => {
    tester = await Tester.transformer({
      enable: {
        [`@typespec/graphql/${splitInputOutputTransform.name}`]: true,
      },
    }).createInstance();
  });

  it("creates an input variant for models used in both input and output", async () => {
    const inputTsp = t.code`
        model User {
          id: string;
          name: string;
        }
        
        op getUser(): User;
        op createUser(user: User): User;
      `;
    const transformedTsp = await tester.compile(inputTsp);

    const globalNs = transformedTsp.program.getGlobalNamespaceType();
    const User = globalNs.models.get("User");
    expect(User).toBeDefined();
    expect(User?.name).toBe("User");

    // The input variant should be in the namespace
    const UserInput = globalNs.models.get("UserInput");
    expect(UserInput).toBeDefined();
    expect(UserInput?.name).toBe("UserInput");
    expect(UserInput?.properties.size).toBe(2);
    expect(UserInput?.properties.has("id")).toBe(true);
    expect(UserInput?.properties.has("name")).toBe(true);
  });

  it("does not create input variant for models used only in output", async () => {
    const inputTsp = t.code`
        model User {
          id: string;
          name: string;
        }
        
        op getUser(): User;
      `;
    const transformedTsp = await tester.compile(inputTsp);

    const globalNs = transformedTsp.program.getGlobalNamespaceType();
    const User = globalNs.models.get("User");
    expect(User).toBeDefined();
    expect(User?.name).toBe("User");

    const UserInput = globalNs.models.get("UserInput");
    expect(UserInput).toBeUndefined();
  });

  it("renames models used only in input to have Input suffix", async () => {
    const inputTsp = t.code`
        model CreateUserRequest {
          name: string;
        }
        
        op createUser(request: CreateUserRequest): void;
      `;
    const transformedTsp = await tester.compile(inputTsp);

    // Access the transformedTsp program's global namespace directly
    const globalNs = transformedTsp.program.getGlobalNamespaceType();

    // The renamed model should exist in the namespace
    const CreateUserRequestInput = globalNs.models.get("CreateUserRequestInput");
    expect(CreateUserRequestInput).toBeDefined();
    expect(CreateUserRequestInput?.name).toBe("CreateUserRequestInput");

    // The original name should no longer exist
    const CreateUserRequest = globalNs.models.get("CreateUserRequest");
    expect(CreateUserRequest).toBeUndefined();

    // The operation parameter should reference the renamed model
    const createUser = globalNs.operations.get("createUser");
    expect(createUser).toBeDefined();
    const requestParam = createUser?.parameters.properties.get("request");
    expect(requestParam?.type.kind).toBe("Model");
    if (requestParam?.type.kind === "Model") {
      expect(requestParam.type.name).toBe("CreateUserRequestInput");
    }
  });

  it("appends Input to models only used in input that don't already end with Input", async () => {
    const inputTsp = t.code`
        model CreateUserData {
          name: string;
          email: string;
        }
        
        op createUser(data: CreateUserData): void;
      `;
    const transformedTsp = await tester.compile(inputTsp);

    const globalNs = transformedTsp.program.getGlobalNamespaceType();

    // The renamed model should exist in the namespace
    const CreateUserDataInput = globalNs.models.get("CreateUserDataInput");
    expect(CreateUserDataInput).toBeDefined();
    expect(CreateUserDataInput?.name).toBe("CreateUserDataInput");

    // The original name should no longer exist
    const CreateUserData = globalNs.models.get("CreateUserData");
    expect(CreateUserData).toBeUndefined();

    // The operation parameter should reference the renamed model
    const createUser = globalNs.operations.get("createUser");
    const dataParam = createUser?.parameters.properties.get("data");
    expect(dataParam?.type.kind).toBe("Model");
    if (dataParam?.type.kind === "Model") {
      expect(dataParam.type.name).toBe("CreateUserDataInput");
    }
  });
});

describe("Operation parameter type references", () => {
  let tester: TransformerTesterInstance;
  beforeEach(async () => {
    tester = await Tester.transformer({
      enable: {
        [`@typespec/graphql/${splitInputOutputTransform.name}`]: true,
      },
    }).createInstance();
  });

  it("updates operation parameters to use input variants", async () => {
    const inputTsp = t.code`
        model User {
          id: string;
          name: string;
        }
        
        op createUser(user: User): User;
      `;
    const transformedTsp = await tester.compile(inputTsp);

    const globalNs = transformedTsp.program.getGlobalNamespaceType();
    const createUser = globalNs.operations.get("createUser");
    expect(createUser).toBeDefined();

    // The parameter's type should be UserInput
    const userParam = createUser?.parameters.properties.get("user");
    expect(userParam).toBeDefined();
    expect(userParam!.type.kind).toBe("Model");
    expect((userParam!.type as any).name).toBe("UserInput");
  });

  it("keeps return types as regular models", async () => {
    const inputTsp = t.code`
        model User {
          id: string;
          name: string;
        }
        
        op createUser(user: User): User;
      `;
    const transformedTsp = await tester.compile(inputTsp);

    const globalNs = transformedTsp.program.getGlobalNamespaceType();
    const createUser = globalNs.operations.get("createUser");
    expect(createUser).toBeDefined();

    // The return type should be User (not UserInput)
    expect(createUser?.returnType.kind).toBe("Model");
    expect((createUser?.returnType as any).name).toBe("User");
  });
});

describe("Nested model references", () => {
  let tester: TransformerTesterInstance;
  beforeEach(async () => {
    tester = await Tester.transformer({
      enable: {
        [`@typespec/graphql/${splitInputOutputTransform.name}`]: true,
      },
    }).createInstance();
  });

  it("updates nested model properties in input variants", async () => {
    const inputTsp = t.code`
        model Address {
          street: string;
          city: string;
        }
        
        model User {
          id: string;
          address: Address;
        }
        
        op getUser(): User;
        op createUser(user: User): User;
        op updateAddress(address: Address): Address;
      `;
    const transformedTsp = await tester.compile(inputTsp);

    const globalNs = transformedTsp.program.getGlobalNamespaceType();

    // Debug: print all models
    console.error("Models in namespace:");
    for (const [name, model] of globalNs.models) {
      console.error(`  ${name}: ${model.properties.size} properties`);
      for (const [propName, prop] of model.properties) {
        const typeName = prop.type.kind === "Model" ? prop.type.name : prop.type.kind;
        console.error(`    ${propName}: ${typeName}`);
      }
    }

    //Get UserInput from namespace
    const UserInput = globalNs.models.get("UserInput");
    expect(UserInput).toBeDefined();

    // UserInput should have an address property that references AddressInput
    const addressProp = UserInput?.properties.get("address");
    expect(addressProp).toBeDefined();
    expect(addressProp!.type.kind).toBe("Model");
    expect((addressProp!.type as any).name).toBe("AddressInput");
  });

  it("handles deeply nested model references", async () => {
    const inputTsp = t.code`
        model Country {
          name: string;
          code: string;
        }
        
        model Address {
          street: string;
          country: Country;
        }
        
        model User {
          id: string;
          address: Address;
        }
        
        op getUser(): User;
        op createUser(user: User): User;
        op updateAddress(address: Address): Address;
        op updateCountry(country: Country): Country;
      `;
    const transformedTsp = await tester.compile(inputTsp);

    const globalNs = transformedTsp.program.getGlobalNamespaceType();

    // Get UserInput from namespace
    const UserInput = globalNs.models.get("UserInput");
    expect(UserInput).toBeDefined();

    // UserInput.address should reference AddressInput
    const addressProp = UserInput?.properties.get("address");
    expect(addressProp).toBeDefined();
    expect(addressProp!.type.kind).toBe("Model");
    expect((addressProp!.type as any).name).toBe("AddressInput");

    // AddressInput.country should reference CountryInput
    const AddressInput = addressProp!.type as any;
    const countryProp = AddressInput.properties.get("country");
    expect(countryProp).toBeDefined();
    expect(countryProp.type.kind).toBe("Model");
    expect(countryProp.type.name).toBe("CountryInput");
  });

  it("updates nested parameter types to use input variants", async () => {
    const inputTsp = t.code`
        model Address {
          street: string;
          city: string;
        }
        
        model User {
          id: string;
          address: Address;
        }
        
        op getUser(): User;
        op updateUser(user: User): User;
        op getAddress(): Address;
        op updateAddress(address: Address): Address;
      `;
    const transformedTsp = await tester.compile(inputTsp);

    const globalNs = transformedTsp.program.getGlobalNamespaceType();
    const updateUser = globalNs.operations.get("updateUser");
    expect(updateUser).toBeDefined();

    // updateUser's user parameter should be UserInput
    const userParam = updateUser?.parameters.properties.get("user");
    expect(userParam).toBeDefined();
    expect(userParam!.type.kind).toBe("Model");
    expect((userParam!.type as any).name).toBe("UserInput");

    // And its address property should reference AddressInput
    const UserInput = userParam!.type as any;
    const addressProp = UserInput.properties.get("address");
    expect(addressProp).toBeDefined();
    expect(addressProp.type.kind).toBe("Model");
    expect(addressProp.type.name).toBe("AddressInput");
  });
});

describe("Multiple operations", () => {
  let tester: TransformerTesterInstance;
  beforeEach(async () => {
    tester = await Tester.transformer({
      enable: {
        [`@typespec/graphql/${splitInputOutputTransform.name}`]: true,
      },
    }).createInstance();
  });

  it("correctly splits models used across multiple operations", async () => {
    const inputTsp = t.code`
        model User {
          id: string;
          name: string;
          email: string;
        }
        
        op createUser(user: User): User;
        op updateUser(id: string, user: User): User;
        op deleteUser(id: string): User;
      `;
    const transformedTsp = await tester.compile(inputTsp);

    const globalNs = transformedTsp.program.getGlobalNamespaceType();

    // Should create both User and UserInput
    const User = globalNs.models.get("User");
    expect(User).toBeDefined();
    expect(User?.name).toBe("User");

    const UserInput = globalNs.models.get("UserInput");
    expect(UserInput).toBeDefined();
    expect(UserInput?.name).toBe("UserInput");

    // createUser parameters should use UserInput
    const createUser = globalNs.operations.get("createUser");
    const createUserParam = createUser?.parameters.properties.get("user");
    expect((createUserParam!.type as any).name).toBe("UserInput");

    // updateUser parameters should use UserInput
    const updateUser = globalNs.operations.get("updateUser");
    const updateUserParam = updateUser?.parameters.properties.get("user");
    expect((updateUserParam!.type as any).name).toBe("UserInput");

    // All return types should use User (not UserInput)
    const deleteUser = globalNs.operations.get("deleteUser");
    expect((createUser?.returnType as any).name).toBe("User");
    expect((updateUser?.returnType as any).name).toBe("User");
    expect((deleteUser?.returnType as any).name).toBe("User");
  });
});

describe("Preserves model structure", () => {
  let tester: TransformerTesterInstance;
  beforeEach(async () => {
    tester = await Tester.transformer({
      enable: {
        [`@typespec/graphql/${splitInputOutputTransform.name}`]: true,
      },
    }).createInstance();
  });

  it("preserves all properties in input variant", async () => {
    const inputTsp = t.code`
        model User {
          id: string;
          name: string;
          email: string;
          age: int32;
          isActive: boolean;
        }
        
        op getUser(): User;
        op createUser(user: User): User;
      `;
    const transformedTsp = await tester.compile(inputTsp);

    const globalNs = transformedTsp.program.getGlobalNamespaceType();
    const UserInput = globalNs.models.get("UserInput");
    expect(UserInput).toBeDefined();
    expect(UserInput?.properties.size).toBe(5);
    expect(UserInput?.properties.has("id")).toBe(true);
    expect(UserInput?.properties.has("name")).toBe(true);
    expect(UserInput?.properties.has("email")).toBe(true);
    expect(UserInput?.properties.has("age")).toBe(true);
    expect(UserInput?.properties.has("isActive")).toBe(true);
  });

  it("preserves property types in input variant", async () => {
    const inputTsp = t.code`
        model User {
          id: string;
          age: int32;
          isActive: boolean;
        }
        
        op getUser(): User;
        op createUser(user: User): User;
      `;
    const transformedTsp = await tester.compile(inputTsp);

    const globalNs = transformedTsp.program.getGlobalNamespaceType();
    const UserInput = globalNs.models.get("UserInput");
    expect(UserInput).toBeDefined();
    const idProp = UserInput?.properties.get("id");
    const ageProp = UserInput?.properties.get("age");
    const isActiveProp = UserInput?.properties.get("isActive");

    expect(idProp!.type.kind).toBe("Scalar");
    expect((idProp!.type as any).name).toBe("string");
    expect(ageProp!.type.kind).toBe("Scalar");
    expect((ageProp!.type as any).name).toBe("int32");
    expect(isActiveProp!.type.kind).toBe("Scalar");
    expect((isActiveProp!.type as any).name).toBe("boolean");
  });
});

describe("Edge cases", () => {
  let tester: TransformerTesterInstance;
  beforeEach(async () => {
    tester = await Tester.transformer({
      enable: {
        [`@typespec/graphql/${splitInputOutputTransform.name}`]: true,
      },
    }).createInstance();
  });

  it("handles models with no properties", async () => {
    const inputTsp = t.code`
        model Empty {}
        
        op getEmpty(): Empty;
        op createEmpty(empty: Empty): Empty;
      `;
    const transformedTsp = await tester.compile(inputTsp);

    const globalNs = transformedTsp.program.getGlobalNamespaceType();
    const Empty = globalNs.models.get("Empty");
    expect(Empty).toBeDefined();
    expect(Empty?.name).toBe("Empty");

    const EmptyInput = globalNs.models.get("EmptyInput");
    expect(EmptyInput).toBeDefined();
    expect(EmptyInput?.name).toBe("EmptyInput");
    expect(EmptyInput?.properties.size).toBe(0);
  });

  it("handles circular model references", async () => {
    const inputTsp = t.code`
        model Node {
          value: string;
          next?: Node;
        }
        
        op getNode(): Node;
        op createNode(node: Node): Node;
      `;
    const transformedTsp = await tester.compile(inputTsp);

    const globalNs = transformedTsp.program.getGlobalNamespaceType();
    const Node = globalNs.models.get("Node");
    expect(Node).toBeDefined();
    expect(Node?.name).toBe("Node");

    const NodeInput = globalNs.models.get("NodeInput");
    expect(NodeInput).toBeDefined();
    expect(NodeInput?.name).toBe("NodeInput");

    // NodeInput should have a next property
    const nextProp = NodeInput?.properties.get("next");
    expect(nextProp).toBeDefined();
    expect(nextProp!.type).toBeDefined();
  });

  it("handles mutually recursive models", async () => {
    const inputTsp = t.code`
        model Person {
          name: string;
          bestFriend?: Friend;
        }
        
        model Friend {
          name: string;
          person?: Person;
        }
        
        op getPerson(): Person;
        op createPerson(person: Person): Person;
        op createFriend(friend: Friend): Friend;
      `;
    const transformedTsp = await tester.compile(inputTsp);

    const globalNs = transformedTsp.program.getGlobalNamespaceType();

    // Both models should have input variants
    const PersonInput = globalNs.models.get("PersonInput");
    expect(PersonInput).toBeDefined();
    expect(PersonInput?.name).toBe("PersonInput");

    const FriendInput = globalNs.models.get("FriendInput");
    expect(FriendInput).toBeDefined();
    expect(FriendInput?.name).toBe("FriendInput");

    // PersonInput.bestFriend should reference FriendInput
    const bestFriendProp = PersonInput?.properties.get("bestFriend");
    expect(bestFriendProp).toBeDefined();
    if (bestFriendProp?.type.kind === "Model") {
      expect(bestFriendProp.type.name).toBe("FriendInput");
    }

    // FriendInput.person should reference PersonInput
    const personProp = FriendInput?.properties.get("person");
    expect(personProp).toBeDefined();
    if (personProp?.type.kind === "Model") {
      expect(personProp.type.name).toBe("PersonInput");
    }
  });
});
