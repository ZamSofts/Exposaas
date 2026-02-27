/**
 * Export Template type definitions.
 * Used by: exportTemplate API, vehicleExport API, ExportTemplateEditor UI
 */

export interface FormulaToken {
  type: "field" | "op";
  value: string; // field name or "+", "-", "*", "/"
}

export interface ComputedColumn {
  id: string;
  label: string;
  formula: FormulaToken[];
}

export interface FooterRow {
  label: string;
}

export interface ExportTemplateData {
  id: number;
  name: string;
  columns: string[];
  computedColumns: ComputedColumn[];
  footerRows: FooterRow[];
  showContainerNumber: boolean;
  showDate: boolean;
}

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
] as const;

/** Allowed operators in formulas */
export const FORMULA_ALLOWED_OPS = ["+", "-", "*", "/"] as const;

export type FormulaField = (typeof FORMULA_ALLOWED_FIELDS)[number];
export type FormulaOp = (typeof FORMULA_ALLOWED_OPS)[number];
