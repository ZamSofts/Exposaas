export const CHARGE_TYPE_MAP = {
  bid_amount: "bidAmount",
  bid_tax: "bidTax",
  auction_fee: "auctionFee",
  auction_tax: "auctionTax",
  insurance_fee: "insuranceFee",
  insurance_tax: "insuranceTax",
  recycling_fee: "recyclingFee",
  recycle_fee: "recyclingFee",
  transport_fee: "transportFee",
  shipping_fee: "transportFee",
  tax_proration: "taxProration",
  transport_tax: "transportTax",
  other_fee: "otherFees",
  other_fees: "otherFees",
  listing_fee: "otherFees",

  // Human-readable CSV headers (after csv-parser normalization: lowercase, spaces→underscores)
  winning_price: "bidAmount",
  auction_house_charges: "auctionFee",
  transportation: "transportFee",
  "tax_(from_auction)": "auctionTax",
  "tax_(from_transportation)": "transportTax",
};

export const TAX_COLUMNS = [
  "bidTax",
  "auctionTax",
  "insuranceTax",
  "transportTax",
  "taxProration",
];

export const ALL_CHARGE_COLUMNS = [
  "bidAmount",
  "bidTax",
  "auctionFee",
  "auctionTax",
  "insuranceFee",
  "insuranceTax",
  "recyclingFee",
  "transportFee",
  "transportTax",
  "taxProration",
  "otherFees",
];

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
  memo: "remarks",

  // Human-readable CSV headers (after normalization)
  "transportation_co...": "transportCompany",
  "title_transfer_deadl...": "titleTransferDeadline",
};

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

  if (Object.keys(charges).length > 0) {
    charges.totalCost = ALL_CHARGE_COLUMNS.reduce(
      (sum, col) => sum + (charges[col] || 0), 0
    );
    charges.taxSum = TAX_COLUMNS.reduce(
      (sum, col) => sum + (charges[col] || 0), 0
    );
  }

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
