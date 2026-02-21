/**
 * Link Document to Vehicle API
 *
 * POST /api/linkDocumentToVehicle
 * Body: { invoiceJobId, vehicleId }
 *
 * Manually links a document (from InvoiceJobs) to a vehicle.
 * Creates a VehicleDocument record and updates the vehicle's documentStatus.
 */

import { prisma, getSession } from "@/lib/useful";
import { logVehicleAudit } from "../../../extra/utils/auditLog.mjs";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getSession(req, res);
  const { invoiceJobId, vehicleId } = req.body;

  if (!invoiceJobId || !vehicleId) {
    return res.status(400).json({ error: "invoiceJobId and vehicleId are required" });
  }

  try {
    // Load the InvoiceJob
    const invoiceJob = await prisma.invoiceJobs.findUnique({
      where: { id: Number(invoiceJobId) },
    });

    if (!invoiceJob) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Verify ownership
    if (session.role !== "Sadmin" && invoiceJob.companyId !== session.companyId) {
      return res.status(403).json({ error: "Not authorized" });
    }

    // Load the Vehicle
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: Number(vehicleId) },
    });

    if (!vehicle) {
      return res.status(404).json({ error: "Vehicle not found" });
    }

    if (session.role !== "Sadmin" && vehicle.companyId !== session.companyId) {
      return res.status(403).json({ error: "Not authorized to link to this vehicle" });
    }

    // Create VehicleDocument record
    await prisma.vehicleDocument.create({
      data: {
        vehicleId: vehicle.id,
        Url: invoiceJob.DocumentURL,
        docType: invoiceJob.docType,
      },
    });

    // Update vehicle documentStatus
    const DOC_TYPE_LABELS = {
      export_cert: "輸出抹消",
      inspection_cert: "車検証",
      temp_cancel: "一時抹消",
      invoice: "請求書",
    };
    const label = DOC_TYPE_LABELS[invoiceJob.docType] || invoiceJob.docType;
    const currentStatus = vehicle.documentStatus || "";
    const newStatus = currentStatus ? `${currentStatus}, ${label}` : label;

    await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: { documentStatus: newStatus },
    });

    // Sync size fields from extracted data to Vehicle (only update null fields)
    const extracted = invoiceJob.Json?.extracted;
    if (extracted) {
      const sizeUpdates = {};
      if (extracted.length  && vehicle.length == null)  sizeUpdates.length = parseInt(extracted.length)  || undefined;
      if (extracted.width   && vehicle.width  == null)  sizeUpdates.width  = parseInt(extracted.width)   || undefined;
      if (extracted.height  && vehicle.height == null)  sizeUpdates.height = parseInt(extracted.height)  || undefined;
      if (extracted.m3      && vehicle.m3     == null)  sizeUpdates.m3     = parseFloat(extracted.m3)    || undefined;

      for (const k of Object.keys(sizeUpdates)) {
        if (sizeUpdates[k] === undefined) delete sizeUpdates[k];
      }

      if (Object.keys(sizeUpdates).length > 0) {
        await prisma.vehicle.update({
          where: { id: vehicle.id },
          data: sizeUpdates,
        });
      }
    }

    // Update InvoiceJob JSON with link info
    const currentJson = invoiceJob.Json || {};
    await prisma.invoiceJobs.update({
      where: { id: invoiceJob.id },
      data: {
        Json: {
          ...currentJson,
          linkedVehicleId: vehicle.id,
          linkedChassisNumber: vehicle.chassisNumber,
        },
      },
    });

    // Audit trail (fire-and-forget)
    logVehicleAudit(prisma, {
      vehicleId: vehicle.id,
      action: "link_document",
      actor: "user",
      actorId: session.id,
      source: "manual",
      metadata: { invoiceJobId: invoiceJob.id, docType: invoiceJob.docType },
    });

    return res.status(200).json({
      success: true,
      message: `Document linked to vehicle #${vehicle.id} (${vehicle.chassisNumber})`,
      vehicleId: vehicle.id,
    });
  } catch (err) {
    console.error("linkDocumentToVehicle error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
