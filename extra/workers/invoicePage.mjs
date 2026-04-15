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
  // responseJsonSchema: zodToJsonSchema(InvoicePageResponseSchema), //THIS WAS MAKING BIGG ISSUE IN THE GEMINI RESPONSE. 
};

let boss;

(async () => {
  try {

    boss = await ensureQueue("gemini-extract-page");
    await ensureQueue("gemini-extract-header");

    if (boss && typeof boss.on === "function") {
      boss.on("error", err => console.error("[pg-boss] error:", err));
    }

    await boss.work("gemini-extract-page", { teamConcurrency: 1 }, async ([job]) => {
      const { invoiceJobId, pageUrl, pageNumber, totalPages, companyId, userId, auctionInvoiceId } = job.data;

      try {
        // Update status to processing
        await prisma.invoiceJobs.update({
          where: { id: invoiceJobId },
          data: { status: 'processing' }
        });

        // Process with Gemini — get raw JSON to extract invoice-level header fields
        const rawResponse = await processPageWithGemini(pageUrl, pageNumber, {
          companyId,
          responseConfig: invoiceResponseConfig,
          rawJsonResponse: true,
        });

        // Extract vehicles from the raw response
        const vehicles = Array.isArray(rawResponse?.page_1) ? rawResponse.page_1
          : Array.isArray(rawResponse?.items) ? rawResponse.items
          : Array.isArray(rawResponse) ? rawResponse
          : [];

        // Extract invoice-level header fields
        const sessionNumber = rawResponse?.session ?? null;
        const invoiceTotal = Number.isInteger(rawResponse?.invoice_total)
          ? rawResponse.invoice_total : null;

        // invoice_total is only reliable on the last page
        const isLastPage = pageNumber === totalPages;

        // Soft Zod validation — log warnings but don't reject
        for (let i = 0; i < vehicles.length; i++) {
          const parsed = InvoicePageResponseSchema.shape.page_1.element.safeParse(vehicles[i]);
          if (!parsed.success) {
            console.warn(
              `[invoicePage] Zod validation warning for vehicle ${i + 1} in InvoiceJob #${invoiceJobId}:`,
              parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join(", ")
            );
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
          await triggerHeaderExtractionIfAllDone(auctionInvoiceId);
          return;
        }

        // Determine status based on result
        const status = vehicles.length > 0 ? 'completed' : 'empty';

        // Save result to InvoiceJob — include invoice-level header fields in Json and DB columns
        await prisma.invoiceJobs.update({
          where: { id: invoiceJobId },
          data: {
            Json: { session: sessionNumber, invoice_total: invoiceTotal, items: vehicles },
            status,
            sessionNumber: sessionNumber ?? undefined,
            ...(isLastPage ? { invoiceTotal: invoiceTotal ?? undefined } : {}),
          }
        });

        // Trigger header extraction if all pages for this invoice are done
        await triggerHeaderExtractionIfAllDone(auctionInvoiceId);

        // Cleanup: delete the split-page blob (fire-and-forget)
        // Keep the last page blob alive — invoiceHeader worker needs it for header extraction
        const shouldKeepForHeaderExtraction = isLastPage && !!auctionInvoiceId;
        if (pageUrl && !shouldKeepForHeaderExtraction) {
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

        // Even on failure, check if all pages are done
        await triggerHeaderExtractionIfAllDone(auctionInvoiceId);
      }
    });
  } catch (err) {
    process.exit(1);
  }
})();

/** Check if all pages for an AuctionInvoice are done, and if so trigger header extraction */
async function triggerHeaderExtractionIfAllDone(auctionInvoiceId) {
  if (!auctionInvoiceId) return;
  try {
    const remaining = await prisma.invoiceJobs.count({
      where: {
        auctionInvoiceId,
        status: { in: ['pending', 'processing'] },
      }
    });
    if (remaining === 0) {
      console.log(`📋 All pages done for AuctionInvoice #${auctionInvoiceId} — triggering header extraction`);
      await boss.send("gemini-extract-header", { auctionInvoiceId });
    }
  } catch (err) {
    console.error(`[invoicePage] Failed to trigger header extraction for AuctionInvoice #${auctionInvoiceId}:`, err.message);
  }
}

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
