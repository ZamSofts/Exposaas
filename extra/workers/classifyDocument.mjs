/**
 * Document Classification Worker
 *
 * Listens on "classify-document" queue.
 * Downloads page 1 of the PDF, sends it to Gemini with the classification prompt,
 * then routes to the correct extraction pipeline based on the result.
 *
 * Flow:
 *   addDocument API → "classify-document" queue → THIS WORKER
 *     ├→ invoice      → "gemini-extract" queue → existing invoice pipeline (unchanged)
 *     ├→ export_cert  → "extract-document" queue → documentExtract worker
 *     ├→ inspection_cert → "extract-document" queue → documentExtract worker
 *     ├→ temp_cancel  → "extract-document" queue → documentExtract worker
 *     └→ unknown      → save with status "needs_classification", notify user
 */

import { ensureQueue } from "../queues/pgBoss.mjs";
import { processPageWithGemini, QuotaExhaustedError } from "./geminiProcess.mjs";
import { prisma } from "../PrismaClient/prismaClient.mjs";
import { downloadFile } from "../../src/lib/blob.mjs";
import { splitAndUploadPages } from "../utils/pdfSplitter.mjs";
import {
  CLASSIFICATION_PROMPT,
  CLASSIFICATION_CONFIDENCE_THRESHOLD,
  DOCUMENT_TYPES,
} from "../ai/classificationSchema.mjs";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ClassificationSchema } from "../ai/zodSchemas.mjs";

/** Structured Output config for classification */
const classificationResponseConfig = {
  responseMimeType: "application/json",
  responseJsonSchema: zodToJsonSchema(ClassificationSchema),
};

import { streamToBuffer } from "../utils/streamUtils.mjs";
import { QUOTA_REQUEUE_DELAY_SECONDS } from "../../src/config/aiConstants.mjs";

let boss;

