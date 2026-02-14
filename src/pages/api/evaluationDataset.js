import { prisma, getSession } from "@/lib/useful";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  try {
    // GET: list golden records for company
    if (req.method === "GET") {
      const records = await prisma.paymentConfirmation.findMany({
        where: { companyId: session.companyId, isGolden: true },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          DocumentURL: true,
          Page: true,
          Json: true,
          isCorrect: true,
          auctionHouse: true,
          invoiceJobId: true,
          createdAt: true,
        },
      });

      // Enrich with vehicle count and InvoiceJob info
      const enriched = [];
      for (const r of records) {
        let vehicleCount = 0;
        const json = r.Json || {};
        for (const key of Object.keys(json)) {
          if (Array.isArray(json[key])) vehicleCount += json[key].length;
        }

        let invoiceJob = null;
        if (r.invoiceJobId) {
          invoiceJob = await prisma.invoiceJobs.findUnique({
            where: { id: r.invoiceJobId },
            select: { id: true, DocumentURL: true, status: true },
          });
        }

        enriched.push({
          id: r.id,
          documentURL: r.DocumentURL,
          page: r.Page,
          isCorrect: r.isCorrect,
          auctionHouse: r.auctionHouse,
          vehicleCount,
          invoiceJobId: r.invoiceJobId,
          invoiceJobURL: invoiceJob?.DocumentURL || null,
          createdAt: r.createdAt,
        });
      }

      return res.status(200).json({ records: enriched, total: enriched.length });
    }

    // POST: run evaluation — re-extract golden PDFs with current prompt, compare vs golden corrections
    if (req.method === "POST") {
      const { action, promptContent } = req.body;

      if (action !== "evaluate") {
        return res.status(400).json({ error: "Invalid action. Use 'evaluate'" });
      }

      // Fetch all golden records with their linked InvoiceJobs
      const goldenRecords = await prisma.paymentConfirmation.findMany({
        where: { companyId: session.companyId, isGolden: true },
        select: {
          id: true,
          DocumentURL: true,
          Page: true,
          Json: true,
          invoiceJobId: true,
        },
      });

      if (goldenRecords.length === 0) {
        return res.status(400).json({ error: "No golden records found. Mark some reviews as golden first." });
      }

      // Get invoice job URLs for re-extraction
      const jobIds = goldenRecords.map(r => r.invoiceJobId).filter(Boolean);
      const invoiceJobs = await prisma.invoiceJobs.findMany({
        where: { id: { in: jobIds } },
        select: { id: true, DocumentURL: true },
      });
      const jobUrlMap = new Map(invoiceJobs.map(j => [j.id, j.DocumentURL]));

      // Import evaluation function
      const { evaluateAgainstGolden } = await import("../../../extra/utils/promptEvaluator.mjs");

      const results = await evaluateAgainstGolden(
        goldenRecords,
        jobUrlMap,
        session.companyId,
        promptContent || null
      );

      return res.status(200).json(results);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("evaluationDataset error:", err?.message || err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
