export const CHARGE_TYPE_MAP = {
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

export const ALL_CHARGE_COLUMNS = [
  "bidAmount",
  "auctionFee",
  "insuranceFee",
  "recyclingFee",
  "transportFee",
  "otherFees",
];

export const TAX_BASE_COLUMNS = [
  "bidAmount",
  "auctionFee",
  "insuranceFee",
  "transportFee",
  "otherFees",
];

export const TAX_RATE = 0.1;

export const METADATA_CSV_MAP = {
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
};

export function calculateTaxAndTotal(currentCharges, updatedField, updatedValue) {
  const charges = {};
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
 * @param {Object} chargeMap — e.g. { bidAmount: 250000, auctionFee: 15000 }
 * @returns {{ taxSum: number, totalCost: number }}
 */
export function calculateTaxFromChargeMap(chargeMap) {
  const taxSum = TAX_BASE_COLUMNS.reduce((sum, col) => sum + (chargeMap[col] || 0), 0) * TAX_RATE;
  const totalCost = ALL_CHARGE_COLUMNS.reduce((sum, col) => sum + (chargeMap[col] || 0), 0) + taxSum;
  return { taxSum, totalCost };
}

export function parseChargeFieldsFromFlat(row) {
  const charges = {};

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

export function parseMetadataFromCSV(row) {
  const metadata = {};

  for (const [csvKey, dbCol] of Object.entries(METADATA_CSV_MAP)) {
    const value = row[csvKey];
    if (value !== undefined && value !== null && value !== "") {
      if (dbCol === "titleTransferDeadline") {
        const d = new Date(value);
        if (!isNaN(d.getTime())) {
          metadata[dbCol] = d;
        }
      } else {
        metadata[dbCol] = value.trim();
      }
    }
  }

  return metadata;
}
