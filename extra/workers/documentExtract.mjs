/**
 * Document Extraction Worker
 *
 * Listens on "extract-document" queue.
 * Extracts data from non-invoice documents (export cert, inspection cert, temp cancel)
 * using type-specific schemas, then auto-links to vehicles by chassis number.
 *
 * Flow:
 *   classifyDocument → "extract-document" queue → THIS WORKER
 *     → Gemini extraction with doc-specific schema
 *     → Auto-link to vehicle by chassis number (if found)
 *     → Create VehicleDocument record
 *     → Update vehicle documentStatus
 */

import { ensureQueue } from "../queues/pgBoss.mjs";
import { processPageWithGemini, QuotaExhaustedError } from "./geminiProcess.mjs";
import { prisma } from "../PrismaClient/prismaClient.mjs";
import { deleteFile } from "../../src/lib/blob.mjs";
import {
  DOCUMENT_SCHEMA_MAP,
  buildDocumentExtractionPrompt,
} from "../ai/documentSchemas.mjs";
import { DOCUMENT_TYPES } from "../ai/classificationSchema.mjs";
import { logVehicleAudit } from "../utils/auditLog.mjs";
import { zodToJsonSchema } from "zod-to-json-schema";
import { DOC_ZOD_MAP } from "../ai/zodSchemas.mjs";
import { QUOTA_REQUEUE_DELAY_SECONDS } from "../../src/config/aiConstants.mjs";

let boss;

