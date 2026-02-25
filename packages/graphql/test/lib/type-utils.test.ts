import { describe, expect, it } from "vitest";
import {
  convertNumericEnumValue,
  getSingleNameWithNamespace,
  sanitizeNameForGraphQL,
  toEnumMemberName,
  toFieldName,
  toTypeName,
} from "../../src/lib/type-utils.js";

describe("type-utils", () => {
  describe("sanitizeNameForGraphQL", () => {
    it("replaces special characters with underscores", () => {
      expect(sanitizeNameForGraphQL("$Money$")).toBe("_Money_");
      expect(sanitizeNameForGraphQL("My-Name")).toBe("My_Name");
      expect(sanitizeNameForGraphQL("Hello.World")).toBe("Hello_World");
    });

    it("replaces [] with Array", () => {
      expect(sanitizeNameForGraphQL("Item[]")).toBe("ItemArray");
    });

    it("leaves valid names unchanged", () => {
      expect(sanitizeNameForGraphQL("ValidName")).toBe("ValidName");
      expect(sanitizeNameForGraphQL("_underscore")).toBe("_underscore");
      expect(sanitizeNameForGraphQL("name123")).toBe("name123");
    });

    it("adds prefix for names starting with numbers", () => {
      expect(sanitizeNameForGraphQL("123Name")).toBe("_123Name");
      expect(sanitizeNameForGraphQL("1")).toBe("_1");
    });

    it("handles multiple special characters", () => {
      expect(sanitizeNameForGraphQL("$My-Special.Name$")).toBe("_My_Special_Name_");
    });

    it("handles empty prefix parameter", () => {
      expect(sanitizeNameForGraphQL("123Name", "")).toBe("_123Name");
    });

    it("uses custom prefix for invalid starting character", () => {
      expect(sanitizeNameForGraphQL("123Name", "Num")).toBe("Num_123Name");
    });

    it("prefixes GraphQL reserved keywords", () => {
      expect(sanitizeNameForGraphQL("true")).toBe("_true");
      expect(sanitizeNameForGraphQL("false")).toBe("_false");
      expect(sanitizeNameForGraphQL("null")).toBe("_null");
    });

    it("uses custom prefix for reserved keywords", () => {
      expect(sanitizeNameForGraphQL("true", "Val")).toBe("Valtrue");
    });

    it("handles case-insensitive reserved keyword check", () => {
      expect(sanitizeNameForGraphQL("True")).toBe("_True");
      expect(sanitizeNameForGraphQL("FALSE")).toBe("_FALSE");
      expect(sanitizeNameForGraphQL("Null")).toBe("_Null");
    });

    it("preserves double-underscore prefix", () => {
      // Double-underscore names are reserved by GraphQL introspection, but sanitizeNameForGraphQL
      // doesn't strip them since TypeSpec names won't normally start with __ and the camelCase
      // prefixCharacters option relies on preserving leading underscores.
      expect(sanitizeNameForGraphQL("__typename")).toBe("__typename");
    });
  });

  describe("toTypeName", () => {
    it("converts to PascalCase", () => {
      expect(toTypeName("my_name")).toBe("MyName");
      expect(toTypeName("some-value")).toBe("SomeValue");
      expect(toTypeName("hello_world")).toBe("HelloWorld");
    });

    it("preserves all-caps acronyms", () => {
      expect(toTypeName("API")).toBe("API");
      expect(toTypeName("APIResponse")).toBe("APIResponse");
      expect(toTypeName("myAPIKey")).toBe("MyAPIKey");
      expect(toTypeName("HTTPResponse")).toBe("HTTPResponse");
    });

    it("handles namespaced names by using only the last part", () => {
      expect(toTypeName("MyNamespace.MyType")).toBe("MyType");
      expect(toTypeName("A.B.C.MyType")).toBe("MyType");
    });

    it("sanitizes and converts special characters", () => {
      // Special chars become underscores, then PascalCase removes them
      expect(toTypeName("my-special$name")).toBe("MySpecialName");
      expect(toTypeName("$invalid")).toBe("Invalid");
    });
  });

  describe("toEnumMemberName", () => {
    it("converts to CONSTANT_CASE", () => {
      expect(toEnumMemberName("MyEnum", "myValue")).toBe("MY_VALUE");
      expect(toEnumMemberName("Status", "inProgress")).toBe("IN_PROGRESS");
    });

    it("handles already uppercase names", () => {
      expect(toEnumMemberName("MyEnum", "ACTIVE")).toBe("ACTIVE");
    });

    it("uses enum name as prefix for invalid starting characters", () => {
      expect(toEnumMemberName("Priority", "1High")).toBe("PRIORITY_1_HIGH");
    });

    it("handles special characters", () => {
      expect(toEnumMemberName("MyEnum", "value-with-dashes")).toBe("VALUE_WITH_DASHES");
    });

    it("separates numbers", () => {
      expect(toEnumMemberName("MyEnum", "value123")).toBe("VALUE_123");
    });
  });

  describe("toFieldName", () => {
    it("converts to camelCase", () => {
      expect(toFieldName("MyField")).toBe("myField");
      expect(toFieldName("SOME_VALUE")).toBe("someValue");
    });

    it("handles snake_case", () => {
      expect(toFieldName("my_field_name")).toBe("myFieldName");
    });

    it("handles special characters", () => {
      expect(toFieldName("my-field")).toBe("myField");
      expect(toFieldName("$special")).toBe("_special");
    });

    it("preserves leading underscores", () => {
      expect(toFieldName("_private")).toBe("_private");
      expect(toFieldName("__internal")).toBe("__internal");
    });
  });

  describe("getSingleNameWithNamespace", () => {
    it("replaces dots with underscores", () => {
      expect(getSingleNameWithNamespace("My.Namespace.Type")).toBe("My_Namespace_Type");
    });

    it("trims whitespace", () => {
      expect(getSingleNameWithNamespace("  My.Type  ")).toBe("My_Type");
    });

    it("handles names without namespace", () => {
      expect(getSingleNameWithNamespace("MyType")).toBe("MyType");
    });
  });

  describe("convertNumericEnumValue", () => {
    it("converts zero", () => {
      expect(convertNumericEnumValue(0)).toBe("_0");
    });

    it("converts positive integers", () => {
      expect(convertNumericEnumValue(1)).toBe("_1");
      expect(convertNumericEnumValue(42)).toBe("_42");
    });

    it("converts negative integers", () => {
      expect(convertNumericEnumValue(-1)).toBe("_NEGATIVE_1");
      expect(convertNumericEnumValue(-42)).toBe("_NEGATIVE_42");
    });

    it("converts positive decimals", () => {
      expect(convertNumericEnumValue(0.25)).toBe("_0_25");
      expect(convertNumericEnumValue(3.14)).toBe("_3_14");
    });

    it("converts negative decimals", () => {
      expect(convertNumericEnumValue(-2.5)).toBe("_NEGATIVE_2_5");
    });

    it("handles NaN", () => {
      expect(convertNumericEnumValue(NaN)).toBe("_NaN");
    });

    it("handles Infinity", () => {
      expect(convertNumericEnumValue(Infinity)).toBe("_Infinity");
    });

    it("handles negative Infinity", () => {
      expect(convertNumericEnumValue(-Infinity)).toBe("_NEGATIVE_Infinity");
    });
  });
});
