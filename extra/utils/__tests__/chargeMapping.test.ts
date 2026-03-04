import { describe, it, expect } from "vitest";
import {
  calculateTaxAndTotal,
  calculateTaxFromChargeMap,
  parseChargesFromArray,
  parseChargeFieldsFromFlat,
  parseMetadataFromCSV,
  CHARGE_TYPE_MAP,
} from "../chargeMapping";

describe("calculateTaxAndTotal", () => {
  it("calculates tax on all columns except recyclingFee", () => {
    const charges = {
      bidAmount: 100000,
      auctionFee: 20000,
      insuranceFee: 5000,
      recyclingFee: 15000,
      transportFee: 10000,
      otherFees: 3000,
    };
    const result = calculateTaxAndTotal(charges, "bidAmount", 100000);
    // Tax base = bidAmount(100000) + auctionFee(20000) + insuranceFee(5000) + transportFee(10000) + otherFees(3000) = 138000
    // taxSum = 138000 * 0.1 = 13800
    // totalCost = all charges (153000) + taxSum (13800) = 166800
    expect(result.taxSum).toBe(13800);
    expect(result.totalCost).toBe(166800);
  });

  it("recyclingFee is excluded from tax base", () => {
    const charges = { recyclingFee: 50000 };
    const result = calculateTaxAndTotal(charges, "recyclingFee", 50000);
    // Tax base = 0 (recyclingFee excluded)
    expect(result.taxSum).toBe(0);
    // totalCost = 50000 + 0 = 50000
    expect(result.totalCost).toBe(50000);
  });

  it("uses updatedValue for the updated field", () => {
    const charges = { bidAmount: 100000 };
    const result = calculateTaxAndTotal(charges, "bidAmount", 200000);
    // Should use 200000 (updated value), not 100000 (current)
    expect(result.taxSum).toBe(20000); // 200000 * 0.1
    expect(result.totalCost).toBe(220000); // 200000 + 20000
  });

  it("handles zero and null values", () => {
    const result = calculateTaxAndTotal({}, "bidAmount", 0);
    expect(result.taxSum).toBe(0);
    expect(result.totalCost).toBe(0);
  });

  it("handles null updatedValue", () => {
    const result = calculateTaxAndTotal({ bidAmount: 50000 }, "bidAmount", null);
    expect(result.taxSum).toBe(0);
    expect(result.totalCost).toBe(0);
  });
});

describe("calculateTaxFromChargeMap", () => {
  it("calculates from flat charge map", () => {
    const map = { bidAmount: 100000, recyclingFee: 10000 };
    const result = calculateTaxFromChargeMap(map);
    expect(result.taxSum).toBe(10000); // bidAmount * 0.1
    expect(result.totalCost).toBe(120000); // 100000 + 10000 + 10000
  });
});

describe("parseChargesFromArray", () => {
  it("maps charge types to DB columns", () => {
    const charges = [
      { type: "bid_amount", amount: 100000 },
      { type: "auction_fee", amount: 20000 },
      { type: "recycling_fee", amount: 15000 },
    ];
    const result = parseChargesFromArray(charges);
    expect(result.bidAmount).toBe(100000);
    expect(result.auctionFee).toBe(20000);
    expect(result.recyclingFee).toBe(15000);
    expect(result.taxSum).toBeDefined();
    expect(result.totalCost).toBeDefined();
  });

  it("accumulates same-type charges", () => {
    const charges = [
      { type: "other_fee", amount: 1000 },
      { type: "storage_fee", amount: 2000 }, // maps to otherFees
      { type: "admin_fee", amount: 500 }, // maps to otherFees
    ];
    const result = parseChargesFromArray(charges);
    expect(result.otherFees).toBe(3500); // 1000 + 2000 + 500
  });

  it("handles alternative names", () => {
    const charges = [
      { type: "winning_price", amount: 100000 },
      { type: "transportation", amount: 5000 },
    ];
    const result = parseChargesFromArray(charges);
    expect(result.bidAmount).toBe(100000);
    expect(result.transportFee).toBe(5000);
  });

  it("handles empty/null input", () => {
    expect(parseChargesFromArray([])).toEqual({});
    // @ts-ignore — testing runtime safety
    expect(parseChargesFromArray(null)).toEqual({});
  });

  it("ignores unknown charge types", () => {
    const charges = [{ type: "unknown_fee", amount: 5000 }];
    const result = parseChargesFromArray(charges);
    expect(Object.keys(result).length).toBe(0);
  });

  it("handles string amounts", () => {
    const charges = [{ type: "bid_amount", amount: "250000" }];
    const result = parseChargesFromArray(charges);
    expect(result.bidAmount).toBe(250000);
  });
});

