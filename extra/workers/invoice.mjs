import { initQueue } from "../queues/pdfInvoice.mjs";
import { ensureQueue } from "../queues/pgBoss.mjs";
import { splitAndUploadPages } from "../utils/pdfSplitter.mjs";
import { downloadFile } from "../../src/lib/blob.mjs";
import { prisma } from "../PrismaClient/prismaClient.mjs";
import NotificationService from "../services/notificationService.mjs";

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

    boss = await initQueue();
    await ensureQueue("gemini-extract-page");

    // surface any connection-level errors
    if (boss && typeof boss.on === "function") {
      boss.on("error", err => console.error("[pg-boss] error:", err));
    }

    await boss.work("gemini-extract", async ([job]) => {
      let filePath = job && job.data && (job.data.fileUrl || job.data.filePath || job.data.path);
      let companyId = job && job.data && job.data.companyId;
      let userId = job && job.data && job.data.userId;

      console.log("📄 Processing job:", job && job.id, filePath, "for user:", userId);

      if (!filePath) {
        const err = new Error("Missing file path/url on job data");
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
        const pdfStream = await downloadFile(filePath);
        const pdfBuffer = await streamToBuffer(pdfStream);

        const tempId = Date.now();
        const pages = await splitAndUploadPages(pdfBuffer, tempId);

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

        }
      } catch (err) {
        if (userId && companyId) {
          try {
            await NotificationService.sendInvoiceFailedNotification(
              userId,
              companyId,
              filePath,
              err.message || 'Unknown error occurred during processing'
            );
          } catch (notifyErr) {
            console.error("❌ Failed to send failure notification:", notifyErr);
          }
        }

        if (err && err.meta) console.error("Prisma meta:", err.meta);

        throw err;
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
