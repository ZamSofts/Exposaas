import { prisma, getSession } from "@/lib/useful";
import { CHARGE_TYPE_MAP, TAX_BASE_COLUMNS, TAX_RATE, ALL_CHARGE_COLUMNS } from "../../../extra/utils/chargeMapping.mjs";

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
 *       customer: string,           // Optional customer name
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

  // Calculate taxSum and totalCost using shared constants
  if (Object.keys(result).length > 0) {
    result.taxSum = TAX_BASE_COLUMNS.reduce((sum, col) => sum + (result[col] || 0), 0) * TAX_RATE;
    result.totalCost = ALL_CHARGE_COLUMNS.reduce((sum, col) => sum + (result[col] || 0), 0) + result.taxSum;
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

  // --- Pre-load all brands into a Map (eliminates N+1 per vehicle) ---
  const allBrands = await prisma.brand.findMany({ select: { id: true, name: true } });
  const brandMap = new Map(allBrands.map(b => [b.name, b.id]));

  // Ensure default brand exists
  if (!brandMap.has("-")) {
    const created = await prisma.brand.create({ data: { name: "-" } });
    brandMap.set("-", created.id);
  }
  const defaultBrandId = brandMap.get("-");

  // --- Collect unique brand names that need to be created ---
  const newBrandNames = new Set();
  for (const v of vehicles) {
    const name = v.brand?.trim();
    if (name && name !== "" && !brandMap.has(name)) {
      newBrandNames.add(name);
    }
  }

  // Batch-create missing brands (with race condition protection)
  if (newBrandNames.size > 0) {
    for (const name of newBrandNames) {
      try {
        const created = await prisma.brand.create({ data: { name } });
        brandMap.set(name, created.id);
      } catch (e) {
        if (e.code === "P2002") {
          const existing = await prisma.brand.findUnique({ where: { name } });
          if (existing) brandMap.set(name, existing.id);
        } else {
          throw e;
        }
      }
    }
  }

  // --- Pre-load customers and auto-create missing ones ---
  const customerNames = new Set();
  for (const v of vehicles) {
    const cn = v.customer?.trim();
    if (cn) customerNames.add(cn);
  }

  const customerMap = new Map();
  if (customerNames.size > 0) {
    const existingCustomers = await prisma.customer.findMany({
      where: { companyId: session.companyId, name: { in: [...customerNames], mode: "insensitive" } },
      select: { id: true, name: true },
    });
    for (const c of existingCustomers) customerMap.set(c.name.toLowerCase(), c.id);

    for (const name of customerNames) {
      if (!customerMap.has(name.toLowerCase())) {
        try {
          const created = await prisma.customer.create({
            data: { name, companyId: session.companyId, uniqueId: `INV-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` },
          });
          customerMap.set(name.toLowerCase(), created.id);
        } catch (e) {
          if (e.code === "P2002") {
            const existing = await prisma.customer.findFirst({
              where: { companyId: session.companyId, name: { equals: name, mode: "insensitive" } },
              select: { id: true },
            });
            if (existing) customerMap.set(name.toLowerCase(), existing.id);
          } else {
            throw e;
          }
        }
      }
    }
  }

  // --- Process vehicles using upsert (1 query per vehicle instead of 2-3) ---
  for (const vehicle of vehicles) {
    try {
      const rawChassis = vehicle.chassis_number?.trim();
      const chassisNumber = rawChassis ? rawChassis.replace(/\s+/g, "-") : null;

      if (!chassisNumber) {
        results.skipped++;
        results.errors.push({ chassis: "unknown", error: "Missing chassis number" });
        continue;
      }

      const rawAuction = vehicle.auction?.trim() || null;
      const auctionName = rawAuction
        ? rawAuction.replace(/\s+(Venue|Hall|Branch|Office|Center|Centre|Auction)$/i, "")
        : null;

      // Brand lookup from pre-loaded map (zero DB queries)
      const brandName = vehicle.brand?.trim();
      const brandId = (brandName && brandMap.get(brandName)) || defaultBrandId;

      const chargeData = parseCharges(vehicle.charges);

      // Customer lookup
      const customerName = vehicle.customer?.trim() || null;
      const customerId = customerName ? (customerMap.get(customerName.toLowerCase()) || null) : null;

      // Single upsert instead of findUnique + update/create
      const result = await prisma.vehicle.upsert({
        where: {
          companyId_chassisNumber: {
            companyId: session.companyId,
            chassisNumber,
          },
        },
        update: {
          auction: auctionName || undefined,
          auctionDate: vehicle.auction_date || undefined,
          lotNumber: vehicle.lot_number || undefined,
          brandId,
          sourceInvoiceJobId: invoiceJobId,
          ...(customerId ? { customerId } : {}),
          ...chargeData,
        },
        create: {
          chassisNumber,
          auction: auctionName,
          auctionDate: vehicle.auction_date || null,
          lotNumber: vehicle.lot_number || null,
          brandId,
          companyId: session.companyId,
          sourceInvoiceJobId: invoiceJobId,
          ...(customerId ? { customerId } : {}),
          ...chargeData,
        },
      });

      // Detect if it was a create or update by checking if createdAt == updatedAt
      const wasCreated = result.createdAt?.getTime() === result.updatedAt?.getTime();
      if (wasCreated) {
        results.created++;
        results.vehicles.push({ id: result.id, chassisNumber, action: "created" });
      } else {
        results.updated++;
        results.vehicles.push({ id: result.id, chassisNumber, action: "updated" });
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
