import { prisma, getSession } from "@/lib/useful";

/**
 * GET  /api/auctionInvoices?year=2025&month=4
 *   → Returns AuctionInvoices with paymentDueDate in the given month
 *
 * PATCH /api/auctionInvoices
 *   → { id, isPaid?, paymentDueDate?, auctionVenue?, sessionNumber?, invoiceTotal? }
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session?.companyId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // ── GET: fetch invoices for a month ─────────────────────────────────────
  if (req.method === "GET") {
    const year  = Number(req.query.year)  || new Date().getFullYear();
    const month = Number(req.query.month) || new Date().getMonth() + 1;

    const start = new Date(year, month - 1, 1);
    const end   = new Date(year, month, 1); // exclusive

    const invoices = await prisma.auctionInvoice.findMany({
      where: {
        companyId: session.companyId,
        status: { in: ["completed", "verified"] },
        paymentDueDate: { gte: start, lt: end },
      },
      orderBy: { paymentDueDate: "asc" },
      select: {
        id:                   true,
        auctionVenue:         true,
        sessionNumber:        true,
        invoiceTotal:         true,
        paymentDueDate:       true,
        isPaid:               true,
        isPrepaymentRequired: true,
        status:               true,
      },
    });

    return res.status(200).json({ data: invoices });
  }

  // ── PATCH: toggle isPaid ─────────────────────────────────────────────────
  if (req.method === "PATCH") {
    const { id, isPaid, paymentDueDate, auctionVenue, sessionNumber, invoiceTotal } = req.body;
    if (!id) return res.status(400).json({ error: "id required" });

    const invoice = await prisma.auctionInvoice.findFirst({
      where: { id: Number(id), companyId: session.companyId },
    });
    if (!invoice) return res.status(404).json({ error: "Not found" });

    const data = {};
    if (typeof isPaid === "boolean") data.isPaid = isPaid;
    if (paymentDueDate !== undefined) {
      data.paymentDueDate = paymentDueDate ? new Date(paymentDueDate) : null;
    }
    if (auctionVenue !== undefined)  data.auctionVenue  = auctionVenue  || null;
    if (sessionNumber !== undefined) data.sessionNumber = sessionNumber || null;
    if (invoiceTotal  !== undefined) {
      data.invoiceTotal = invoiceTotal != null && !isNaN(Number(invoiceTotal))
        ? Number(invoiceTotal) : null;
    }
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: "Nothing to update" });
    }

    const updated = await prisma.auctionInvoice.update({
      where: { id: Number(id) },
      data,
    });

    return res.status(200).json(updated);
  }

  return res.status(405).json({ error: "Method not allowed" });
}
