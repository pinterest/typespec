import { strictEqual } from "node:assert";
import { describe, it } from "vitest";
import { emitSingleSchema } from "./test-host.js";

describe("enums", () => {
  it("supports enums with descriptions", async () => {
    const code = `
      @schema
      namespace TestNamespace {
        /** The status of an order */
        enum OrderStatus {
          /** Order has been placed but not processed */
          Pending,
          /** Order is being prepared */
          Processing,
          /** Order has been shipped */
          Shipped,
          /** Order has been delivered */
          Delivered,
          /** Order was cancelled */
          Cancelled,
        }

        model Order {
          id: string;
          status: OrderStatus;
        }

        @query
        op getOrder(id: string): Order;
      }
    `;

    const result = await emitSingleSchema(code, {});

    strictEqual(result.includes('"""The status of an order"""'), true);
    strictEqual(result.includes("enum OrderStatus {"), true);
    strictEqual(result.includes('"""Order has been placed but not processed"""'), true);
    strictEqual(result.includes("Pending"), true);
    strictEqual(result.includes("Processing"), true);
    strictEqual(result.includes("Cancelled"), true);
  });

  describe("numeric values", () => {
    it("uses member names (not values) for enum members with numeric values", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          /** Enum with Values */
          enum Hour {
            Nothing: 0,
            HalfofHalf: 0.25,
            SweetSpot: 0.5,
            AlmostFull: 0.75,
          }

          model Schedule {
            duration: Hour;
          }

          @query
          op getSchedule(): Schedule;
        }
      `;

      const result = await emitSingleSchema(code, {});

      strictEqual(result.includes("enum Hour {"), true);
      // Enum members use their names, not their numeric values
      strictEqual(result.includes("Nothing"), true);
      strictEqual(result.includes("HalfofHalf"), true);
      strictEqual(result.includes("SweetSpot"), true);
      strictEqual(result.includes("AlmostFull"), true);
    });

    it("uses member names (not values) for enum members with negative values", async () => {
      const code = `
        @schema
        namespace TestNamespace {
          enum Boundary {
            zero: 0,
            negOne: -1,
            one: 1,
          }

          model Range {
            boundary: Boundary;
          }

          @query
          op getRange(): Range;
        }
      `;

      const result = await emitSingleSchema(code, {});

      strictEqual(result.includes("enum Boundary {"), true);
      // Enum members use their names, not their numeric values
      strictEqual(result.includes("zero"), true);
      strictEqual(result.includes("negOne"), true);
      strictEqual(result.includes("one"), true);
    });
  });
});
