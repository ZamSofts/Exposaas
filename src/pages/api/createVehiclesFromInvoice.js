import { prisma, getSession } from "@/lib/useful";
import { parseChargesFromArray } from "../../../extra/utils/chargeMapping";
import { resolveBrands, resolveCustomers } from "../../../extra/utils/vehicleDomain";
import { logVehicleAudit } from "../../../extra/utils/auditLog";
import { findMergeCandidate, mergeVehicles } from "../../../extra/utils/vehicleMerge";

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

  const auctionInvoiceId = invoiceJob.auctionInvoiceId ?? null;

  const results = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    vehicles: [],
  };

  // --- Resolve brands and customers (shared domain logic) ---
  const { brandMap, defaultBrandId } = await resolveBrands(prisma, vehicles.map(v => v.brand));
  const customerMap = await resolveCustomers(prisma, session.companyId, vehicles.map(v => v.customer), "INV");

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

      const chargeData = parseChargesFromArray(vehicle.charges);

      // Customer lookup
      const customerName = vehicle.customer?.trim() || null;
      const customerId = customerName ? (customerMap.get(customerName.toLowerCase()) || null) : null;

      // ── Merge detection: check if a different vehicle matches by chassisKey+lot+auction ──
      const mergeCandidate = await findMergeCandidate(prisma, {
        companyId: session.companyId,
        chassisNumber,
        lotNumber: vehicle.lot_number || null,
        auction: auctionName,
      });

      if (mergeCandidate && mergeCandidate.chassisNumber !== chassisNumber) {
        try {
          const mergeResult = await mergeVehicles(prisma, {
            source: "invoice",
            newData: {
              chassisNumber,
              lotNumber: vehicle.lot_number || null,
              auction: auctionName,
              auctionDate: vehicle.auction_date || null,
              brandId,
              customerId: customerId || null,
              sourceInvoiceJobId: invoiceJobId,
              ...(auctionInvoiceId ? { auctionInvoiceId } : {}),
              ...chargeData,
            },
            existing: mergeCandidate,
            actorId: session.id,
            mergeSource: `invoiceJob:${invoiceJobId}`,
          });

          logVehicleAudit(prisma, {
            vehicleId: mergeResult.survivorId,
            action: "merge",
            actor: "user",
            actorId: session.id,
            source: `invoiceJob:${invoiceJobId}`,
            metadata: {
              absorbedId: mergeResult.absorbedId,
              absorbedChassis: mergeCandidate.chassisNumber,
              chargeSource: mergeResult.chargeSource,
              fieldsChanged: mergeResult.fieldsChanged,
              relocationCounts: mergeResult.relocationCounts,
            },
          });

          results.updated++;
          results.vehicles.push({
            id: mergeResult.survivorId,
            chassisNumber: mergeResult.chassisNumberUsed,
            action: "merged",
            mergedFrom: mergeCandidate.chassisNumber,
          });
          continue;
        } catch (mergeErr) {
          console.error(`Merge failed for ${chassisNumber}, falling back to upsert:`, mergeErr);
          // Fall through to normal upsert
        }
      }

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
          updatedById: parseInt(session.id, 10) || null,
          ...(auctionInvoiceId ? { auctionInvoiceId } : {}),
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
          createdById: parseInt(session.id, 10) || null,
          ...(auctionInvoiceId ? { auctionInvoiceId } : {}),
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

      // Audit trail (fire-and-forget)
      logVehicleAudit(prisma, {
        vehicleId: result.id,
        action: wasCreated ? "create" : "update",
        actor: "user",
        actorId: session.id,
        source: `invoiceJob:${invoiceJobId}`,
      });
    } catch (error) {
      console.error(`Error processing vehicle ${vehicle.chassis_number}:`, error);
      results.errors.push({
        chassis: vehicle.chassis_number || "unknown",
        error: error.message,
      });
    }
  }

  // Mark AuctionInvoice as verified once vehicles are confirmed by the user
  if (auctionInvoiceId) {
    try {
      await prisma.auctionInvoice.update({
        where: { id: auctionInvoiceId },
        data: { status: "verified" },
      });
    } catch (err) {
      console.error(`Failed to update AuctionInvoice #${auctionInvoiceId} status:`, err.message);
    }
  }

  const message = `Processed ${vehicles.length} vehicle(s): ${results.created} created, ${results.updated} updated, ${results.skipped} skipped`;

  return res.status(200).json({
    message,
    ...results,
  });
}
