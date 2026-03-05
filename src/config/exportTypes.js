/**
 * Export Template constants.
 * Used by: exportTemplate API, vehicleExport API, ExportTemplateEditor UI
 */

/** Numeric vehicle fields allowed in computed column formulas */
export const FORMULA_ALLOWED_FIELDS = [
  "bidAmount",
  "auctionFee",
  "insuranceFee",
  "recyclingFee",
  "transportFee",
  "otherFees",
  "taxSum",
  "totalCost",
];

/** Allowed operators in formulas */
export const FORMULA_ALLOWED_OPS = ["+", "-", "*", "/"];
