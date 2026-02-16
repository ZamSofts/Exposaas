import { prisma, getSession } from "@/lib/useful";

export default async function handler(req, res) {
  const session = await getSession(req, res);

  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const search = String(req.query.search || "").trim();
  const { sortBy = "id", sortOrder = "asc", DocumentURL } = req.query || {};
  const col = req.query.col ? String(req.query.col).split(",") : null;
  const selectFields = col && col.length > 0 ? Object.fromEntries(col.map(c => [c, true])) : undefined;

  try {
    if (req.method === "GET") {
      const id = Number(req.query.id) || 0;

      // Sadmin can see all, others only their company
      const userFilter = session.role === "Sadmin" ? {} : { companyId: session?.companyId };
      if (!userFilter.companyId && session.role !== "Sadmin") {
        return res.status(400).json({ error: "Missing companyId and no company available in session" });
      }

      // single item
      if (id) {
        // When includeCorrections is requested, ensure isEvaluated is always fetched
        const effectiveSelect = selectFields && req.query.includeCorrections === "1"
          ? { ...selectFields, isEvaluated: true }
          : selectFields;

        const item = await prisma.invoiceJobs.findUnique({
          where: { id },
          ...(effectiveSelect ? { select: effectiveSelect } : {})
        });

        // Optionally include the latest user-corrected data from PaymentConfirmation
        if (req.query.includeCorrections === "1" && item?.isEvaluated) {
          const latestCorrection = await prisma.paymentConfirmation.findFirst({
            where: { invoiceJobId: id },
            orderBy: { createdAt: "desc" },
            select: { id: true, Json: true, createdAt: true },
          });
          if (latestCorrection) {
            return res.status(200).json({
              ...item,
              _correctedJson: latestCorrection.Json,
              _correctionId: latestCorrection.id,
            });
          }
        }

        return res.status(200).json(item);
      }

      const where = { ...userFilter };
      if (DocumentURL) where.DocumentURL = String(DocumentURL);

      // Filter by docType (e.g., ?docType=invoice or ?docType=export_cert)
      const docType = req.query.docType;
      if (docType) where.docType = String(docType);

      const trimmed = search;
      let searchFilter = {};
      if (trimmed) {
        const or = [];
        if (!isNaN(Number(trimmed))) or.push({ id: Number(trimmed) });
        or.push({ DocumentURL: { contains: trimmed, mode: "insensitive" } });
        searchFilter = { OR: or };
      }

      const take = Number(limit);
      const skip = (Number(page) - 1) * take;
      const finalWhere = searchFilter.OR ? { AND: [where, searchFilter] } : where;

      const flatten = req.query.flatten === "1" || req.query.flatten === "true";

      if (!flatten) {
        const [items, total] = await Promise.all([
          prisma.invoiceJobs.findMany({
            where: finalWhere,
            ...(selectFields ? { select: selectFields } : {}),
            orderBy: { [sortBy]: sortOrder },
            skip,
            take
          }),
          prisma.invoiceJobs.count({ where: finalWhere }),
        ]);

        return res.json({ data: items, total });
      }

      const rows = await prisma.invoiceJobs.findMany({
        where: finalWhere,
        ...(selectFields ? { select: selectFields } : {}),
        orderBy: { [sortBy]: sortOrder }
      });
      return res.json({ data: rows, total: rows.length });
    }

    // POST: Retry a failed InvoiceJob
    if (req.method === "POST") {
      const { action, id } = req.body;

      if (action === "retry" && id) {
        // Find the failed job
        const job = await prisma.invoiceJobs.findUnique({
          where: { id: Number(id) }
        });

        if (!job) {
          return res.status(404).json({ error: "InvoiceJob not found" });
        }

        // Check ownership (unless Sadmin)
        if (session.role !== "Sadmin" && job.companyId !== session.companyId) {
          return res.status(403).json({ error: "Not authorized to retry this job" });
        }

        // Only retry failed jobs
        if (job.status !== "failed") {
          return res.status(400).json({ error: `Cannot retry job with status: ${job.status}` });
        }

        // Reset job status to pending
        await prisma.invoiceJobs.update({
          where: { id: Number(id) },
          data: {
            status: "pending",
            Json: null  // Clear previous error
          }
        });

        // Re-queue the job for processing (dynamic import to avoid bundling pg-boss for GET requests)
        const { ensureQueue } = await import("../../../extra/queues/pgBoss.mjs");
        const boss = await ensureQueue("gemini-extract-page");
        await boss.send("gemini-extract-page", {
          invoiceJobId: job.id,
          pageUrl: job.DocumentURL,
          pageNumber: job.pageNumber || 1,
          totalPages: job.originalTotalPages || 1,
          companyId: job.companyId,
          userId: session.userId
        });

        console.log(`🔄 Retrying InvoiceJob #${job.id} (page ${job.pageNumber})`);

        return res.status(200).json({
          success: true,
          message: `Job #${job.id} queued for retry`,
          jobId: job.id
        });
      }

      return res.status(400).json({ error: "Invalid action" });
    }
  } catch (err) {
    console.error("InvoiceJobs API error:", err);
    return res.status(500).json({ error: "Internal server error", details: err?.message });
  }
}
