import { strictEqual } from "node:assert";
import { describe, it } from "vitest";
import { emitSchemaForUsageTest } from "./test-host.js";

describe("Usage Tracking", () => {
  it("Only generates input types for models used as inputs", async () => {
    const typeSpecCode = `
      // Model used only in query return types (output-only usage)
      model User {
        id: string;
        name: string;
        email: string;
      }
      
      // Model used in both mutation parameters (input) and return types (output)
      model Product {
        id: string;
        title: string;
        price: float32;
      }
      
      // Query that returns User (creates output usage only)
      op getUser(id: string): User;
      
      // Mutation that takes Product as input and returns it (creates both input and output usage)
      op createProduct(productData: Product): Product;
    `;
    
    const generatedSchema = await emitSchemaForUsageTest(typeSpecCode);
    
    // User should have GraphQL output type but NO input type (only used in query returns)
    strictEqual(generatedSchema.includes("type User"), true, "User output type should be generated");
    strictEqual(generatedSchema.includes("input UserInput"), false, "User input type should NOT be generated");
    
    // Product should have BOTH GraphQL output type AND input type (used in mutations and returns)
    strictEqual(generatedSchema.includes("type Product"), true, "Product output type should be generated");
    strictEqual(generatedSchema.includes("input ProductInput"), true, "Product input type should be generated");
  });
  
  it("Handles models with no operations (output-only by default)", async () => {
    const typeSpecCode = `
      // Model defined but not referenced by any operations
      model OrphanedModel {
        id: string;
        metadata: string;
      }
    `;
    
    const generatedSchema = await emitSchemaForUsageTest(typeSpecCode);
    
    // Orphaned models should get output type by default, but no input type
    strictEqual(generatedSchema.includes("type OrphanedModel"), true, "Orphaned model should get output type");
    strictEqual(generatedSchema.includes("input OrphanedModelInput"), false, "Orphaned model should NOT get input type");
  });
}); 