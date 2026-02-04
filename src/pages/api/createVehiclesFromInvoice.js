import { prisma, getSession } from "@/lib/useful";

/**
 * POST /api/createVehiclesFromInvoice
 *
 * Creates vehicles from invoice data extracted by Gemini AI.
 *
 * Request body:
 * {
 *   invoiceJobId: number,          // ID of the InvoiceJobs record
 *   vehicles: [
 *     {
 *       chassis_number: string,
 *       brand: string,
 *       auction: string,
 *       lot_number: string,
 *       charges: [
 *         { type: "bid_amount", amount: 250000 },
 *         { type: "bid_tax", amount: 25000 },
 *         ...
 *       ]
 *     }
 *   ]
 * }
 *
 * Response:
 * {
 *   created: number,
 *   updated: number,
 *   skipped: number,
 *   errors: [],
 *   vehicles: []
 * }
 */

// Map charge types from Gemini output to database columns
const CHARGE_TYPE_MAP = {
  bid_amount: "bidAmount",
  bid_tax: "bidTax",
  auction_fee: "auctionFee",
  auction_tax: "auctionTax",
  insurance_fee: "insuranceFee",
  insurance_tax: "insuranceTax",
  recycling_fee: "recyclingFee",
  transport_fee: "transportFee",
  transport_tax: "transportTax",
  shipping_fee: "transportFee", // Gemini may output either
  tax_proration: "taxProration",
  listing_fee: "otherFees", // Listing fee goes to otherFees
  other_fee: "otherFees",
  other_fees: "otherFees",
};

// Parse charges array into flat object with DB column names
const parseCharges = (charges) => {
  const result = {};

  if (!Array.isArray(charges)) return result;

  for (const charge of charges) {
    const dbColumn = CHARGE_TYPE_MAP[charge.type];
    if (dbColumn && charge.amount != null) {
      const amount = parseFloat(charge.amount);
      if (!isNaN(amount)) {
        // If same column already has a value, add to it (e.g., multiple "other_fee" entries)
        result[dbColumn] = (result[dbColumn] || 0) + amount;
      }
    }
  }

  // Calculate totalCost
  if (Object.keys(result).length > 0) {
    result.totalCost = Object.values(result).reduce((sum, val) => sum + (val || 0), 0);
  }

  return result;
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getSession(req, res);
  if (!session?.companyId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { invoiceJobId, vehicles } = req.body;

  if (!invoiceJobId || !Array.isArray(vehicles) || vehicles.length === 0) {
    return res.status(400).json({ error: "invoiceJobId and vehicles array required" });
  }

  // Verify invoice job exists and belongs to this company
  const invoiceJob = await prisma.invoiceJobs.findFirst({
    where: {
      id: Number(invoiceJobId),
      companyId: session.companyId,
    },
  });

  if (!invoiceJob) {
    return res.status(404).json({ error: "Invoice job not found" });
  }

  const results = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    vehicles: [],
  };

  // Get default brand ("-") for vehicles without a recognized brand
  let defaultBrand = await prisma.brand.findUnique({ where: { name: "-" } });
  if (!defaultBrand) {
    defaultBrand = await prisma.brand.create({ data: { name: "-" } });
  }

  for (const vehicle of vehicles) {
    try {
      const chassisNumber = vehicle.chassis_number?.trim();

      if (!chassisNumber) {
        results.skipped++;
        results.errors.push({ chassis: "unknown", error: "Missing chassis number" });
        continue;
      }

      // Find or create brand
      let brandId = defaultBrand.id;
      if (vehicle.brand && vehicle.brand.trim() !== "") {
        const brandName = vehicle.brand.trim();
        const existingBrand = await prisma.brand.findUnique({ where: { name: brandName } });
        if (existingBrand) {
          brandId = existingBrand.id;
        } else {
          const newBrand = await prisma.brand.create({ data: { name: brandName } });
          brandId = newBrand.id;
        }
      }

      // Parse charges
      const chargeData = parseCharges(vehicle.charges);

      // Check if vehicle already exists
      const existingVehicle = await prisma.vehicle.findUnique({
        where: {
          companyId_chassisNumber: {
            companyId: session.companyId,
            chassisNumber,
          },
        },
      });

      if (existingVehicle) {
        // Update existing vehicle with charge data
        const updated = await prisma.vehicle.update({
          where: { id: existingVehicle.id },
          data: {
            auction: vehicle.auction || existingVehicle.auction,
            lotNumber: vehicle.lot_number || existingVehicle.lotNumber,
            brandId,
            sourceInvoiceJobId: invoiceJobId,
            ...chargeData,
          },
        });
        results.updated++;
        results.vehicles.push({
          id: updated.id,
          chassisNumber,
          action: "updated",
        });
      } else {
        // Create new vehicle
        const created = await prisma.vehicle.create({
          data: {
            chassisNumber,
            auction: vehicle.auction || null,
            lotNumber: vehicle.lot_number || null,
            brandId,
            companyId: session.companyId,
            statusId: 1, // Default status (typically "In Stock")
            sourceInvoiceJobId: invoiceJobId,
            ...chargeData,
          },
        });
        results.created++;
        results.vehicles.push({
          id: created.id,
          chassisNumber,
          action: "created",
        });
      }
    } catch (error) {
      console.error(`Error processing vehicle ${vehicle.chassis_number}:`, error);
      results.errors.push({
        chassis: vehicle.chassis_number || "unknown",
        error: error.message,
      });
    }
  }

  const message = `Processed ${vehicles.length} vehicle(s): ${results.created} created, ${results.updated} updated, ${results.skipped} skipped`;

  return res.status(200).json({
    message,
    ...results,
  });
}
