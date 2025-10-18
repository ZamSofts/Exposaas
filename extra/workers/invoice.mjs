import { initQueue } from "../queues/pdfInvoice.mjs";
import { processInvoiceWithGemini } from "./geminiProcess.mjs";
import { prisma } from "../PrismaClient/prismaClient.mjs";
import NotificationService from "../services/notificationService.mjs";

(async () => {
  try {
    console.log("[worker] starting: gemini-extract");

    const boss = await initQueue();

    // surface any connection-level errors
    if (boss && typeof boss.on === "function") {
      boss.on("error", err => console.error("[pg-boss] error:", err));
    }

    console.log("[worker] registering handler for: gemini-extract");
    await boss.work("gemini-extract", async ([job]) => {
      let filePath = job && job.data && (job.data.fileUrl || job.data.filePath || job.data.path);
      let companyId = job && job.data && job.data.companyId;
      let userId = job && job.data && job.data.userId; // Get userId from job data
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
        
        if (userId) {
          try {
            await NotificationService.sendInvoiceProcessedNotification(
              userId,
              companyId,
              created
            );
            console.log("🔔 Success notification sent to user", userId);
          } catch (notifyErr) {
            console.error("❌ Failed to send success notification:", notifyErr);
          }
        } else {
          console.warn("⚠️ No userId provided, cannot send notification");
        }
        
      } catch (err) {
        console.error("❌ Gemini processing failed for job", job && job.id, err && err.message ? err.message : err);
        
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
