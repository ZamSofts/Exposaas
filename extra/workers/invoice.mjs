import { initQueue } from "../queues/pdfInvoice.mjs";
import { ensureQueue } from "../queues/pgBoss.mjs";
import { splitAndUploadPages } from "../utils/pdfSplitter.mjs";
import { downloadFile } from "../../src/lib/blob.mjs";
import { prisma } from "../PrismaClient/prismaClient.mjs";
import { streamToBuffer } from "../utils/streamUtils.mjs";

let boss;

(async () => {
  try {

    boss = await initQueue();
    await ensureQueue("gemini-extract-page");

    // surface any connection-level errors
    if (boss && typeof boss.on === "function") {
      boss.on("error", err => console.error("[pg-boss] error:", err));
    }

    console.log("🚀 Invoice worker started and listening...");

    await boss.work("gemini-extract", async ([job]) => {
      let filePath = job && job.data && (job.data.fileUrl || job.data.filePath || job.data.path);
      let companyId = job && job.data && job.data.companyId;
      let userId = job && job.data && job.data.userId;

      console.log("📄 Processing job:", job && job.id, filePath, "for user:", userId);

      if (!filePath) {
        throw new Error("Missing file path/url on job data");
      }

      // Dedup: skip if InvoiceJobs already exist for this document
      const existingJobs = await prisma.invoiceJobs.count({
        where: { parentDocumentUrl: filePath, companyId }
      });
      if (existingJobs > 0) {
        console.log(`⏭️ Skipping duplicate: ${existingJobs} InvoiceJob(s) already exist for ${filePath}`);
        return;
      }

      // Create AuctionInvoice as the parent entity for this invoice
      const auctionInvoice = await prisma.auctionInvoice.create({
        data: {
          companyId,
          parentDocumentUrl: filePath,
          status: 'pending',
        }
      });
      console.log(`📋 AuctionInvoice created: id=${auctionInvoice.id}`);

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
              auctionInvoiceId: auctionInvoice.id,
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
            userId,
            auctionInvoiceId: auctionInvoice.id,
          });

        }
      } catch (err) {
        if (err && err.meta) console.error("Prisma meta:", err.meta);

        // Create a failed InvoiceJob so the error is visible in the documents page
        try {
          await prisma.invoiceJobs.create({
            data: {
              companyId,
              DocumentURL: filePath,
              docType: "invoice",
              status: "failed",
              Json: { error: err.message },
            },
          });
        } catch (dbErr) {
          console.error("Failed to save failed job record:", dbErr);
        }

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
