import { ensureQueue } from "../queues/pgBoss.mjs";
import { processPageWithGemini } from "./geminiProcess.mjs";
import { prisma } from "../PrismaClient/prismaClient.mjs";
import NotificationService from "../services/notificationService.mjs";

let boss;

(async () => {
  try {
    console.log("[worker] starting: gemini-extract-page");

    boss = await ensureQueue("gemini-extract-page");

    if (boss && typeof boss.on === "function") {
      boss.on("error", err => console.error("[pg-boss] error:", err));
    }

    console.log("[worker] registering handler for: gemini-extract-page");

    // Process pages SEQUENTIALLY (teamConcurrency: 1) to avoid Gemini rate limits
    // With retry logic in geminiProcess.mjs, we process one at a time to be safe
    await boss.work("gemini-extract-page", { teamConcurrency: 1 }, async ([job]) => {
      const { invoiceJobId, pageUrl, pageNumber, totalPages, companyId, userId } = job.data;

      console.log(`📄 Processing page ${pageNumber}/${totalPages} for InvoiceJob #${invoiceJobId}`);
      console.log(`📄 Page URL: ${pageUrl}`);

      try {
        // Update status to processing
        await prisma.invoiceJobs.update({
          where: { id: invoiceJobId },
          data: { status: 'processing' }
        });

        // Process with Gemini (returns unwrapped vehicle array)
        const vehicles = await processPageWithGemini(pageUrl, pageNumber);

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

        console.log(`✅ InvoiceJob #${invoiceJobId} (page ${pageNumber}) completed: ${vehicles.length} vehicles, status=${status}`);

        // Send notification for this job
        if (userId) {
          try {
            const invoiceJob = await prisma.invoiceJobs.findUnique({
              where: { id: invoiceJobId }
            });

            if (vehicles.length > 0) {
              await NotificationService.sendInvoiceProcessedNotification(
                userId,
                companyId,
                invoiceJob
              );
            }
            // Don't send notification for empty pages
          } catch (notifyErr) {
            console.error("❌ Failed to send notification:", notifyErr);
          }
        }

      } catch (err) {
        console.error(`❌ InvoiceJob #${invoiceJobId} (page ${pageNumber}) failed:`, err.message);

        // Mark job as failed
        await prisma.invoiceJobs.update({
          where: { id: invoiceJobId },
          data: {
            status: 'failed',
            Json: { error: err.message }
          }
        });

        // Send failure notification
        if (userId) {
          try {
            await NotificationService.sendInvoiceFailedNotification(
              userId,
              companyId,
              `Page ${pageNumber}`,
              err.message
            );
          } catch (notifyErr) {
            console.error("❌ Failed to send failure notification:", notifyErr);
          }
        }

        // Don't re-throw - we've recorded the failure
      }
    });

    console.log("[worker] ready and waiting for jobs: gemini-extract-page");
  } catch (err) {
    console.error("[worker] failed to start:", err && err.message ? err.message : err);
    process.exit(1);
  }
})();

process.on("SIGTERM", async () => {
  console.log("🛑 [invoicePage] SIGTERM received, shutting down...");
  try {
    if (boss && typeof boss.stop === "function") {
      await boss.stop();
      console.log("✅ [invoicePage] pg-boss stopped");
    }
    await prisma.$disconnect();
  } catch (error) {
    console.error("❌ [invoicePage] Error during shutdown:", error);
  } finally {
    process.exit(0);
  }
});

process.on("SIGINT", async () => {
  console.log("🛑 [invoicePage] SIGINT received, shutting down...");
  try {
    if (boss && typeof boss.stop === "function") {
      await boss.stop();
      console.log("✅ [invoicePage] pg-boss stopped");
    }
    await prisma.$disconnect();
  } catch (error) {
    console.error("❌ [invoicePage] Error during shutdown:", error);
  } finally {
    process.exit(0);
  }
});
