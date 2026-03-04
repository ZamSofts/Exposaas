import { describe, it, expect } from "vitest";
import { computeDetailedDiff, computeScoredDiff } from "../computeDiff";

describe("computeDetailedDiff", () => {
  it("returns exact_match for identical data", () => {
    const json = {
      items: [{ chassis_number: "ABC-123", brand: "Toyota", auction: "HAA", lot_number: "1234" }],
    };
    const result = computeDetailedDiff(json, json);
    expect(result.isCorrect).toBe("exact_match");
    expect(result.diffSummary.totalFieldsChanged).toBe(0);
  });

  it("detects field changes", () => {
    const original = {
      items: [{ chassis_number: "ABC-123", brand: "Toyota" }],
    };
    const corrected = {
      items: [{ chassis_number: "ABC-123", brand: "Suzuki" }],
    };
    const result = computeDetailedDiff(original, corrected);
    expect(result.isCorrect).toBe("corrected");
    expect(result.diffSummary.vehicles[0].fields.brand).toEqual({
      original: "Toyota",
      corrected: "Suzuki",
    });
  });

  it("normalizes chassis numbers for comparison (case insensitive)", () => {
    const original = { items: [{ chassis_number: "abc-123" }] };
    const corrected = { items: [{ chassis_number: "ABC-123" }] };
    const result = computeDetailedDiff(original, corrected);
    expect(result.isCorrect).toBe("exact_match");
  });

  it("detects vehicle count changes", () => {
    const original = { items: [{ chassis_number: "A" }] };
    const corrected = { items: [{ chassis_number: "A" }, { chassis_number: "B" }] };
    const result = computeDetailedDiff(original, corrected);
    expect(result.isCorrect).toBe("corrected");
    expect(result.diffSummary.vehicleCountChanged).toEqual({ original: 1, corrected: 2 });
  });

  it("detects charge additions", () => {
    const original = { items: [{ chassis_number: "A", charges: [] }] };
    const corrected = {
      items: [{ chassis_number: "A", charges: [{ type: "bid_amount", amount: 50000 }] }],
    };
    const result = computeDetailedDiff(original, corrected);
    expect(result.isCorrect).toBe("corrected");
    expect(result.diffSummary.vehicles[0].charges.added).toHaveLength(1);
    expect(result.diffSummary.vehicles[0].charges.added[0].type).toBe("bid_amount");
  });

  it("detects charge removals", () => {
    const original = {
      items: [{ chassis_number: "A", charges: [{ type: "bid_amount", amount: 50000 }] }],
    };
    const corrected = { items: [{ chassis_number: "A", charges: [] }] };
    const result = computeDetailedDiff(original, corrected);
    expect(result.diffSummary.vehicles[0].charges.removed).toHaveLength(1);
  });

  it("detects charge amount changes", () => {
    const original = {
      items: [{ chassis_number: "A", charges: [{ type: "bid_amount", amount: 50000 }] }],
    };
    const corrected = {
      items: [{ chassis_number: "A", charges: [{ type: "bid_amount", amount: 60000 }] }],
    };
    const result = computeDetailedDiff(original, corrected);
    expect(result.diffSummary.vehicles[0].charges.changed).toHaveLength(1);
    expect(result.diffSummary.vehicles[0].charges.changed[0]).toEqual({
      type: "bid_amount",
      original: 50000,
      corrected: 60000,
    });
  });

  it("supports legacy page_N format", () => {
    const original = { page_1: [{ chassis_number: "A" }] };
    const corrected = { page_1: [{ chassis_number: "A" }] };
    const result = computeDetailedDiff(original, corrected);
    expect(result.isCorrect).toBe("exact_match");
  });

  it("handles null/empty json", () => {
    const result = computeDetailedDiff({}, {});
    expect(result.isCorrect).toBe("exact_match");
  });
});

describe("computeScoredDiff", () => {
  it("returns perfect score for identical data", () => {
    const vehicles = [{ chassis_number: "ABC-123", brand: "Toyota" }];
    const golden = { items: [{ chassis_number: "ABC-123", brand: "Toyota" }] };
    const result = computeScoredDiff(vehicles, golden);
    expect(result.isExactMatch).toBe(true);
    expect(result.score).toBe(1);
    expect(result.fieldsChanged).toBe(0);
  });

  it("returns lower score for changes", () => {
    const vehicles = [{ chassis_number: "ABC-123", brand: "Toyota" }];
    const golden = { items: [{ chassis_number: "ABC-123", brand: "Suzuki" }] };
    const result = computeScoredDiff(vehicles, golden);
    expect(result.isExactMatch).toBe(false);
    expect(result.score).toBeLessThan(1);
    expect(result.fieldsChanged).toBe(1);
  });

  it("penalizes vehicle count mismatch", () => {
    const vehicles = [{ chassis_number: "A" }];
    const golden = { items: [{ chassis_number: "A" }, { chassis_number: "B" }] };
    const result = computeScoredDiff(vehicles, golden);
    expect(result.isExactMatch).toBe(false);
    expect(result.score).toBeLessThan(1);
  });

  it("score is between 0 and 1", () => {
    const vehicles = [{ chassis_number: "A", brand: "X", auction: "Y" }];
    const golden = { items: [{ chassis_number: "B", brand: "Z", auction: "W" }] };
    const result = computeScoredDiff(vehicles, golden);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });
});
