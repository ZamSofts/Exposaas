import { prisma, getSession } from "@/lib/useful";
import { computeDetailedDiff } from "../../../extra/utils/computeDiff";
import { resolveBrands } from "../../../extra/utils/vehicleDomain";
import { logVehicleAudit } from "../../../extra/utils/auditLog";

/**
 * Payment Confirmation API handler.
 *
 * PUT  — Save a reviewed page: creates PaymentConfirmation, auto-creates vehicles & payments,
 *         computes diff against original Gemini extraction, marks InvoiceJob as evaluated.
 * PATCH — Toggle isGolden flag on an existing PaymentConfirmation record.
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  try {
    if (req.method === "PUT") {
      const { Page, Json, CompanyID, DocumentURL, invoiceJobId } = req.body;

      if (!Json || typeof Json !== "object") return res.status(400).json({ error: "Missing or invalid Json payload for page" });

      const companyId = session.role === "Sadmin" ? (CompanyID || session?.companyId) : session?.companyId;
      if (!companyId) return res.status(400).json({ error: "Missing CompanyID and no company available in session" });

      const pageNum = typeof Page === "number" ? Page : parseInt(Page, 10);
      if (!pageNum || isNaN(pageNum)) return res.status(400).json({ error: "Invalid Page number" });

      const pageKey = pageNum === 1 ? "page_1" : `page_${pageNum}`;
      let pageArr = Array.isArray(Json[pageKey]) ? Json[pageKey] : null;

      if (!pageArr && Array.isArray(Json.items)) pageArr = Json.items;

      if (!pageArr) return res.status(400).json({ error: `Json must include ${pageKey} array or items` });

      const normalizeCharges = charges =>
        (charges || []).map(c => ({
          type: c.type,
          amount: c.amount === "" || c.amount == null ? null : isNaN(Number(c.amount)) ? c.amount : Number(c.amount),
        }));

      const normalizedPage = pageArr.map(item => ({
        chassis_number: item.chassis_number,
        charges: normalizeCharges(item.charges),
        ...Object.keys(item).reduce((acc, k) => {
          if (k !== "chassis_number" && k !== "charges") acc[k] = item[k];
          return acc;
        }, {}),
      }));

      const storeJson = { [pageKey]: normalizedPage };

      // Auto-compute isCorrect + diffSummary by comparing original Gemini output vs user-corrected data
      let autoIsCorrect = "corrected";
      let diffSummary = null;
      if (invoiceJobId) {
        try {
          const originalJob = await prisma.invoiceJobs.findUnique({
            where: { id: invoiceJobId },
            select: { Json: true },
          });
          if (originalJob?.Json) {
            const result = computeDetailedDiff(originalJob.Json, storeJson);
            autoIsCorrect = result.isCorrect;
            diffSummary = result.diffSummary;
          }
        } catch (diffErr) {
          console.warn("Could not compute diff:", diffErr?.message);
        }
      }

      // Extract auction house from first vehicle for denormalized column
      const auctionHouse = normalizedPage[0]?.auction?.trim() || null;

      const saved = await prisma.paymentConfirmation.create({
        data: {
          DocumentURL: DocumentURL || null,
          Page: pageNum,
          Json: storeJson,
          isCorrect: autoIsCorrect,
          diffSummary,
          auctionHouse,
          reviewedById: parseInt(session.id, 10) || null,
          companyId,
          invoiceJobId: invoiceJobId || null,
        },
      });
      // Mark InvoiceJob as evaluated directly
      // In the new per-page architecture, each page is its own InvoiceJob
      if (invoiceJobId) {
        try {
          await prisma.invoiceJobs.update({
            where: { id: invoiceJobId },
            data: { isEvaluated: true }
          });
        } catch (jobUpdateErr) {
          console.warn("Could not update InvoiceJob review status:", jobUpdateErr?.message);
        }
      }

      const charges = [];
      const savedJson = saved.Json || {};
      for (const pageKey of Object.keys(savedJson)) {
        const pageArrLocal = Array.isArray(savedJson[pageKey]) ? savedJson[pageKey] : [];
        for (const chassisItem of pageArrLocal) {
          const chassis_number = chassisItem.chassis_number;
          const chassisCharges = Array.isArray(chassisItem.charges) ? chassisItem.charges : [];
          chassisCharges.forEach((c, idx) => {
            charges.push({
              DocumentURL: saved.DocumentURL,
              chassis_number,
              type: c.type,
              amount: c.amount,
              // include chassis-level metadata so we can create vehicles with correct details
              brand: chassisItem.brand || null,
              lot_number: chassisItem.lot_number || null,
              auction: chassisItem.auction || null,
            });
          });
        }
      }

      // --- Pre-load brands & vehicles to avoid N+1 in the loop ---
      const uniqueChassis = [...new Set(charges.map(ch => String(ch.chassis_number || "").trim()).filter(Boolean))];
      const uniqueBrandNames = [...new Set(charges.map(ch => {
        const name = ch.brand && String(ch.brand).trim();
        return name || "-";
      }))];

      // Batch load existing vehicles
      const existingVehicles = await prisma.vehicle.findMany({
        where: {
          companyId: Number(companyId),
          chassisNumber: { in: uniqueChassis },
        },
        select: { id: true, chassisNumber: true },
      });
      const vehicleMap = new Map(existingVehicles.map(v => [v.chassisNumber, v]));

      // Resolve brands (shared domain logic, with race condition protection)
      const { brandMap } = await resolveBrands(prisma, uniqueBrandNames);

      for (const ch of charges) {
        try {
          const chassisNumber = String(ch.chassis_number || "").trim();
          if (!chassisNumber) continue;

          let vehicle = vehicleMap.get(chassisNumber);
          if (!vehicle) {
            const brandName = ch.brand && String(ch.brand).trim() !== "" ? String(ch.brand).trim() : "-";
            const brandId = brandMap.get(brandName) || brandMap.get("-");
            const lotNumber = ch.lot_number && String(ch.lot_number).trim() !== "" ? String(ch.lot_number).trim() : null;
            const auction = ch.auction && String(ch.auction).trim() !== "" ? String(ch.auction).trim() : null;

            vehicle = await prisma.vehicle.create({
              data: {
                chassisNumber,
                companyId: Number(companyId),
                brandId,
                lotNumber,
                auction,
                createdById: parseInt(session.id, 10) || null,
                remarks: `Auto-added from payment confirmation`,
              },
            });
            vehicleMap.set(chassisNumber, vehicle);

            // Audit trail for auto-created vehicle (fire-and-forget)
            logVehicleAudit(prisma, {
              vehicleId: vehicle.id,
              action: "create",
              actor: "user",
              actorId: session.id,
              source: invoiceJobId ? `invoiceJob:${invoiceJobId}` : "manual",
            });
          }

          const amount = ch.amount == null || ch.amount === "" ? null : Number(ch.amount);
          if (amount == null || isNaN(amount)) continue;

          await prisma.vehiclePayments.create({
            data: {
              vehicleId: vehicle.id,
              name: ch.type || "Payment",
              amount: -amount,
              date: new Date(),
              remarks: `Auto-added from payment confirmation ${saved.id}`,
              url: ch.DocumentURL || saved.DocumentURL || null,
            },
          });
        } catch (err) {
          console.error("Failed to process charge for chassis", ch && ch.chassis_number, err && err.message ? err.message : err);
        }
      }
      return res.status(201).json({
        message: "Page saved and payments added to vehicle payments successfully",
        paymentConfirmationId: saved.id,
        isCorrect: autoIsCorrect,
        diffSummary,
      });
    }
    // PATCH: toggle isGolden
    if (req.method === "PATCH") {
      const { id, isGolden } = req.body;
      if (!id) return res.status(400).json({ error: "Missing record id" });

      const record = await prisma.paymentConfirmation.findFirst({
        where: { id: Number(id), companyId: session.companyId },
      });
      if (!record) return res.status(404).json({ error: "Record not found" });

      const newGolden = isGolden != null ? Boolean(isGolden) : !record.isGolden;

      const updated = await prisma.paymentConfirmation.update({
        where: { id: record.id },
        data: { isGolden: newGolden },
      });

      // Auto-compute embedding when marked as golden (async, non-blocking)
      if (newGolden) {
        import("../../../extra/utils/embedding.mjs")
          .then(({ embedRecord }) => embedRecord(updated.id))
          .catch(err => console.warn("[paymentConfirmation] Embedding failed:", err?.message || err));
      }

      return res.status(200).json({ id: updated.id, isGolden: updated.isGolden });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
}
