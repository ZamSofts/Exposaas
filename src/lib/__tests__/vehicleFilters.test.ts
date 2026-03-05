import { describe, it, expect } from "vitest";
import {
  buildFilterWhere,
  getSearchFilter,
  getOrderBy,
  getFieldDataType,
  ALLOWED_FILTER_FIELDS,
} from "../vehicleFilters";

describe("getFieldDataType", () => {
  it("returns 'number' for decimal fields", () => {
    expect(getFieldDataType("bidAmount")).toBe("number");
    expect(getFieldDataType("totalCost")).toBe("number");
    expect(getFieldDataType("m3")).toBe("number");
  });

  it("returns 'number' for integer fields", () => {
    expect(getFieldDataType("length")).toBe("number");
    expect(getFieldDataType("width")).toBe("number");
  });

  it("returns 'date' for date fields", () => {
    expect(getFieldDataType("titleTransferDeadline")).toBe("date");
  });

  it("returns 'string' for text fields", () => {
    expect(getFieldDataType("chassisNumber")).toBe("string");
    expect(getFieldDataType("auction")).toBe("string");
  });
});

describe("buildFilterWhere", () => {
  it("returns empty object for null/undefined", () => {
    expect(buildFilterWhere(null)).toEqual({});
    expect(buildFilterWhere(undefined)).toEqual({});
  });

  it("returns empty object for invalid JSON", () => {
    expect(buildFilterWhere("not json")).toEqual({});
  });

  it("builds string 'contains' filter", () => {
    const filters = JSON.stringify({
      conjunction: "and",
      conditions: [{ field_name: "auction", operator: "contains", value: "HAA" }],
    });
    const result: any = buildFilterWhere(filters);
    expect(result.AND).toHaveLength(1);
    expect(result.AND[0].auction).toEqual({ contains: "HAA", mode: "insensitive" });
  });

  it("builds string 'is' filter", () => {
    const filters = JSON.stringify({
      conjunction: "and",
      conditions: [{ field_name: "chassisNumber", operator: "is", value: "ABC-123" }],
    });
    const result: any = buildFilterWhere(filters);
    expect(result.AND[0].chassisNumber).toEqual({ equals: "ABC-123", mode: "insensitive" });
  });

  it("builds number 'isGreater' filter", () => {
    const filters = JSON.stringify({
      conjunction: "and",
      conditions: [{ field_name: "bidAmount", operator: "isGreater", value: "100000" }],
    });
    const result: any = buildFilterWhere(filters);
    expect(result.AND[0].bidAmount).toEqual({ gt: 100000 });
  });

  it("builds 'isEmpty' filter", () => {
    const filters = JSON.stringify({
      conjunction: "and",
      conditions: [{ field_name: "auction", operator: "isEmpty" }],
    });
    const result: any = buildFilterWhere(filters);
    expect(result.AND[0].auction).toBeNull();
  });

  it("builds 'isNotEmpty' filter", () => {
    const filters = JSON.stringify({
      conjunction: "and",
      conditions: [{ field_name: "auction", operator: "isNotEmpty" }],
    });
    const result: any = buildFilterWhere(filters);
    expect(result.AND[0].auction).toEqual({ not: null });
  });

  it("uses OR conjunction", () => {
    const filters = JSON.stringify({
      conjunction: "or",
      conditions: [
        { field_name: "auction", operator: "is", value: "HAA" },
        { field_name: "auction", operator: "is", value: "USS" },
      ],
    });
    const result: any = buildFilterWhere(filters);
    expect(result.OR).toHaveLength(2);
  });

  it("handles brand.name relation filter", () => {
    const filters = JSON.stringify({
      conjunction: "and",
      conditions: [{ field_name: "brand.name", operator: "contains", value: "Toyota" }],
    });
    const result: any = buildFilterWhere(filters);
    expect(result.AND[0].brand.name).toEqual({ contains: "Toyota", mode: "insensitive" });
  });

  it("handles customer.name isEmpty", () => {
    const filters = JSON.stringify({
      conjunction: "and",
      conditions: [{ field_name: "customer.name", operator: "isEmpty" }],
    });
    const result: any = buildFilterWhere(filters);
    expect(result.AND[0].customer).toEqual({ is: null });
  });

  it("rejects non-whitelisted fields", () => {
    const filters = JSON.stringify({
      conjunction: "and",
      conditions: [{ field_name: "password", operator: "is", value: "secret" }],
    });
    const result = buildFilterWhere(filters);
    expect(result).toEqual({});
  });

  it("handles doesNotContain with NOT wrapper", () => {
    const filters = JSON.stringify({
      conjunction: "and",
      conditions: [{ field_name: "auction", operator: "doesNotContain", value: "HAA" }],
    });
    const result: any = buildFilterWhere(filters);
    expect(result.AND[0].NOT.auction).toEqual({ contains: "HAA", mode: "insensitive" });
  });

  it("skips conditions with empty values", () => {
    const filters = JSON.stringify({
      conjunction: "and",
      conditions: [{ field_name: "auction", operator: "is", value: "" }],
    });
    const result = buildFilterWhere(filters);
    expect(result).toEqual({});
  });
});

describe("getSearchFilter", () => {
  it("returns empty object for empty search", () => {
    expect(getSearchFilter("")).toEqual({});
  });

  it("builds OR filter across multiple fields", () => {
    const result: any = getSearchFilter("toyota");
    expect(result.OR).toBeDefined();
    expect(result.OR.length).toBeGreaterThan(5);
    // Should include name, chassisNumber, auction, etc.
    expect(result.OR.some((c: any) => c.name?.contains === "toyota")).toBe(true);
    expect(result.OR.some((c: any) => c.chassisNumber?.contains === "toyota")).toBe(true);
  });

  it("includes relation fields (brand, customer)", () => {
    const result: any = getSearchFilter("test");
    expect(result.OR.some((c: any) => c.brand?.name?.contains === "test")).toBe(true);
    expect(result.OR.some((c: any) => c.customer?.name?.contains === "test")).toBe(true);
  });
});

describe("getOrderBy", () => {
  it("returns direct field ordering", () => {
    expect(getOrderBy("id", "desc")).toEqual({ id: "desc" });
    expect(getOrderBy("createdAt", "asc")).toEqual({ createdAt: "asc" });
  });

  it("returns nested ordering for brand", () => {
    expect(getOrderBy("brand", "asc")).toEqual({ brand: { name: "asc" } });
  });
});

describe("ALLOWED_FILTER_FIELDS", () => {
  it("includes all charge fields", () => {
    expect(ALLOWED_FILTER_FIELDS.has("bidAmount")).toBe(true);
    expect(ALLOWED_FILTER_FIELDS.has("taxSum")).toBe(true);
    expect(ALLOWED_FILTER_FIELDS.has("totalCost")).toBe(true);
  });

  it("does NOT include sensitive fields", () => {
    expect(ALLOWED_FILTER_FIELDS.has("password")).toBe(false);
    expect(ALLOWED_FILTER_FIELDS.has("companyId")).toBe(false);
  });
});
