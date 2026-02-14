import { prisma, getSession } from "@/lib/useful";
import { calculateTaxAndTotal } from "../../../extra/utils/chargeMapping.mjs";

// Field configuration: defines all inline-editable fields and their types
const FIELD_CONFIG = {
  // Charge fields (decimal) — trigger tax recalculation
  bidAmount:    { type: "decimal", isCharge: true },
  auctionFee:   { type: "decimal", isCharge: true },
  insuranceFee: { type: "decimal", isCharge: true },
  recyclingFee: { type: "decimal", isCharge: true },
  transportFee: { type: "decimal", isCharge: true },
  otherFees:    { type: "decimal", isCharge: true },

  // String fields
  chassisNumber:    { type: "string", unique: true },
  lotNumber:        { type: "string" },
  auction:          { type: "string" },
  auctionDate:      { type: "string" },
  session:          { type: "string" },
  transportCompany: { type: "string" },
  deliverTo:        { type: "string" },
  numberPlate:      { type: "string" },
  containerNumber:  { type: "string" },
  etd:              { type: "string" },
  documentStatus:   { type: "string" },
  memo:             { type: "string" },

  // Relation fields (foreign keys)
  brandId:    { type: "relation", model: "brand",         required: true },
  customerId: { type: "relation", model: "customer",      required: false },

  // Date fields
  titleTransferDeadline: { type: "datetime" },
};

// Parse value based on field config type
function parseValue(value, config) {
  const isEmpty = value === null || value === "" || value === undefined;

  switch (config.type) {
    case "decimal": {
      if (isEmpty) return null;
      const parsed = parseFloat(value);
      if (isNaN(parsed)) throw new Error("Invalid numeric value");
      return parsed;
    }
    case "string": {
      if (isEmpty) return null;
      return String(value).trim() || null;
    }
    case "relation": {
      if (isEmpty) {
        if (config.required) throw new Error("This field is required");
        return null;
      }
      // If value is a number (existing ID), use it directly
      const parsed = parseInt(value);
      if (!isNaN(parsed)) return parsed;
      // If value is a string (new name from Creatable combobox), flag for auto-create
      return { __newName: String(value).trim() };
    }
    case "datetime": {
      if (isEmpty) return null;
      const d = new Date(value);
      if (isNaN(d.getTime())) throw new Error("Invalid date value");
      return d;
    }
    default:
      throw new Error("Unknown field type");
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getSession(req, res);
  const { id, field, value } = req.body;

  // Validate input
  if (!id || !field) {
    return res.status(400).json({ error: "id and field are required" });
  }

  const config = FIELD_CONFIG[field];
  if (!config) {
    return res.status(400).json({ error: `Field '${field}' is not editable` });
  }

  try {
    // Verify vehicle exists and belongs to user's company
    const vehicle = await prisma.vehicle.findUnique({ where: { id: Number(id) } });
    if (!vehicle || (session.role !== "Sadmin" && vehicle.companyId !== session.companyId)) {
      return res.status(404).json({ error: "Vehicle not found" });
    }

    // Parse the value
    let parsedValue;
    try {
      parsedValue = parseValue(value, config);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }

    // Special validations
    if (field === "chassisNumber") {
      if (!parsedValue) return res.status(400).json({ error: "Chassis number is required" });
      const existing = await prisma.vehicle.findFirst({
        where: {
          companyId: vehicle.companyId,
          chassisNumber: parsedValue,
          id: { not: Number(id) },
        },
      });
      if (existing) return res.status(409).json({ error: "Chassis number already exists" });
    }

    // Handle relation fields: auto-create if new name provided
    if (config.type === "relation" && parsedValue !== null) {
      if (parsedValue.__newName) {
        const name = parsedValue.__newName;
        if (!name) return res.status(400).json({ error: "Name cannot be empty" });

        if (config.model === "brand") {
          // Find or create brand by name (global — Brand has no companyId)
          let brand = await prisma.brand.findFirst({
            where: { name: { equals: name, mode: "insensitive" } },
          });
          if (!brand) {
            brand = await prisma.brand.create({ data: { name } });
          }
          parsedValue = brand.id;
        } else if (config.model === "customer") {
          // Find or create customer by name (company-scoped)
          let customer = await prisma.customer.findFirst({
            where: { name: { equals: name, mode: "insensitive" }, companyId: vehicle.companyId },
          });
          if (!customer) {
            customer = await prisma.customer.create({
              data: { name, companyId: vehicle.companyId, uniqueId: `auto-${Date.now()}` },
            });
          }
          parsedValue = customer.id;
        }
      } else {
        const modelMap = { brand: "brand", customer: "customer" };
        const modelName = modelMap[config.model];
        const exists = await prisma[modelName].findUnique({ where: { id: parsedValue } });
        if (!exists) return res.status(400).json({ error: `${config.model} not found` });
      }
    }

    // Build update data
    const updateData = { [field]: parsedValue };

    // Recalculate tax/total only for charge fields
    if (config.isCharge) {
      const { taxSum, totalCost } = calculateTaxAndTotal(vehicle, field, parsedValue);
      updateData.taxSum = taxSum;
      updateData.totalCost = totalCost;
    }

    // Update in DB — include relations for frontend display
    const updated = await prisma.vehicle.update({
      where: { id: Number(id) },
      data: updateData,
      include: {
        brand: { select: { name: true } },
        customer: { select: { id: true, name: true } },
      },
    });

    return res.json({ message: "Vehicle Updated successfully", vehicle: updated });
  } catch (error) {
    console.error("Inline update error:", error);
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Duplicate value — already exists" });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
}
