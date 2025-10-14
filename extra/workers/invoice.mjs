import { initQueue } from "../queues/pdfInvoice.mjs";
import { processInvoiceWithGemini } from "./geminiProcess.mjs";
import { prisma } from "../PrismaClient/prismaClient.mjs";

(async () => {
  try {
    console.log("[worker] starting: gemini-extract");

    const boss = await initQueue();

    // surface any connection-level errors
    if (boss && typeof boss.on === "function") {
      boss.on("error", err => console.error("[pg-boss] error:", err));
    }

    console.log("[worker] registering handler for: gemini-extract");
    // pg-boss passes the job object (not an array). Handler must return/throw to mark success/failure.
    await boss.work("gemini-extract", async ([job]) => {
      let filePath = job && job.data && (job.data.fileUrl || job.data.filePath || job.data.path);
      let companyId = job && job.data && job.data.companyId;
      console.log("📄 Processing job:", job && job.id, filePath);

      if (!filePath) {
        const err = new Error("Missing file path/url on job data");
        console.error("❌", err.message, "job=", job && job.id);
        throw err;
      }

      try {
        const results = await processInvoiceWithGemini(filePath);

        if (companyId === undefined || companyId === null) {
          throw new Error("Missing companyId for InvoiceJobs");
        }

        const payload = {
          companyId: companyId,
          DocumentURL: filePath || null,
          Json: results,
        };

        const created = await prisma.invoiceJobs.create({ data: payload });
        console.log("✅ Invoice processed and stored", job.id);
      } catch (err) {
        console.error("❌ Gemini processing failed for job", job && job.id, err && err.message ? err.message : err);
        // If Prisma error, log more details when available
        if (err && err.meta) console.error("Prisma meta:", err.meta);
        // rethrow so pg-boss marks job failed / retries
        throw err;
      }
    });

    console.log("[worker] ready and waiting for jobs: gemini-extract");
  } catch (err) {
    console.error("[worker] failed to start:", err && err.message ? err.message : err);
    process.exit(1);
  }
})();
