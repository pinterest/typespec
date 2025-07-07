import type { Model, Namespace } from "@typespec/compiler";
import { UsageFlags } from "@typespec/compiler";
import { expectDiagnosticEmpty } from "@typespec/compiler/testing";
import { describe, expect, it } from "vitest";
import { GraphQLDenormalizer } from "../src/denormalization.js";
import { compileAndDiagnose } from "./test-host.js";

describe("GraphQLDenormalizer", () => {
  describe("expandInputOutputTypes", () => {
    it("should create input model variant for models used as input", async () => {
      const [program, { TestNamespace }, diagnostics] = await compileAndDiagnose<{
        TestNamespace: Namespace;
      }>(`
        @test namespace TestNamespace {
          model User {
            name: string;
            age: int32;
          }
        }
      `);
      expectDiagnosticEmpty(diagnostics);
      
      // Create a mock usage tracker that marks User as used for input
      const mockUsageTracker = {
        isUsedAs: (model: Model, flag: UsageFlags) => {
          if (model.name === "User" && flag === UsageFlags.Input) {
            return true;
          }
          return false;
        }
      };
      
      const userModel = TestNamespace.models.get("User")!;
      expect(userModel).toBeDefined();
      expect(TestNamespace.models.has("UserInput")).toBe(false);
      
      // Run denormalization
      GraphQLDenormalizer.expandInputOutputTypes(
        userModel,
        mockUsageTracker as any,
        { program } as any,
        TestNamespace,
        false // no debug output
      );
      
      // Check that UserInput was created
      expect(TestNamespace.models.has("UserInput")).toBe(true);
      const userInputModel = TestNamespace.models.get("UserInput")!;
      expect(userInputModel.name).toBe("UserInput");
      expect(userInputModel.properties.size).toBe(2);
      expect(userInputModel.properties.has("name")).toBe(true);
      expect(userInputModel.properties.has("age")).toBe(true);
    });

    it("should skip models not used as input", async () => {
      const [program, { TestNamespace }, diagnostics] = await compileAndDiagnose<{
        TestNamespace: Namespace;
      }>(`
        @test namespace TestNamespace {
          model User {
            name: string;
            age: int32;
          }
        }
      `);
      expectDiagnosticEmpty(diagnostics);
      
      // Create a mock usage tracker that does NOT mark User as used for input
      const mockUsageTracker = {
        isUsedAs: (model: Model, flag: UsageFlags) => {
          return false; // User is not used as input
        }
      };
      
      const userModel = TestNamespace.models.get("User")!;
      expect(userModel).toBeDefined();
      expect(TestNamespace.models.has("UserInput")).toBe(false);
      
      // Run denormalization
      GraphQLDenormalizer.expandInputOutputTypes(
        userModel,
        mockUsageTracker as any,
        { program } as any,
        TestNamespace,
        false
      );
      
      // Check that UserInput was NOT created
      expect(TestNamespace.models.has("UserInput")).toBe(false);
    });

    it("should handle recursive denormalization of nested models", async () => {
      const [program, { TestNamespace }, diagnostics] = await compileAndDiagnose<{
        TestNamespace: Namespace;
      }>(`
        @test namespace TestNamespace {
          model Address {
            street: string;
            city: string;
          }
          
          model User {
            name: string;
            address: Address;
          }
        }
      `);
      expectDiagnosticEmpty(diagnostics);
      
      // Create a mock usage tracker that marks both User and Address as used for input
      const mockUsageTracker = {
        isUsedAs: (model: Model, flag: UsageFlags) => {
          if (flag === UsageFlags.Input && (model.name === "User" || model.name === "Address")) {
            return true;
          }
          return false;
        }
      };
      
      const userModel = TestNamespace.models.get("User")!;
      const addressModel = TestNamespace.models.get("Address")!;
      expect(userModel).toBeDefined();
      expect(addressModel).toBeDefined();
      expect(TestNamespace.models.has("UserInput")).toBe(false);
      expect(TestNamespace.models.has("AddressInput")).toBe(false);
      
      // Run denormalization on User (should recursively handle Address)
      GraphQLDenormalizer.expandInputOutputTypes(
        userModel,
        mockUsageTracker as any,
        { program } as any,
        TestNamespace,
        false
      );
      
      // Check that both UserInput and AddressInput were created
      expect(TestNamespace.models.has("UserInput")).toBe(true);
      expect(TestNamespace.models.has("AddressInput")).toBe(true);
      
      const userInputModel = TestNamespace.models.get("UserInput")!;
      const addressInputModel = TestNamespace.models.get("AddressInput")!;
      
      // Verify UserInput has correct properties
      expect(userInputModel.name).toBe("UserInput");
      expect(userInputModel.properties.size).toBe(2);
      expect(userInputModel.properties.has("name")).toBe(true);
      expect(userInputModel.properties.has("address")).toBe(true);
      
      // Verify AddressInput has correct properties
      expect(addressInputModel.name).toBe("AddressInput");
      expect(addressInputModel.properties.size).toBe(2);
      expect(addressInputModel.properties.has("street")).toBe(true);
      expect(addressInputModel.properties.has("city")).toBe(true);
    });

    it("should throw error on name collision", async () => {
      const [program, { TestNamespace }, diagnostics] = await compileAndDiagnose<{
        TestNamespace: Namespace;
      }>(`
        @test namespace TestNamespace {
          model User {
            name: string;
          }
          
          model UserInput {
            name: string;
          }
        }
      `);
      expectDiagnosticEmpty(diagnostics);
      
      // Create a mock usage tracker that marks User as used for input
      const mockUsageTracker = {
        isUsedAs: (model: Model, flag: UsageFlags) => {
          if (model.name === "User" && flag === UsageFlags.Input) {
            return true;
          }
          return false;
        }
      };
      
      const userModel = TestNamespace.models.get("User")!;
      expect(userModel).toBeDefined();
      expect(TestNamespace.models.has("UserInput")).toBe(true); // Already exists
      
      // Run denormalization - should throw error due to name collision
      expect(() => {
        GraphQLDenormalizer.expandInputOutputTypes(
          userModel,
          mockUsageTracker as any,
          { program } as any,
          TestNamespace,
          false
        );
      }).toThrow("Model name collision: UserInput already exists in namespace.");
    });

    it("should handle models with optional properties", async () => {
      const [program, { TestNamespace }, diagnostics] = await compileAndDiagnose<{
        TestNamespace: Namespace;
      }>(`
        @test namespace TestNamespace {
          model User {
            name: string;
            email?: string;
            age?: int32;
          }
        }
      `);
      expectDiagnosticEmpty(diagnostics);
      
      // Create a mock usage tracker that marks User as used for input
      const mockUsageTracker = {
        isUsedAs: (model: Model, flag: UsageFlags) => {
          if (model.name === "User" && flag === UsageFlags.Input) {
            return true;
          }
          return false;
        }
      };
      
      const userModel = TestNamespace.models.get("User")!;
      expect(userModel).toBeDefined();
      
      // Run denormalization
      GraphQLDenormalizer.expandInputOutputTypes(
        userModel,
        mockUsageTracker as any,
        { program } as any,
        TestNamespace,
        false
      );
      
      // Check that UserInput was created with correct optional properties
      expect(TestNamespace.models.has("UserInput")).toBe(true);
      const userInputModel = TestNamespace.models.get("UserInput")!;
      
      expect(userInputModel.name).toBe("UserInput");
      expect(userInputModel.properties.size).toBe(3);
      
      const nameProperty = userInputModel.properties.get("name")!;
      const emailProperty = userInputModel.properties.get("email")!;
      const ageProperty = userInputModel.properties.get("age")!;
      
      expect(nameProperty.optional).toBe(false);
      expect(emailProperty.optional).toBe(true);
      expect(ageProperty.optional).toBe(true);
    });
  });

  describe("denormalize", () => {
    it("should denormalize all models in namespace that are used as input", async () => {
      const [program, { TestNamespace }, diagnostics] = await compileAndDiagnose<{
        TestNamespace: Namespace;
      }>(`
        @test namespace TestNamespace {
          model User {
            name: string;
            age: int32;
          }
          
          model Book {
            title: string;
            author: string;
          }
          
          model ReadOnlyModel {
            id: string;
          }
        }
      `);
      expectDiagnosticEmpty(diagnostics);
      
      // Create a mock usage tracker
      const mockUsageTracker = {
        isUsedAs: (model: Model, flag: UsageFlags) => {
          if (flag === UsageFlags.Input && (model.name === "User" || model.name === "Book")) {
            return true;
          }
          return false;
        }
      };
      
      expect(TestNamespace.models.has("UserInput")).toBe(false);
      expect(TestNamespace.models.has("BookInput")).toBe(false);
      expect(TestNamespace.models.has("ReadOnlyModelInput")).toBe(false);
      
      // Run denormalization
      GraphQLDenormalizer.denormalize(
        TestNamespace,
        mockUsageTracker as any,
        { program } as any,
        false // no debug output
      );
      
      // Check that input models were created for User and Book, but not ReadOnlyModel
      expect(TestNamespace.models.has("UserInput")).toBe(true);
      expect(TestNamespace.models.has("BookInput")).toBe(true);
      expect(TestNamespace.models.has("ReadOnlyModelInput")).toBe(false);
      
      const userInputModel = TestNamespace.models.get("UserInput")!;
      const bookInputModel = TestNamespace.models.get("BookInput")!;
      
      expect(userInputModel.name).toBe("UserInput");
      expect(userInputModel.properties.size).toBe(2);
      
      expect(bookInputModel.name).toBe("BookInput");
      expect(bookInputModel.properties.size).toBe(2);
    });
  });

  describe("createInputModelVariant", () => {
    it("should create input model variant with correct properties", async () => {
      const [program, { TestNamespace }, diagnostics] = await compileAndDiagnose<{
        TestNamespace: Namespace;
      }>(`
        @test namespace TestNamespace {
          model User {
            name: string;
            age: int32;
            active: boolean;
          }
        }
      `);
      expectDiagnosticEmpty(diagnostics);
      
      const userModel = TestNamespace.models.get("User")!;
      expect(userModel).toBeDefined();
      
      // Mock typekit
      const mockTypekit = {
        modelProperty: {
          create: (props: any) => ({
            name: props.name,
            type: props.type,
            optional: props.optional,
          }),
        },
        model: {
          create: (props: any) => ({
            name: props.name,
            properties: new Map(Object.entries(props.properties)),
          }),
        },
      };
      
      // Mock getInputType function
      const getInputType = (type: any) => type;
      
      // Create input model variant
      const inputModel = GraphQLDenormalizer.createInputModelVariant(
        userModel,
        mockTypekit as any,
        getInputType
      );
      
      expect(inputModel.name).toBe("UserInput");
      expect(inputModel.properties.size).toBe(3);
      expect(inputModel.properties.has("name")).toBe(true);
      expect(inputModel.properties.has("age")).toBe(true);
      expect(inputModel.properties.has("active")).toBe(true);
    });
  });
});