(async () => {
  try {
    boss = await ensureQueue("classify-document");
    // Ensure downstream queues exist
    await ensureQueue("gemini-extract");
    await ensureQueue("extract-document");

    if (boss && typeof boss.on === "function") {
      boss.on("error", (err) => console.error("[pg-boss] error:", err));
    }

    await boss.work("classify-document", { teamConcurrency: 1 }, async ([job]) => {
      const { fileUrl, companyId, userId, userName, emailMessageId } = job.data;

      // Helper: update EmailMessage status (only for email-sourced documents)
      async function updateEmailMessage(status, skipReason = null) {
        if (!emailMessageId) return;
        try {
          await prisma.emailMessage.update({
            where: { id: emailMessageId },
            data: { status, ...(skipReason && { skipReason }) },
          });
        } catch (e) {
          console.warn(`[classify] Failed to update EmailMessage #${emailMessageId}:`, e.message);
        }
      }

      console.log(`📋 Classifying document: ${fileUrl} for company ${companyId}`);

      if (!fileUrl) {
        console.error("❌ Missing fileUrl in classify-document job");
        return;
      }

      // Dedup: skip if this document was already processed (exists as DocumentURL or parentDocumentUrl)
      const alreadyProcessed = await prisma.invoiceJobs.count({
        where: {
          companyId,
          OR: [
            { DocumentURL: fileUrl },
            { parentDocumentUrl: fileUrl },
          ],
        },
      });
      if (alreadyProcessed > 0) {
        console.log(`⏭️ Skipping classification: ${alreadyProcessed} job(s) already exist for ${fileUrl}`);
        return;
      }

      try {
        // Step 1: Download the PDF and extract page 1 for classification
        const pdfStream = await downloadFile(fileUrl);
        const pdfBuffer = await streamToBuffer(pdfStream);

        // Extract page 1 only for classification (cheap Gemini call)
        const { PDFDocument } = await import("pdf-lib");
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        const singlePagePdf = await PDFDocument.create();
        const [copiedPage] = await singlePagePdf.copyPages(pdfDoc, [0]);
        singlePagePdf.addPage(copiedPage);
        const page1Bytes = await singlePagePdf.save();

        const totalPages = pdfDoc.getPageCount();

        // Step 2: Upload page 1 temporarily for Gemini processing
        const { putFile } = await import("../../src/lib/blob.mjs");
        const tempUpload = await putFile(
          {
            buffer: Buffer.from(page1Bytes),
            mimetype: "application/pdf",
            originalname: "classify_page1.pdf",
          },
          "documents/temp/"
        );

        // Step 3: Classify with Gemini (Structured Output ensures valid JSON)
        const classificationResult = await processPageWithGemini(
          tempUpload.url,
          1,
          {
            customPrompt: CLASSIFICATION_PROMPT,
            rawJsonResponse: true,
            responseConfig: classificationResponseConfig,
            model: "gemini-2.0-flash-lite",
          }
        );

        // Cleanup: delete temporary page-1 blob (fire-and-forget)
        try {
          const { deleteFile } = await import("../../src/lib/blob.mjs");
          await deleteFile(tempUpload.url);
        } catch (cleanupErr) {
          console.warn("[classify] Failed to delete temp blob:", cleanupErr.message);
        }

        // Validate with Zod (safeParse for graceful fallback)
        const parsed = ClassificationSchema.safeParse(classificationResult);
        const docType = parsed.success ? parsed.data.type : (classificationResult?.type || "unknown");
        const confidence = parsed.success ? parsed.data.confidence : (classificationResult?.confidence || 0);
        if (!parsed.success) {
          console.warn(`[classify] Zod validation failed:`, parsed.error.issues);
        }

        console.log(`📋 Classification result: type=${docType}, confidence=${confidence}`);

        // Step 4: Route based on classification result
        if (docType === "invoice") {
          // Route to existing invoice pipeline — dispatch to "gemini-extract" queue
          // This will split pages, create InvoiceJobs, and process each page
          console.log(`📄 Document classified as invoice → routing to gemini-extract pipeline`);
          await boss.send("gemini-extract", {
            fileUrl,
            companyId,
            userId,
            userName,
          });
          await updateEmailMessage("processed");
          return;
        }

        if (
          ["export_cert", "inspection_cert", "temp_cancel"].includes(docType) &&
          confidence >= CLASSIFICATION_CONFIDENCE_THRESHOLD
        ) {
          console.log(`📄 Document classified as ${docType} (confidence: ${confidence}), ${totalPages} page(s) → splitting and routing to extract-document`);

          // Split PDF into individual pages (same as invoice pipeline)
          const tempId = Date.now();
          const pages = await splitAndUploadPages(pdfBuffer, `doc_${tempId}`);

          // Create one InvoiceJob per page and queue each for extraction
          for (const page of pages) {
            const pageJob = await prisma.invoiceJobs.create({
              data: {
                companyId,
                DocumentURL: page.pageUrl,
                parentDocumentUrl: fileUrl,
                docType,
                status: "pending",
                pageNumber: page.pageNumber,
                originalTotalPages: pages.length,
                Json: {},
              },
            });

            await boss.send("extract-document", {
              invoiceJobId: pageJob.id,
              fileUrl: page.pageUrl,
              docType,
              companyId,
              userId,
            });
          }

          console.log(`📄 Created ${pages.length} extract-document job(s) for ${docType}`);
          await updateEmailMessage("processed");
          return;
        }

        // Unknown or low confidence
        console.log(`❓ Document classified as ${docType} (confidence: ${confidence})`);

        if (emailMessageId) {
          // Email-sourced: mark as skipped — do NOT create an InvoiceJob (keeps Documents page clean)
          console.log(`📧 Email-sourced unknown doc → marking EmailMessage #${emailMessageId} as skipped`);
          await updateEmailMessage(
            "skipped",
            `Classified as ${docType} (confidence: ${confidence.toFixed(2)})`
          );
          return;
        }

        // Manual upload: save as needs_classification so user can review
        console.log(`📋 Manual upload unknown doc → saving as needs_classification`);
        await prisma.invoiceJobs.create({
          data: {
            companyId,
            DocumentURL: fileUrl,
            docType: "unknown",
            status: "needs_classification",
            originalTotalPages: totalPages,
            pageNumber: 1,
            Json: {
              classificationResult: { type: docType, confidence },
            },
          },
        });

      } catch (err) {
        console.error(`❌ Classification failed for ${fileUrl}:`, err.message);

        if (err instanceof QuotaExhaustedError) {
          // Daily quota hit — re-queue with 30-min delay instead of marking failed
          console.warn(`⏳ Classification for ${fileUrl}: quota exhausted, re-queuing in 30 minutes`);
          await boss.send("classify-document", job.data, { startAfter: QUOTA_REQUEUE_DELAY_SECONDS });
          return;
        }

        // Update EmailMessage if email-sourced
        await updateEmailMessage("failed", err.message?.slice(0, 500));

        // Save failed InvoiceJob only for manual uploads
        if (!emailMessageId) {
          try {
            await prisma.invoiceJobs.create({
              data: {
                companyId,
                DocumentURL: fileUrl,
                docType: "unknown",
                status: "failed",
                Json: { error: err.message },
              },
            });
          } catch (dbErr) {
            console.error("❌ Failed to save failed job:", dbErr);
          }
        }

      }
    });
  } catch (err) {
    console.error("❌ Failed to start classifyDocument worker:", err);
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
