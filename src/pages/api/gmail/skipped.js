/**
 * Skipped Email Documents API
 *
 * GET  /api/gmail/skipped  — paginated list of email-sourced PDFs that were
 *                            skipped (classified as unknown/non-invoice)
 * POST /api/gmail/skipped  — action: "reclassify" → re-send to classify-document queue
 */

import { getSession, prisma } from "@/lib/useful";

export default async function handler(req, res) {
  const session = await getSession(req, res);

  // --- GET: list skipped EmailMessages for this company ---
  if (req.method === "GET") {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;

    // Find the GmailAccount for this company to scope results
    const account = await prisma.gmailAccount.findUnique({
      where: { companyId: session.companyId },
      select: { id: true },
    });

    if (!account) {
      return res.status(200).json({ data: [], total: 0 });
    }

    const where = {
      gmailAccountId: account.id,
      status: "skipped",
    };

    const [data, total] = await Promise.all([
      prisma.emailMessage.findMany({
        where,
        select: {
          id: true,
          subject: true,
          fromAddress: true,
          receivedAt: true,
          attachmentUrl: true,
          skipReason: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.emailMessage.count({ where }),
    ]);

    return res.status(200).json({ data, total });
  }

  // --- POST: reclassify a skipped email ---
  if (req.method === "POST") {
    const { action, emailMessageId } = req.body;

    if (action !== "reclassify" || !emailMessageId) {
      return res.status(400).json({ error: "Invalid action or missing emailMessageId" });
    }

    // Find and verify ownership via GmailAccount → companyId
    const emailMsg = await prisma.emailMessage.findUnique({
      where: { id: emailMessageId },
      include: { gmailAccount: { select: { companyId: true } } },
    });

    if (!emailMsg) {
      return res.status(404).json({ error: "EmailMessage not found" });
    }
    if (emailMsg.gmailAccount.companyId !== session.companyId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (!emailMsg.attachmentUrl) {
      return res.status(400).json({ error: "No attachment URL to reclassify" });
    }

    // Reset status and re-queue for classification
    await prisma.emailMessage.update({
      where: { id: emailMessageId },
      data: { status: "processing", skipReason: null },
    });

    const { ensureQueue } = await import("../../../../extra/queues/pgBoss.mjs");
    const boss = await ensureQueue("classify-document");
    await boss.send("classify-document", {
      fileUrl: emailMsg.attachmentUrl,
      companyId: session.companyId,
      userId: session.userId || null,
      userName: "reclassify",
      emailMessageId: emailMessageId,
    });

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
