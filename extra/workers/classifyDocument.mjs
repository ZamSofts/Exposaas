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
import { processPageWithGemini } from "./geminiProcess.mjs";
import { prisma } from "../PrismaClient/prismaClient.mjs";
import { downloadFile } from "../../src/lib/blob.mjs";
import { splitAndUploadPages } from "../utils/pdfSplitter.mjs";
import {
  CLASSIFICATION_PROMPT,
  CLASSIFICATION_CONFIDENCE_THRESHOLD,
  DOCUMENT_TYPES,
} from "../ai/classificationSchema.mjs";

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
    boss = await ensureQueue("classify-document");
    // Ensure downstream queues exist
    await ensureQueue("gemini-extract");
    await ensureQueue("extract-document");

    if (boss && typeof boss.on === "function") {
      boss.on("error", (err) => console.error("[pg-boss] error:", err));
    }

    await boss.work("classify-document", { teamConcurrency: 1 }, async ([job]) => {
      const { fileUrl, companyId, userId, userName } = job.data;

      console.log(`📋 Classifying document: ${fileUrl} for company ${companyId}`);

      if (!fileUrl) {
        console.error("❌ Missing fileUrl in classify-document job");
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

        // Step 3: Classify with Gemini
        const classificationResult = await processPageWithGemini(
          tempUpload.url,
          1,
          {
            customPrompt: CLASSIFICATION_PROMPT,
            rawJsonResponse: true,
          }
        );

        const docType = classificationResult?.type || "unknown";
        const confidence = classificationResult?.confidence || 0;

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
          return;
        }

        // Unknown or low confidence — save and notify user
        console.log(`❓ Document classified as ${docType} (confidence: ${confidence}) → saving as unknown`);

        const unknownJob = await prisma.invoiceJobs.create({
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

        // Save as failed
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
