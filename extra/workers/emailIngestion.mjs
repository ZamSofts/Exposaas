/**
 * Email Ingestion Worker
 *
 * Polls Gmail for each active GmailAccount on a 5-minute schedule.
 * Downloads PDF attachments, decrypts USS PDFs, uploads to blob,
 * and dispatches to the existing classify-document queue.
 *
 * Flow:
 *   pg-boss schedule (every 5 min) -> "email-poll" queue -> THIS WORKER
 *     For each active GmailAccount:
 *       -> Poll Gmail (incremental via historyId)
 *       -> For each new message with PDF attachment:
 *         -> Download attachment
 *         -> (USS) Decrypt with qpdf + stored password
 *         -> Upload to Azure Blob Storage
 *         -> Dedup check (EmailMessage @@unique)
 *         -> Queue to "classify-document"
 *         -> Save EmailMessage record
 */

import { initQueue } from "../queues/emailIngestion.mjs";
import { ensureQueue } from "../queues/pgBoss.mjs";
import { prisma } from "../PrismaClient/prismaClient.mjs";
import { putFile } from "../../src/lib/blob.mjs";
import {
  getGmailClient,
  fetchNewMessages,
  downloadAttachment,
  getPdfAttachments,
} from "../utils/gmailClient.mjs";
import { decryptPdf, isEncryptedPdf } from "../utils/pdfDecrypt.mjs";

// USS sender address for password-protected PDF detection
const USS_SENDER = "auction-invoice-send@ussnet.co.jp";

function extractSender(headers) {
  const from = headers?.find((h) => h.name === "From")?.value || "";
  const match = from.match(/<([^>]+)>/);
  return match ? match[1].toLowerCase() : from.toLowerCase().trim();
}

function extractHeader(headers, name) {
  return headers?.find((h) => h.name === name)?.value || null;
}

let boss;

(async () => {
  try {
    boss = await initQueue();
    await ensureQueue("classify-document");

    if (boss && typeof boss.on === "function") {
      boss.on("error", (err) => console.error("[pg-boss] error:", err));
    }

    // Register recurring schedule: every 5 minutes
    await boss.schedule("email-poll", "*/5 * * * *", {});
    console.log("📧 Email poll scheduled every 5 minutes");

    await boss.work("email-poll", { teamConcurrency: 1 }, async ([job]) => {
      console.log("📧 Starting email poll cycle...");

      const accounts = await prisma.gmailAccount.findMany({
        where: { isActive: true },
      });

      if (accounts.length === 0) {
        console.log("📧 No active Gmail accounts, skipping poll");
        return;
      }

      for (const account of accounts) {
        try {
          await processAccount(account);
        } catch (err) {
          console.error(
            `❌ [email] Error processing account ${account.email}:`,
            err.message
          );

          // If auth fails, deactivate account until user re-authenticates
          if (err.code === 401 || err.code === 403) {
            await prisma.gmailAccount.update({
              where: { id: account.id },
              data: { isActive: false },
            });
            console.warn(
              `⚠️ [email] Deactivated account ${account.email} due to auth failure`
            );
          }
        }
      }
    });
  } catch (err) {
    console.error("❌ Failed to start emailIngestion worker:", err);
    process.exit(1);
  }
})();

