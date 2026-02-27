// ── Types ──

export interface Charge {
  type?: string;
  amount: number | string | null;
}

export interface ChargeColumns {
  bidAmount?: number;
  auctionFee?: number;
  insuranceFee?: number;
  recyclingFee?: number;
  transportFee?: number;
  otherFees?: number;
  taxSum?: number;
  totalCost?: number;
}

// ── Constants (internal) ──

export const CHARGE_TYPE_MAP: Record<string, string> = {
  bid_amount: "bidAmount",
  auction_fee: "auctionFee",
  insurance_fee: "insuranceFee",
  recycling_fee: "recyclingFee",
  recycle_fee: "recyclingFee",
  transport_fee: "transportFee",
  shipping_fee: "transportFee",
  other_fee: "otherFees",
  other_fees: "otherFees",
  listing_fee: "otherFees",
  storage_fee: "otherFees",
  admin_fee: "otherFees",
  discount: "otherFees",

  winning_price: "bidAmount",
  auction_house_charges: "auctionFee",
  transportation: "transportFee",
};

const ALL_CHARGE_COLUMNS = [
  "bidAmount",
  "auctionFee",
  "insuranceFee",
  "recyclingFee",
  "transportFee",
  "otherFees",
] as const;

const TAX_BASE_COLUMNS = [
  "bidAmount",
  "auctionFee",
  "insuranceFee",
  "transportFee",
  "otherFees",
] as const;

const TAX_RATE = 0.1;

const METADATA_CSV_MAP: Record<string, string> = {
  // Programmatic keys
  auction_date: "auctionDate",
  date: "auctionDate",
  session: "session",
  transport_company: "transportCompany",
  transportation_company: "transportCompany",
  deliver_to: "deliverTo",
  number_plate: "numberPlate",
  title_transfer_deadline: "titleTransferDeadline",
  container_number: "containerNumber",
  container_numer: "containerNumber", // typo in spreadsheet header
  etd: "etd",
  document: "documentStatus",
  document_status: "documentStatus",
  memo: "memo",

  // Size fields
  length: "length",
  width: "width",
  height: "height",
  m3: "m3",
};

// ── Exported Functions ──

export function calculateTaxAndTotal(
  currentCharges: Record<string, any>,
  updatedField: string,
  updatedValue: number | null | undefined,
): { taxSum: number; totalCost: number } {
  const charges: Record<string, number> = {};
  for (const col of ALL_CHARGE_COLUMNS) {
    charges[col] = col === updatedField ? (updatedValue || 0) : (currentCharges[col] ? Number(currentCharges[col]) : 0);
  }
  const taxSum = TAX_BASE_COLUMNS.reduce((sum, col) => sum + (charges[col] || 0), 0) * TAX_RATE;
  const totalCost = ALL_CHARGE_COLUMNS.reduce((sum, col) => sum + (charges[col] || 0), 0) + taxSum;
  return { taxSum, totalCost };
}

/**
 * Calculate taxSum and totalCost from a flat charge map (DB column names).
 * Shared by createVehiclesFromInvoice, parseChargeFieldsFromFlat, etc.
 */
export function calculateTaxFromChargeMap(
  chargeMap: Record<string, number>,
): { taxSum: number; totalCost: number } {
  const taxSum = TAX_BASE_COLUMNS.reduce((sum, col) => sum + (chargeMap[col] || 0), 0) * TAX_RATE;
  const totalCost = ALL_CHARGE_COLUMNS.reduce((sum, col) => sum + (chargeMap[col] || 0), 0) + taxSum;
  return { taxSum, totalCost };
}

/**
 * Parse a charges array [{type, amount}] (from AI extraction) into flat DB column format with tax.
 * Handles: type mapping via CHARGE_TYPE_MAP, accumulation of same-column charges,
 * taxSum/totalCost calculation.
 *
 * Used by: createVehiclesFromInvoice (invoice → vehicle creation)
 */
export function parseChargesFromArray(charges: Charge[]): ChargeColumns {
  const result: Record<string, number> = {};

  if (!Array.isArray(charges)) return result;

  for (const charge of charges) {
    const dbColumn = charge.type ? CHARGE_TYPE_MAP[charge.type] : undefined;
    if (dbColumn && charge.amount != null) {
      const amount = parseFloat(String(charge.amount));
      if (!isNaN(amount)) {
        // If same column already has a value, add to it (e.g., multiple "other_fee" entries)
        result[dbColumn] = (result[dbColumn] || 0) + amount;
      }
    }
  }

  // Calculate taxSum and totalCost using shared logic
  if (Object.keys(result).length > 0) {
    const { taxSum, totalCost } = calculateTaxFromChargeMap(result);
    result.taxSum = taxSum;
    result.totalCost = totalCost;
  }

  return result;
}

export function parseChargeFieldsFromFlat(row: Record<string, any>): ChargeColumns {
  const charges: Record<string, number> = {};

  // Check camelCase keys (from form body)
  for (const col of ALL_CHARGE_COLUMNS) {
    if (row[col] !== undefined && row[col] !== null && row[col] !== "") {
      const parsed = parseFloat(row[col]);
      if (!isNaN(parsed)) charges[col] = parsed;
    }
  }

  // Check snake_case keys (from CSV)
  for (const [snakeKey, dbCol] of Object.entries(CHARGE_TYPE_MAP)) {
    if (row[snakeKey] !== undefined && row[snakeKey] !== null && row[snakeKey] !== "") {
      const parsed = parseFloat(row[snakeKey]);
      if (!isNaN(parsed)) {
        charges[dbCol] = (charges[dbCol] || 0) + parsed;
      }
    }
  }

  // Always calculate — null/empty = 0
  const { taxSum, totalCost } = calculateTaxFromChargeMap(charges);
  charges.taxSum = taxSum;
  charges.totalCost = totalCost;

  return charges;
}

const INTEGER_CSV_FIELDS = new Set(["length", "width", "height"]);
const DECIMAL_CSV_FIELDS = new Set(["m3"]);

export function parseMetadataFromCSV(row: Record<string, any>): Record<string, string | number | Date> {
  const metadata: Record<string, string | number | Date> = {};

  for (const [csvKey, dbCol] of Object.entries(METADATA_CSV_MAP)) {
    const value = row[csvKey];
    if (value !== undefined && value !== null && value !== "") {
      if (dbCol === "titleTransferDeadline") {
        const d = new Date(value);
        if (!isNaN(d.getTime())) {
          metadata[dbCol] = d;
        }
      } else if (INTEGER_CSV_FIELDS.has(dbCol)) {
        const parsed = parseInt(value);
        if (!isNaN(parsed)) metadata[dbCol] = parsed;
      } else if (DECIMAL_CSV_FIELDS.has(dbCol)) {
        const parsed = parseFloat(value);
        if (!isNaN(parsed)) metadata[dbCol] = parsed;
      } else {
        metadata[dbCol] = String(value).trim();
      }
    }
  }

  return metadata;
}
