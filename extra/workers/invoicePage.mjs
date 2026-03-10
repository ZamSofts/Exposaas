import { ensureQueue } from "../queues/pgBoss.mjs";
import { processPageWithGemini, QuotaExhaustedError } from "./geminiProcess.mjs";
import { prisma } from "../PrismaClient/prismaClient.mjs";
import { deleteFile } from "../../src/lib/blob.mjs";
import { zodToJsonSchema } from "zod-to-json-schema";
import { InvoicePageResponseSchema } from "../ai/zodSchemas.mjs";
import { MAX_VEHICLES_PER_PAGE, QUOTA_REQUEUE_DELAY_SECONDS } from "../../src/config/aiConstants.mjs";

/** Structured Output config for invoice extraction */
const invoiceResponseConfig = {
  responseMimeType: "application/json",
  responseJsonSchema: zodToJsonSchema(InvoicePageResponseSchema),
};

let boss;

(async () => {
  try {

    boss = await ensureQueue("gemini-extract-page");

    if (boss && typeof boss.on === "function") {
      boss.on("error", err => console.error("[pg-boss] error:", err));
    }

    await boss.work("gemini-extract-page", { teamConcurrency: 1 }, async ([job]) => {
      const { invoiceJobId, pageUrl, pageNumber, totalPages, companyId, userId } = job.data;

      try {
        // Update status to processing
        await prisma.invoiceJobs.update({
          where: { id: invoiceJobId },
          data: { status: 'processing' }
        });

        // Process with Gemini (returns unwrapped vehicle array)
        const vehicles = await processPageWithGemini(pageUrl, pageNumber, {
          companyId,
          responseConfig: invoiceResponseConfig,
        });

        // Soft Zod validation — log warnings but don't reject (Gemini Structured Output enforces schema)
        if (Array.isArray(vehicles)) {
          for (let i = 0; i < vehicles.length; i++) {
            const parsed = InvoicePageResponseSchema.shape.page_1.element.safeParse(vehicles[i]);
            if (!parsed.success) {
              console.warn(
                `[invoicePage] Zod validation warning for vehicle ${i + 1} in InvoiceJob #${invoiceJobId}:`,
                parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join(", ")
              );
            }
          }
        }

        // Sanity check: reject AI hallucination (e.g. 1280 vehicles from a 2-vehicle page)
        if (vehicles.length > MAX_VEHICLES_PER_PAGE) {
          console.warn(`⚠️ InvoiceJob #${invoiceJobId}: AI returned ${vehicles.length} vehicles (max ${MAX_VEHICLES_PER_PAGE}) — marking as failed`);
          await prisma.invoiceJobs.update({
            where: { id: invoiceJobId },
            data: {
              status: 'failed',
              Json: { error: `AI hallucination: ${vehicles.length} vehicles exceeds max ${MAX_VEHICLES_PER_PAGE}` }
            }
          });
          return;
        }

        // Determine status based on result
        const status = vehicles.length > 0 ? 'completed' : 'empty';

        // Save result directly to InvoiceJob
        await prisma.invoiceJobs.update({
          where: { id: invoiceJobId },
          data: {
            Json: { items: vehicles },
            status
          }
        });

        // Cleanup: delete the split-page blob (fire-and-forget)
        if (pageUrl) {
          try { await deleteFile(pageUrl); }
          catch (cleanupErr) { console.warn(`[invoicePage] Failed to delete page blob:`, cleanupErr.message); }
        }

      } catch (err) {
        console.error(`❌ InvoiceJob #${invoiceJobId} (page ${pageNumber}) failed:`, err.message);

        if (err instanceof QuotaExhaustedError) {
          // Daily quota hit — reset status to pending and re-queue with 30-min delay
          console.warn(`⏳ InvoiceJob #${invoiceJobId}: quota exhausted, re-queuing in 30 minutes`);
          await prisma.invoiceJobs.update({
            where: { id: invoiceJobId },
            data: { status: 'pending' }
          });
          await boss.send("gemini-extract-page", job.data, { startAfter: QUOTA_REQUEUE_DELAY_SECONDS });
          return;
        }

        // Mark job as failed
        await prisma.invoiceJobs.update({
          where: { id: invoiceJobId },
          data: {
            status: 'failed',
            Json: { error: err.message }
          }
        });
      }
    });
  } catch (err) {
    process.exit(1);
  }
})();

process.on("SIGTERM", async () => {
  try {
    if (boss && typeof boss.stop === "function") {
      await boss.stop();
    }
    await prisma.$disconnect();
  } catch (error) {
  } finally {
    process.exit(0);
  }
});

process.on("SIGINT", async () => {
  try {
    if (boss && typeof boss.stop === "function") {
      await boss.stop();
    }
    await prisma.$disconnect();
  } catch (error) {
  } finally {
    process.exit(0);
  }
});