describe("parseChargeFieldsFromFlat", () => {
  it("parses camelCase keys from form body", () => {
    const row = { bidAmount: "100000", auctionFee: "20000" };
    const result = parseChargeFieldsFromFlat(row);
    expect(result.bidAmount).toBe(100000);
    expect(result.auctionFee).toBe(20000);
    expect(result.taxSum).toBe(12000); // (100000 + 20000) * 0.1
  });

  it("parses snake_case keys from CSV", () => {
    const row = { bid_amount: "50000", transport_fee: "10000" };
    const result = parseChargeFieldsFromFlat(row);
    expect(result.bidAmount).toBe(50000);
    expect(result.transportFee).toBe(10000);
  });

  it("ignores empty/null values", () => {
    const row = { bidAmount: "", auctionFee: null, recyclingFee: undefined };
    const result = parseChargeFieldsFromFlat(row);
    expect(result.taxSum).toBe(0);
    expect(result.totalCost).toBe(0);
  });
});

describe("parseMetadataFromCSV", () => {
  it("maps CSV headers to DB columns", () => {
    const row = { auction_date: "2024-01-15", session: "Morning", deliver_to: "Tokyo" };
    const result = parseMetadataFromCSV(row);
    expect(result.auctionDate).toBe("2024-01-15");
    expect(result.session).toBe("Morning");
    expect(result.deliverTo).toBe("Tokyo");
  });

  it("parses integer fields (length/width/height)", () => {
    const row = { length: "450", width: "170", height: "140" };
    const result = parseMetadataFromCSV(row);
    expect(result.length).toBe(450);
    expect(result.width).toBe(170);
    expect(result.height).toBe(140);
  });

  it("parses decimal fields (m3)", () => {
    const row = { m3: "10.71" };
    const result = parseMetadataFromCSV(row);
    expect(result.m3).toBe(10.71);
  });

  it("parses titleTransferDeadline as Date", () => {
    const row = { title_transfer_deadline: "2024-06-01" };
    const result = parseMetadataFromCSV(row);
    expect(result.titleTransferDeadline).toBeInstanceOf(Date);
  });

  it("handles typo header 'container_numer'", () => {
    const row = { container_numer: "ABCD1234567" };
    const result = parseMetadataFromCSV(row);
    expect(result.containerNumber).toBe("ABCD1234567");
  });

  it("trims string values", () => {
    const row = { memo: "  some note  " };
    const result = parseMetadataFromCSV(row);
    expect(result.memo).toBe("some note");
  });
});

describe("CHARGE_TYPE_MAP", () => {
  it("maps all expected charge types", () => {
    expect(CHARGE_TYPE_MAP.bid_amount).toBe("bidAmount");
    expect(CHARGE_TYPE_MAP.winning_price).toBe("bidAmount");
    expect(CHARGE_TYPE_MAP.recycle_fee).toBe("recyclingFee");
    expect(CHARGE_TYPE_MAP.shipping_fee).toBe("transportFee");
    expect(CHARGE_TYPE_MAP.discount).toBe("otherFees");
  });
});
