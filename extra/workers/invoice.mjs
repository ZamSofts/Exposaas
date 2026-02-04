import { initQueue } from "../queues/pdfInvoice.mjs";
import { ensureQueue } from "../queues/pgBoss.mjs";
import { splitAndUploadPages } from "../utils/pdfSplitter.mjs";
import { downloadFile } from "../../src/lib/blob.mjs";
import { prisma } from "../PrismaClient/prismaClient.mjs";
import NotificationService from "../services/notificationService.mjs";

/**
 * Convert a readable stream to a buffer
 */
async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

let boss;

(async () => {
  try {
    console.log("[worker] starting: gemini-extract");

    boss = await initQueue();

    // Also ensure the page processing queue exists
    await ensureQueue("gemini-extract-page");

    // surface any connection-level errors
    if (boss && typeof boss.on === "function") {
      boss.on("error", err => console.error("[pg-boss] error:", err));
    }

    console.log("[worker] registering handler for: gemini-extract");
    await boss.work("gemini-extract", async ([job]) => {
      let filePath = job && job.data && (job.data.fileUrl || job.data.filePath || job.data.path);
      let companyId = job && job.data && job.data.companyId;
      let userId = job && job.data && job.data.userId;

      console.log("📄 Processing job:", job && job.id, filePath, "for user:", userId);

      if (!filePath) {
        const err = new Error("Missing file path/url on job data");
        console.error("❌", err.message, "job=", job && job.id);

        if (userId && companyId) {
          try {
            await NotificationService.sendInvoiceFailedNotification(
              userId,
              companyId,
              filePath || 'Unknown',
              err.message
            );
          } catch (notifyErr) {
            console.error("❌ Failed to send failure notification:", notifyErr);
          }
        }

        throw err;
      }

      try {
        // 1. Download PDF from Azure
        console.log("📥 Downloading PDF:", filePath);
        const pdfStream = await downloadFile(filePath);
        const pdfBuffer = await streamToBuffer(pdfStream);
        console.log(`✅ Downloaded PDF: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);

        // 2. Split PDF into pages and upload to Azure
        // Use a temporary ID for folder organization (timestamp-based)
        const tempId = Date.now();
        const pages = await splitAndUploadPages(pdfBuffer, tempId);
        console.log(`✅ Split PDF into ${pages.length} pages`);

        // 3. Create SEPARATE InvoiceJob for EACH page
        const createdJobIds = [];
        for (const page of pages) {
          const pageJob = await prisma.invoiceJobs.create({
            data: {
              companyId,
              DocumentURL: page.pageUrl,        // Split page PDF URL
              parentDocumentUrl: filePath,      // Original multi-page PDF URL
              pageNumber: page.pageNumber,
              originalTotalPages: pages.length,
              status: 'pending',
              Json: {}
            }
          });
          createdJobIds.push(pageJob.id);

          // Queue page processing job
          await boss.send('gemini-extract-page', {
            invoiceJobId: pageJob.id,           // Direct job ID (not parent)
            pageUrl: page.pageUrl,
            pageNumber: page.pageNumber,
            totalPages: pages.length,
            companyId,
            userId
          });

          console.log(`✅ Created InvoiceJob #${pageJob.id} for page ${page.pageNumber}/${pages.length}`);
        }

        console.log(`✅ Created ${pages.length} InvoiceJobs and queued for Gemini processing`);

      } catch (err) {
        console.error("❌ PDF splitting/queueing failed for job", job && job.id, err && err.message ? err.message : err);

        if (userId && companyId) {
          try {
            await NotificationService.sendInvoiceFailedNotification(
              userId,
              companyId,
              filePath,
              err.message || 'Unknown error occurred during processing'
            );
            console.log("🔔 Failure notification sent to user", userId);
          } catch (notifyErr) {
            console.error("❌ Failed to send failure notification:", notifyErr);
          }
        }

        if (err && err.meta) console.error("Prisma meta:", err.meta);

        throw err;
      }
    });

    console.log("[worker] ready and waiting for jobs: gemini-extract");
  } catch (err) {
    console.error("[worker] failed to start:", err && err.message ? err.message : err);
    process.exit(1);
  }
})();

process.on("SIGTERM", async () => {
  console.log("🛑 [invoice] SIGTERM received, shutting down...");
  try {
    if (boss && typeof boss.stop === "function") {
      await boss.stop();
      console.log("✅ [invoice] pg-boss stopped");
    }
    await prisma.$disconnect();
  } catch (error) {
    console.error("❌ [invoice] Error during shutdown:", error);
  } finally {
    process.exit(0);
  }
});

process.on("SIGINT", async () => {
  console.log("🛑 [invoice] SIGINT received, shutting down...");
  try {
    if (boss && typeof boss.stop === "function") {
      await boss.stop();
      console.log("✅ [invoice] pg-boss stopped");
    }
    await prisma.$disconnect();
  } catch (error) {
    console.error("❌ [invoice] Error during shutdown:", error);
  } finally {
    process.exit(0);
  }
});
