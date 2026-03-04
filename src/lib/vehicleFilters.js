/**
 * Shared vehicle filter utilities.
 * Extracted from src/pages/api/vehicle.js for reuse across:
 * - vehicle.js (vehicle listing API)
 * - vehicleExport.js (Excel export API)
 */

// ── Field sets ──

export const ALLOWED_FILTER_FIELDS = new Set([
  "chassisNumber", "lotNumber", "auction", "auctionDate", "session",
  "transportCompany", "deliverTo", "numberPlate", "containerNumber",
  "etd", "documentStatus", "memo",
  "bidAmount", "auctionFee", "insuranceFee", "recyclingFee",
  "transportFee", "otherFees", "taxSum", "totalCost",
  "length", "width", "height", "m3",
  "titleTransferDeadline",
]);

export const DECIMAL_FIELDS = new Set([
  "bidAmount", "auctionFee", "insuranceFee", "recyclingFee",
  "transportFee", "otherFees", "taxSum", "totalCost",
  "m3",
]);

export const INTEGER_FIELDS = new Set(["length", "width", "height"]);

export const DATE_FIELDS = new Set(["titleTransferDeadline"]);

// ── Helpers ──

export function getFieldDataType(field) {
  if (DECIMAL_FIELDS.has(field)) return "number";
  if (INTEGER_FIELDS.has(field)) return "number";
  if (DATE_FIELDS.has(field)) return "date";
  return "string";
}

/** Get start/end of a date (for day-level equality comparisons) */
function getDateRange(date) {
  const start = new Date(date); start.setHours(0, 0, 0, 0);
  const end = new Date(date);   end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * Build a single Prisma condition from operator + value + data type.
 * Note: doesNotContain and date isNot are special-cased in buildFilterWhere
 * because they need NOT wrappers at the clause level, not the field level.
 */
function buildCondition(dataType, operator, value) {
  if (operator === "isEmpty") return null;
  if (operator === "isNotEmpty") return { not: null };

  if (dataType === "string") {
    switch (operator) {
      case "is":       return { equals: value, mode: "insensitive" };
      case "isNot":    return { not: { equals: value, mode: "insensitive" } };
      case "contains": return { contains: value, mode: "insensitive" };
      default:         return undefined; // doesNotContain handled in buildFilterWhere
    }
  }

  if (dataType === "number") {
    const num = parseFloat(value);
    if (isNaN(num)) return undefined;
    switch (operator) {
      case "is":             return { equals: num };
      case "isNot":          return { not: num };
      case "isGreater":      return { gt: num };
      case "isGreaterEqual": return { gte: num };
      case "isLess":         return { lt: num };
      case "isLessEqual":    return { lte: num };
      default:               return undefined;
    }
  }

  if (dataType === "date") {
    const d = new Date(value);
    if (isNaN(d.getTime())) return undefined;
    switch (operator) {
      case "is": {
        const { start, end } = getDateRange(d);
        return { gte: start, lte: end };
      }
      case "isGreater":      return { gt: d };
      case "isGreaterEqual": return { gte: d };
      case "isLess":         return { lt: d };
      case "isLessEqual":    return { lte: d };
      default:               return undefined; // isNot handled in buildFilterWhere
    }
  }

  return undefined;
}

// ── Main functions ──

/** Parse the filters query param and return a Prisma where fragment */
export function buildFilterWhere(filtersParam) {
  if (!filtersParam) return {};

  let parsed;
  try { parsed = JSON.parse(filtersParam); } catch { return {}; }

  const { conjunction = "and", conditions } = parsed;
  if (!Array.isArray(conditions) || conditions.length === 0) return {};

  const clauses = [];

  for (const cond of conditions) {
    const { field_name, operator, value } = cond;
    if (!field_name || !operator) continue;

    // isEmpty/isNotEmpty don't need a value
    const needsValue = !["isEmpty", "isNotEmpty"].includes(operator);
    if (needsValue && (value === undefined || value === null || value === "")) continue;

    // --- Relation fields ---
    if (field_name === "brand.name") {
      if (operator === "isEmpty") { clauses.push({ id: -1 }); continue; }
      if (operator === "isNotEmpty") continue;
      if (operator === "doesNotContain") {
        clauses.push({ NOT: { brand: { name: { contains: value, mode: "insensitive" } } } });
        continue;
      }
      if (operator === "isNot") {
        clauses.push({ NOT: { brand: { name: { equals: value, mode: "insensitive" } } } });
        continue;
      }
      const c = buildCondition("string", operator, value);
      if (c) clauses.push({ brand: { name: c } });
      continue;
    }
    if (field_name === "customer.name") {
      if (operator === "isEmpty") { clauses.push({ customer: { is: null } }); continue; }
      if (operator === "isNotEmpty") { clauses.push({ customer: { isNot: null } }); continue; }
      if (operator === "doesNotContain") {
        clauses.push({ NOT: { customer: { name: { contains: value, mode: "insensitive" } } } });
        continue;
      }
      if (operator === "isNot") {
        clauses.push({ NOT: { customer: { name: { equals: value, mode: "insensitive" } } } });
        continue;
      }
      const c = buildCondition("string", operator, value);
      if (c) clauses.push({ customer: { name: c } });
      continue;
    }

    // --- Direct fields (whitelist check) ---
    if (!ALLOWED_FILTER_FIELDS.has(field_name)) continue;

    const dataType = getFieldDataType(field_name);

    // isEmpty → field is null
    if (operator === "isEmpty") {
      clauses.push({ [field_name]: null });
      continue;
    }

    // Operators that need NOT wrapper at clause level
    if (operator === "doesNotContain" && dataType === "string") {
      clauses.push({ NOT: { [field_name]: { contains: value, mode: "insensitive" } } });
      continue;
    }
    if (operator === "isNot" && dataType === "date") {
      const d = new Date(value);
      if (isNaN(d.getTime())) continue;
      const { start, end } = getDateRange(d);
      clauses.push({ NOT: { [field_name]: { gte: start, lte: end } } });
      continue;
    }

    const prismaCondition = buildCondition(dataType, operator, value);
    if (prismaCondition !== undefined) {
      clauses.push({ [field_name]: prismaCondition });
    }
  }

  if (clauses.length === 0) return {};

  const key = conjunction === "or" ? "OR" : "AND";
  return { [key]: clauses };
}

/** Build search filter across multiple text fields */
export function getSearchFilter(search) {
  return search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { chassisNumber: { contains: search, mode: "insensitive" } },
          { auction: { contains: search, mode: "insensitive" } },
          { auctionDate: { contains: search, mode: "insensitive" } },
          { session: { contains: search, mode: "insensitive" } },
          { lotNumber: { contains: search, mode: "insensitive" } },
          { remarks: { contains: search, mode: "insensitive" } },
          { numberPlate: { contains: search, mode: "insensitive" } },
          { containerNumber: { contains: search, mode: "insensitive" } },
          { transportCompany: { contains: search, mode: "insensitive" } },
          { deliverTo: { contains: search, mode: "insensitive" } },
          { etd: { contains: search, mode: "insensitive" } },
          { documentStatus: { contains: search, mode: "insensitive" } },
          { memo: { contains: search, mode: "insensitive" } },
          { brand: { name: { contains: search, mode: "insensitive" } } },
          { customer: { name: { contains: search, mode: "insensitive" } } },
        ],
      }
    : {};
}

/** Build Prisma orderBy from sortBy/sortOrder params */
export function getOrderBy(sortBy, sortOrder) {
  return {
    brand: { brand: { name: sortOrder } },
  }[sortBy] || { [sortBy]: sortOrder };
}
