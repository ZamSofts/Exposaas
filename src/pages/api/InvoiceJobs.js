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
        const item = await prisma.invoiceJobs.findUnique({ where: { id }, ...(selectFields ? { select: selectFields } : {}) });
        return res.status(200).json(item);
      }
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
          prisma.invoiceJobs.findMany({ where: finalWhere, ...(selectFields ? { select: selectFields } : {}), orderBy: { [sortBy]: sortOrder }, skip, take }),
          prisma.invoiceJobs.count({ where: finalWhere }),
        ]);

        return res.json({ data: items, total });
      }

      const rows = await prisma.invoiceJobs.findMany({ where: finalWhere, ...(selectFields ? { select: selectFields } : {}), orderBy: { [sortBy]: sortOrder } });
      return res.json({ data: rows, total: rows.length });
    }
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
}
