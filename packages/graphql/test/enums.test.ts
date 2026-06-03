import { describe, expect, it } from "vitest";
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

    expect(result).toMatchInlineSnapshot(`
      """"The status of an order"""
      enum OrderStatus {
        """Order has been placed but not processed"""
        Pending

        """Order is being prepared"""
        Processing

        """Order has been shipped"""
        Shipped

        """Order has been delivered"""
        Delivered

        """Order was cancelled"""
        Cancelled
      }

      type Order {
        id: String!
        status: OrderStatus!
      }

      type Query {
        getOrder(id: String!): Order!
      }

      "
    `);
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

      expect(result).toMatchInlineSnapshot(`
        """"Enum with Values"""
        enum Hour {
          Nothing
          HalfofHalf
          SweetSpot
          AlmostFull
        }

        type Schedule {
          duration: Hour!
        }

        type Query {
          getSchedule: Schedule!
        }

        "
      `);
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

      expect(result).toMatchInlineSnapshot(`
        "enum Boundary {
          zero
          negOne
          one
        }

        type Range {
          boundary: Boundary!
        }

        type Query {
          getRange: Range!
        }

        "
      `);
    });
  });
});
