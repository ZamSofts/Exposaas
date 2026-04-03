import { describe, it, expect, vi } from "vitest";

// Mock wrapper.js to avoid transitive next/font/google import (Loader.jsx → Geist)
vi.mock("@/hooks/wrapper", () => ({ API: vi.fn() }));

import {
  getVehicleCount,
  buildViewerData,
  getStatusConfig,
  isActionDone,
} from "../invoiceJobUtils";

describe("getVehicleCount", () => {
  it("counts from new format { items: [...] }", () => {
    const json = { items: [{}, {}, {}] };
    expect(getVehicleCount(json)).toBe(3);
  });

  it("counts from legacy format { page_1: [...] }", () => {
    const json = { page_1: [{}, {}], page_2: [{}] };
    expect(getVehicleCount(json)).toBe(3);
  });

  it("returns 0 for null/undefined", () => {
    expect(getVehicleCount(null)).toBe(0);
    expect(getVehicleCount(undefined)).toBe(0);
  });

  it("returns 0 for empty json", () => {
    expect(getVehicleCount({})).toBe(0);
  });

  it("ignores non-page/non-items keys", () => {
    const json = { error: "something", meta: {} };
    expect(getVehicleCount(json)).toBe(0);
  });
});


describe("getStatusConfig", () => {
  it("returns config for all valid statuses", () => {
    const statuses = ["completed", "processing", "failed", "empty", "needs_classification", "pending"];
    for (const status of statuses) {
      const config = getStatusConfig(status);
      expect(config).toHaveProperty("icon");
      expect(config).toHaveProperty("label");
      expect(config).toHaveProperty("colorClass");
    }
  });

  it("returns pending config for unknown status", () => {
    const config = getStatusConfig("unknown_status");
    expect(config.label).toBe("Pending");
  });

  it("completed shows green", () => {
    expect(getStatusConfig("completed").colorClass).toContain("green");
  });

  it("failed shows red", () => {
    expect(getStatusConfig("failed").colorClass).toContain("red");
  });
});


describe("isActionDone", () => {
  it("done for evaluated invoice", () => {
    expect(isActionDone({ docType: "invoice", isEvaluated: true })).toBe(true);
  });

  it("not done for non-evaluated invoice", () => {
    expect(isActionDone({ docType: "invoice", isEvaluated: false })).toBe(false);
  });

  it("done for linked cert", () => {
    expect(isActionDone({ docType: "export_cert", Json: { linkedVehicleId: 5 } })).toBe(true);
  });

  it("not done for unlinked cert", () => {
    expect(isActionDone({ docType: "export_cert" })).toBe(false);
  });

  it("treats null docType as invoice", () => {
    expect(isActionDone({ isEvaluated: true })).toBe(true);
  });
});

describe("buildViewerData", () => {
  it("builds data from row Json", () => {
    const row = {
      Json: { items: [{ chassis_number: "A" }] },
      DocumentURL: "https://blob.test/doc.pdf",
      companyId: 1,
      id: 42,
      status: "completed",
      pageNumber: 1,
      originalTotalPages: 3,
    };
    const result = buildViewerData(row, null);
    expect(result.items).toEqual([{ chassis_number: "A" }]);
    expect(result.blobUrl).toBe("https://blob.test/doc.pdf");
    expect(result.id).toBe(42);
    expect(result.pageNumber).toBe(1);
  });

  it("uses correctedJson when provided", () => {
    const row = { Json: { items: [{ brand: "Toyota" }] }, id: 1 };
    const corrected = { items: [{ brand: "Suzuki" }] };
    const result = buildViewerData(row, corrected);
    expect(result.items[0].brand).toBe("Suzuki");
  });
});
