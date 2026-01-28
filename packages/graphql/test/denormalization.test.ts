import type { Model, Namespace } from "@typespec/compiler";
import { UsageFlags } from "@typespec/compiler";
import { expectDiagnosticEmpty } from "@typespec/compiler/testing";
import { describe, expect, it } from "vitest";
import { GraphQLTSPDenormalizer } from "../src/denormalization.js";
import { compileAndDiagnose } from "./test-host.js";

describe("GraphQLTSPDenormalizer", () => {
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
          
          op CreateUser(user: User): User;
          op CreateBook(book: Book): Book;
          op GetReadOnlyModel(): ReadOnlyModel;
        }
      `);
      expectDiagnosticEmpty(diagnostics);
      
      expect(TestNamespace.models.has("UserInput")).toBe(false);
      expect(TestNamespace.models.has("BookInput")).toBe(false);
      expect(TestNamespace.models.has("ReadOnlyModelInput")).toBe(false);
      
      // Create denormalizer instance and run denormalization
      const denormalizer = new GraphQLTSPDenormalizer(TestNamespace, { program } as any);
      denormalizer.denormalize(false); // no debug output
      
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
      
      const userModel = TestNamespace.models.get("User")!;
      expect(userModel).toBeDefined();
      expect(TestNamespace.models.has("UserInput")).toBe(false);
      
      // Create denormalizer instance  
      const denormalizer = new GraphQLTSPDenormalizer(TestNamespace, { program } as any);
      
      // Override the usage tracker for testing specific behavior
      (denormalizer as any).usageTracker = {
        isUsedAs: (model: Model, flag: UsageFlags) => {
          if (model.name === "User" && flag === UsageFlags.Input) {
            return true;
          }
          return false;
        }
      };
      
      // Run denormalization (testing the low-level method for specific behavior)
      denormalizer.expandInputOutputTypes(userModel, false);
      
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
          
          // No operation uses User as input, so it should be skipped
          op GetUser(): User;
        }
      `);
      expectDiagnosticEmpty(diagnostics);
      
      const userModel = TestNamespace.models.get("User")!;
      expect(userModel).toBeDefined();
      expect(TestNamespace.models.has("UserInput")).toBe(false);
      
      // Run denormalization
      const denormalizer = new GraphQLTSPDenormalizer(TestNamespace, { program } as any);
      denormalizer.expandInputOutputTypes(userModel, false);
      
      // Check that UserInput was NOT created since User is not used as input
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
          
          // Operations that use User and Address as input
          op CreateUser(user: User): User;
          op UpdateAddress(address: Address): Address;
        }
      `);
      expectDiagnosticEmpty(diagnostics);
      
      const userModel = TestNamespace.models.get("User")!;
      const addressModel = TestNamespace.models.get("Address")!;
      expect(userModel).toBeDefined();
      expect(addressModel).toBeDefined();
      expect(TestNamespace.models.has("UserInput")).toBe(false);
      expect(TestNamespace.models.has("AddressInput")).toBe(false);
      
      // Run denormalization on User (should recursively handle Address)
      const denormalizer = new GraphQLTSPDenormalizer(TestNamespace, { program } as any);
      denormalizer.expandInputOutputTypes(userModel, false);
      
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
      
      // Verify address property on UserInput references the AddressInput model
      const addressProperty = userInputModel.properties.get("address")!;
      expect(addressProperty.type).toBe(addressInputModel);
      
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
          
          // Operation that uses User as input
          op CreateUser(user: User): User;
        }
      `);
      expectDiagnosticEmpty(diagnostics);
      
      const userModel = TestNamespace.models.get("User")!;
      expect(userModel).toBeDefined();
      expect(TestNamespace.models.has("UserInput")).toBe(true); // Already exists
      
      // Run denormalization - should throw error due to name collision
      const denormalizer = new GraphQLTSPDenormalizer(TestNamespace, { program } as any);
      expect(() => {
        denormalizer.expandInputOutputTypes(userModel, false);
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
          
          // Operation that uses User as input
          op CreateUser(user: User): User;
        }
      `);
      expectDiagnosticEmpty(diagnostics);
      
      const userModel = TestNamespace.models.get("User")!;
      expect(userModel).toBeDefined();
      
      // Run denormalization
      const denormalizer = new GraphQLTSPDenormalizer(TestNamespace, { program } as any);
      denormalizer.expandInputOutputTypes(userModel, false);
      
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

    it("should not create duplicate input models when same model is referenced multiple times", async () => {
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
            homeAddress: Address;
            workAddress: Address;
          }
          
          // Operation that uses User as input
          op CreateUser(user: User): User;
        }
      `);
      expectDiagnosticEmpty(diagnostics);
      
      const userModel = TestNamespace.models.get("User")!;
      expect(userModel).toBeDefined();
      expect(TestNamespace.models.has("UserInput")).toBe(false);
      expect(TestNamespace.models.has("AddressInput")).toBe(false);
      
      // Run denormalization
      const denormalizer = new GraphQLTSPDenormalizer(TestNamespace, { program } as any);
      denormalizer.expandInputOutputTypes(userModel, false);
      
      // Check that both UserInput and AddressInput were created (only once each)
      expect(TestNamespace.models.has("UserInput")).toBe(true);
      expect(TestNamespace.models.has("AddressInput")).toBe(true);
      
      const userInputModel = TestNamespace.models.get("UserInput")!;
      const addressInputModel = TestNamespace.models.get("AddressInput")!;
      
      // Verify UserInput has correct properties
      expect(userInputModel.properties.size).toBe(3);
      expect(userInputModel.properties.has("name")).toBe(true);
      expect(userInputModel.properties.has("homeAddress")).toBe(true);
      expect(userInputModel.properties.has("workAddress")).toBe(true);

      // Verify AddressInput has correct properties
      expect(addressInputModel.properties.size).toBe(2);
      expect(addressInputModel.properties.has("street")).toBe(true);
      expect(addressInputModel.properties.has("city")).toBe(true);

      // Verify both address properties reference the same AddressInput model
      const homeAddressProperty = userInputModel.properties.get("homeAddress")!;
      const workAddressProperty = userInputModel.properties.get("workAddress")!;
      expect(homeAddressProperty.type).toBe(addressInputModel);
      expect(workAddressProperty.type).toBe(addressInputModel);
      
      // Verify only one AddressInput model was created
      const allAddressInputs = Array.from(TestNamespace.models.values()).filter(m => m.name === "AddressInput");
      expect(allAddressInputs.length).toBe(1);
    });
  });
});
