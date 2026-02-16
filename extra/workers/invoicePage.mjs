import { ensureQueue } from "../queues/pgBoss.mjs";
import { processPageWithGemini } from "./geminiProcess.mjs";
import { prisma } from "../PrismaClient/prismaClient.mjs";
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
        const vehicles = await processPageWithGemini(pageUrl, pageNumber, { companyId });

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

        // Don't re-throw - we've recorded the failure
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
