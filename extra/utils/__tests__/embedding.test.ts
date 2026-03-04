import { describe, it, expect } from "vitest";
import { jsonToEmbeddingText, cosineSimilarity } from "../embedding.mjs";

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    const v = [1, 2, 3, 4, 5];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 10);
  });

  it("returns -1 for opposite vectors", () => {
    const a = [1, 0, 0];
    const b = [-1, 0, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1, 10);
  });

  it("returns 0 for orthogonal vectors", () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 10);
  });

  it("returns 0 for different length vectors", () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });

  it("returns 0 for zero vectors", () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
  });

  it("handles high-dimensional vectors (like embeddings)", () => {
    // 768-dim random-ish vectors
    const a = Array.from({ length: 768 }, (_, i) => Math.sin(i));
    const b = Array.from({ length: 768 }, (_, i) => Math.sin(i + 0.1));
    const sim = cosineSimilarity(a, b);
    // Should be close to 1 (similar vectors)
    expect(sim).toBeGreaterThan(0.99);
  });

  it("correctly differentiates similar and dissimilar vectors", () => {
    const base = [1, 2, 3, 4, 5];
    const similar = [1.1, 2.1, 3.1, 4.1, 5.1];
    const different = [5, 4, 3, 2, 1];

    const simScore = cosineSimilarity(base, similar);
    const diffScore = cosineSimilarity(base, different);
    expect(simScore).toBeGreaterThan(diffScore);
  });
});

describe("jsonToEmbeddingText", () => {
  it("returns auction name and vehicle count", () => {
    const json = { page_1: [{ chassis_number: "ABC-123" }] };
    const text = jsonToEmbeddingText(json, "HAA Kobe");
    expect(text).toContain("auction: HAA Kobe");
    expect(text).toContain("vehicles: 1");
  });

  it("includes charge type patterns", () => {
    const json = {
      page_1: [{
        charges: [
          { type: "bid_amount", amount: 100000 },
          { type: "auction_fee", amount: 20000 },
        ],
      }],
    };
    const text = jsonToEmbeddingText(json);
    expect(text).toContain("v1_charges: auction_fee, bid_amount");
    expect(text).toContain("all_charge_types: auction_fee, bid_amount");
  });

  it("includes brand patterns", () => {
    const json = { page_1: [{ brand: "Toyota" }] };
    const text = jsonToEmbeddingText(json);
    expect(text).toContain("v1_brand: Toyota");
  });

  it("handles multiple vehicles", () => {
    const json = {
      page_1: [
        { charges: [{ type: "bid_amount", amount: 50000 }] },
        { charges: [{ type: "auction_fee", amount: 10000 }] },
      ],
    };
    const text = jsonToEmbeddingText(json);
    expect(text).toContain("vehicles: 2");
  });

  it("filters out zero/null amounts from charge types", () => {
    const json = {
      page_1: [{
        charges: [
          { type: "bid_amount", amount: 100000 },
          { type: "auction_fee", amount: 0 },
          { type: "insurance_fee", amount: null },
        ],
      }],
    };
    const text = jsonToEmbeddingText(json);
    expect(text).toContain("bid_amount");
    expect(text).not.toContain("auction_fee");
    expect(text).not.toContain("insurance_fee");
  });

  it("handles empty/null input", () => {
    expect(jsonToEmbeddingText(null)).toContain("vehicles: 0");
    expect(jsonToEmbeddingText({})).toContain("vehicles: 0");
  });

  it("handles null auctionHouse", () => {
    const text = jsonToEmbeddingText({ page_1: [] }, null);
    expect(text).not.toContain("auction:");
  });
});