(async () => {
  try {
    boss = await ensureQueue("extract-document");

    if (boss && typeof boss.on === "function") {
      boss.on("error", (err) => console.error("[pg-boss] error:", err));
    }

    await boss.work("extract-document", { teamConcurrency: 1 }, async ([job]) => {
      const { invoiceJobId, fileUrl, docType, companyId, userId } = job.data;

      console.log(`📄 Extracting ${docType} document: InvoiceJob #${invoiceJobId}`);

      try {
        // Update status to processing
        await prisma.invoiceJobs.update({
          where: { id: invoiceJobId },
          data: { status: "processing" },
        });

        // Get the appropriate schema for this doc type
        const schema = DOCUMENT_SCHEMA_MAP[docType];
        if (!schema) {
          throw new Error(`No extraction schema for docType: ${docType}`);
        }

        // Build the extraction prompt
        const extractionPrompt = buildDocumentExtractionPrompt(schema);

        // Build Structured Output config if Zod schema exists for this docType
        const zodSchema = DOC_ZOD_MAP[docType];
        const responseConfig = zodSchema
          ? { responseMimeType: "application/json", responseJsonSchema: zodToJsonSchema(zodSchema) }
          : {};

        // Process with Gemini — single page, flat JSON response
        const extracted = await processPageWithGemini(fileUrl, 1, {
          customPrompt: extractionPrompt,
          rawJsonResponse: true,
          responseConfig,
        });

        // Validate with Zod (soft — log warning, don't block extraction)
        if (zodSchema && extracted) {
          const validationResult = zodSchema.safeParse(extracted);
          if (!validationResult.success) {
            console.warn(`[docExtract] Zod validation warning for ${docType}:`, validationResult.error.issues);
          }
        }

        if (!extracted) {
          // Empty extraction
          await prisma.invoiceJobs.update({
            where: { id: invoiceJobId },
            data: {
              status: "empty",
              Json: { extracted: null, error: "No data could be extracted" },
            },
          });
          return;
        }

        // Save extraction result
        await prisma.invoiceJobs.update({
          where: { id: invoiceJobId },
          data: {
            status: "completed",
            Json: { extracted, docType },
          },
        });

        console.log(`✅ Extraction complete for InvoiceJob #${invoiceJobId}:`, JSON.stringify(extracted));

        // Cleanup: delete the split-page blob (fire-and-forget)
        if (fileUrl) {
          try { await deleteFile(fileUrl); }
          catch (cleanupErr) { console.warn(`[docExtract] Failed to delete page blob:`, cleanupErr.message); }
        }

        // Auto-link to vehicle by chassis number
        const chassisNumber = extracted.chassis_number;
        if (chassisNumber) {
          try {
            // 1st try: normalize to DB format (spaces → dashes) and exact match
            const normalized = chassisNumber.trim().replace(/\s+/g, "-");
            let vehicle = await prisma.vehicle.findFirst({
              where: {
                companyId,
                chassisNumber: { equals: normalized, mode: "insensitive" },
              },
            });

            // 2nd try: strip all dashes/spaces and exact normalized match
            if (!vehicle) {
              const stripped = chassisNumber.replace(/[\s-]/g, "").toLowerCase();
              const candidates = await prisma.vehicle.findMany({
                where: {
                  companyId,
                  chassisNumber: { contains: stripped, mode: "insensitive" },
                },
                select: { id: true, chassisNumber: true },
              });
              vehicle = candidates.find(
                (v) => v.chassisNumber.replace(/[\s-]/g, "").toLowerCase() === stripped
              ) || null;
            }

            if (vehicle) {
              console.log(`🔗 Auto-linking ${docType} to vehicle #${vehicle.id} (${chassisNumber})`);

              // Create VehicleDocument record
              await prisma.vehicleDocument.create({
                data: {
                  vehicleId: vehicle.id,
                  Url: fileUrl,
                  docType,
                },
              });

              // Update vehicle documentStatus
              const docTypeLabel = DOCUMENT_TYPES[docType]?.labelJa || docType;
              const currentStatus = vehicle.documentStatus || "";
              const newStatus = currentStatus
                ? `${currentStatus}, ${docTypeLabel}`
                : docTypeLabel;

              await prisma.vehicle.update({
                where: { id: vehicle.id },
                data: { documentStatus: newStatus },
              });

              // Sync size fields to Vehicle (only update null fields)
              const sizeUpdates = {};
              if (extracted.length  && !vehicle.length)  sizeUpdates.length = parseInt(extracted.length)  || undefined;
              if (extracted.width   && !vehicle.width)    sizeUpdates.width  = parseInt(extracted.width)   || undefined;
              if (extracted.height  && !vehicle.height)   sizeUpdates.height = parseInt(extracted.height)  || undefined;
              if (extracted.m3      && vehicle.m3 == null) sizeUpdates.m3    = parseFloat(extracted.m3)    || undefined;

              // Remove undefined entries
              for (const k of Object.keys(sizeUpdates)) {
                if (sizeUpdates[k] === undefined) delete sizeUpdates[k];
              }

              if (Object.keys(sizeUpdates).length > 0) {
                await prisma.vehicle.update({
                  where: { id: vehicle.id },
                  data: sizeUpdates,
                });
                console.log(`📐 Synced size fields to vehicle #${vehicle.id}:`, sizeUpdates);
              }

              // Update the InvoiceJob JSON with linking info
              await prisma.invoiceJobs.update({
                where: { id: invoiceJobId },
                data: {
                  Json: {
                    extracted,
                    docType,
                    linkedVehicleId: vehicle.id,
                    linkedChassisNumber: chassisNumber,
                  },
                },
              });

              // Audit trail — AI auto-linked document (fire-and-forget)
              logVehicleAudit(prisma, {
                vehicleId: vehicle.id,
                action: "link_document",
                actor: "ai",
                actorId: userId ? String(userId) : null,
                source: `ai_auto_link:${invoiceJobId}`,
                metadata: { docType, chassisNumber },
              });

              console.log(`✅ Auto-linked ${docType} document to vehicle #${vehicle.id}`);
            } else {
              console.log(`⚠️ No vehicle found for chassis ${chassisNumber} in company ${companyId} — document saved for manual linking`);
            }
          } catch (linkErr) {
            console.error(`❌ Auto-link failed for chassis ${chassisNumber}:`, linkErr.message);
            // Don't fail the whole job — extraction succeeded, linking is optional
          }
        }

      } catch (err) {
        console.error(`❌ Document extraction failed for InvoiceJob #${invoiceJobId}:`, err.message);

        if (err instanceof QuotaExhaustedError) {
          console.warn(`⏳ InvoiceJob #${invoiceJobId}: quota exhausted, re-queuing in 30 minutes`);
          await prisma.invoiceJobs.update({
            where: { id: invoiceJobId },
            data: { status: "pending" },
          });
          await boss.send("extract-document", job.data, { startAfter: QUOTA_REQUEUE_DELAY_SECONDS });
          return;
        }

        // Mark job as failed
        await prisma.invoiceJobs.update({
          where: { id: invoiceJobId },
          data: {
            status: "failed",
            Json: { error: err.message },
          },
        });

      }
    });
  } catch (err) {
    console.error("❌ Failed to start documentExtract worker:", err);
    process.exit(1);
  }
})();

process.on("SIGTERM", async () => {
  try {
    if (boss && typeof boss.stop === "function") await boss.stop();
    await prisma.$disconnect();
  } catch (error) {
  } finally {
    process.exit(0);
  }
});

process.on("SIGINT", async () => {
  try {
    if (boss && typeof boss.stop === "function") await boss.stop();
    await prisma.$disconnect();
  } catch (error) {
  } finally {
    process.exit(0);
  }
});