async function processAccount(account) {
  console.log(`📧 Polling ${account.email} (company ${account.companyId})`);

  const { messages, newHistoryId } = await fetchNewMessages(
    account.refreshToken,
    account.lastHistoryId
  );

  console.log(`📧 Found ${messages.length} new message(s) for ${account.email}`);

  let processed = 0;

  for (const msgRef of messages) {
    try {
      // Dedup check first (before downloading attachment)
      const existing = await prisma.emailMessage.findUnique({
        where: {
          gmailAccountId_gmailMessageId: {
            gmailAccountId: account.id,
            gmailMessageId: msgRef.id,
          },
        },
      });
      if (existing) continue;

      // Fetch full message (need MIME parts for attachment extraction)
      const gmail = getGmailClient(account.refreshToken);
      const fullMsg = await gmail.users.messages.get({
        userId: "me",
        id: msgRef.id,
        format: "full",
      });

      const headers = fullMsg.data.payload?.headers || [];
      const fromAddress = extractSender(headers);
      const subject = extractHeader(headers, "Subject");
      const dateStr = extractHeader(headers, "Date");
      const receivedAt = dateStr ? new Date(dateStr) : null;

      // Find PDF attachments in MIME tree
      const payload = fullMsg.data.payload;
      const pdfAttachments = getPdfAttachments(payload?.parts || [payload]);

      if (pdfAttachments.length === 0) {
        await prisma.emailMessage.create({
          data: {
            gmailAccountId: account.id,
            gmailMessageId: msgRef.id,
            subject,
            fromAddress,
            receivedAt,
            status: "skipped",
            skipReason: "No PDF attachment",
          },
        });
        continue;
      }

      // Process first PDF (requirement: each email has exactly one)
      const pdfInfo = pdfAttachments[0];
      let pdfBuffer = await downloadAttachment(
        account.refreshToken,
        msgRef.id,
        pdfInfo.attachmentId
      );

      // USS detection: decrypt if password-protected
      const isUss = fromAddress === USS_SENDER;
      if (isUss || isEncryptedPdf(pdfBuffer)) {
        if (!account.ussPassword) {
          await prisma.emailMessage.create({
            data: {
              gmailAccountId: account.id,
              gmailMessageId: msgRef.id,
              subject,
              fromAddress,
              receivedAt,
              status: "failed",
              skipReason: "USS password not configured",
            },
          });
          continue;
        }

        try {
          pdfBuffer = await decryptPdf(pdfBuffer, account.ussPassword);
        } catch (decryptErr) {
          await prisma.emailMessage.create({
            data: {
              gmailAccountId: account.id,
              gmailMessageId: msgRef.id,
              subject,
              fromAddress,
              receivedAt,
              status: "failed",
              skipReason: `Decryption failed: ${decryptErr.message}`,
            },
          });
          continue;
        }
      }

      // Upload to Azure Blob Storage
      const { url: blobUrl } = await putFile(
        {
          buffer: pdfBuffer,
          mimetype: "application/pdf",
          originalname: pdfInfo.filename || "email-attachment.pdf",
        },
        "email/"
      );

      // Queue to classify-document (same payload as addDocument.js)
      await boss.send("classify-document", {
        fileUrl: blobUrl,
        companyId: account.companyId,
        userId: null,
        userName: "email-ingestion",
      });

      // Save EmailMessage record
      await prisma.emailMessage.create({
        data: {
          gmailAccountId: account.id,
          gmailMessageId: msgRef.id,
          subject,
          fromAddress,
          receivedAt,
          attachmentUrl: blobUrl,
          status: "processed",
        },
      });

      processed++;
    } catch (msgErr) {
      console.error(
        `❌ [email] Error processing message ${msgRef.id}:`,
        msgErr.message
      );

      // Fire-and-forget error recording (same pattern as audit logging)
      try {
        await prisma.emailMessage.create({
          data: {
            gmailAccountId: account.id,
            gmailMessageId: msgRef.id,
            status: "failed",
            skipReason: msgErr.message?.slice(0, 500),
          },
        });
      } catch (recordErr) {
        console.warn("Failed to record email error:", recordErr.message);
      }
    }
  }

  // Update lastHistoryId for next poll
  if (newHistoryId) {
    await prisma.gmailAccount.update({
      where: { id: account.id },
      data: { lastHistoryId: newHistoryId },
    });
  }

  console.log(
    `📧 Processed ${processed}/${messages.length} messages for ${account.email}`
  );
}

// Graceful shutdown
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
