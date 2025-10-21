import { prisma, getSession } from "@/lib/useful";

export default async function handler(req, res) {
  const session = await getSession(req, res);

  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 5;
  const search = String(req.query.search || "").trim();
  const { sortBy = "id", sortOrder = "asc", DocumentURL, Page: qPage } = req.query || {};
  const col = req.query.col ? String(req.query.col).split(",") : null;
  const selectFields = col && col.length > 0 ? Object.fromEntries(col.map(c => [c, true])) : undefined;

  try {
    if (req.method === "GET") {
      const userFilter = session.role === "Sadmin" ? {} : { companyId: session?.companyId };
      if (!userFilter.companyId && session.role !== "Sadmin") {
        return res.status(400).json({ error: "Missing companyId and no company available in session" });
      }
      const where = { ...userFilter };
      if (DocumentURL) where.DocumentURL = String(DocumentURL);
      if (qPage) where.Page = Number(qPage);

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


      const rows = await prisma.paymentConfirmation.findMany({ 
        where,
        ...(selectFields ? { select: selectFields } : {}), 
        orderBy: { [sortBy]: sortOrder } 
      });

      const charges = [];
      for (const row of rows) {
        const storeJson = row.Json || {};
        for (const pageKey of Object.keys(storeJson)) {
          const pageArr = Array.isArray(storeJson[pageKey]) ? storeJson[pageKey] : [];
          for (const chassisItem of pageArr) {
            const chassis_number = chassisItem.chassis_number;
            const chassisCharges = Array.isArray(chassisItem.charges) ? chassisItem.charges : [];
            chassisCharges.forEach((c, idx) => {
              const isConf = c.isConfirm == null ? false : Boolean(c.isConfirm);
              if (isConf === false) {
                charges.push({
                  id: `${row.id}_${pageKey}_${chassis_number}_${idx}`,
                  confirmationId: row.id,
                  DocumentURL: row.DocumentURL,
                  Page: row.Page || (pageKey === "page_1" ? 1 : parseInt(pageKey.split("_")[1], 10) || 1),
                  pageKey,
                  chassis_number,
                  type: c.type,
                  amount: c.amount,
                  isConfirm: isConf,
                  createdAt: row.createdAt,
                });
              }
            });
          }
        }
      }

      let filteredCharges = charges;
      if (trimmed) {
        filteredCharges = charges.filter(charge => {
          return (
            String(charge.chassis_number).toLowerCase().includes(trimmed.toLowerCase()) ||
            String(charge.type).toLowerCase().includes(trimmed.toLowerCase()) ||
            String(charge.DocumentURL).toLowerCase().includes(trimmed.toLowerCase()) ||
            String(charge.createdAt).toLowerCase().includes(trimmed.toLowerCase()) ||
            String(charge.confirmationId).includes(trimmed)
          );
        });
      }
      const totalCharges = filteredCharges.length;
      const paged = filteredCharges.slice(skip, skip + take);

      return res.json({ data: paged, total: totalCharges });
    }

    if (req.method === "PUT") {
      const body = req.body || {};
      const { Page, Json, isCorrect, CompanyID, DocumentURL, invoiceJobId } = body;

      if (!Json || typeof Json !== "object") return res.status(400).json({ error: "Missing or invalid Json payload for page" });

      const companyId = CompanyID || session?.companyId || null;
      if (!companyId) return res.status(400).json({ error: "Missing CompanyID and no company available in session" });

      const pageNum = typeof Page === "number" ? Page : parseInt(Page, 10);
      if (!pageNum || isNaN(pageNum)) return res.status(400).json({ error: "Invalid Page number" });

      const pageKey = pageNum === 1 ? "page_1" : `page_${pageNum}`;
      let pageArr = Array.isArray(Json[pageKey]) ? Json[pageKey] : null;

      if (!pageArr && Array.isArray(Json.items)) pageArr = Json.items;

      if (!pageArr) return res.status(400).json({ error: `Json must include ${pageKey} array or items` });

      const normalizeCharges = charges =>
        (charges || []).map(c => ({
          type: c.type,
          amount: c.amount === "" || c.amount == null ? null : isNaN(Number(c.amount)) ? c.amount : Number(c.amount),
          isConfirm: c.isConfirm == null ? false : Boolean(c.isConfirm),
        }));

      const normalizedPage = pageArr.map(item => ({
        chassis_number: item.chassis_number,
        charges: normalizeCharges(item.charges),
        ...Object.keys(item).reduce((acc, k) => {
          if (k !== "chassis_number" && k !== "charges") acc[k] = item[k];
          return acc;
        }, {}),
      }));

      const storeJson = { [pageKey]: normalizedPage };

      const findWhere = { companyId, Page: pageNum };
      if (DocumentURL) findWhere.DocumentURL = DocumentURL;

      // Always create a new row for each page save (user requested behavior)
      const saved = await prisma.paymentConfirmation.create({
        data: {
          DocumentURL: DocumentURL || null,
          Page: pageNum,
          Json: storeJson,
          isCorrect: isCorrect || "",
          companyId,
          invoiceJobId: invoiceJobId || null,
        },
      });
      if (invoiceJobId) {
        const invoiceJob = await prisma.invoiceJobs.update({ where: { id: invoiceJobId }, data: { isEvaluated: true } });
      }
      return res.status(201).json({ ok: true, created: true, data: saved });
    }
    if (req.method === "PATCH") {
      const body = req.body || {};
      const { id, Json } = body;

      if (!id) return res.status(400).json({ error: "Missing id in request body" });

      if (body.markConfirmed) {
        const { pageKey, chassis_number, type, amount, chargeIndex } = body;
        if (!pageKey) return res.status(400).json({ error: "Missing pageKey for markConfirmed" });
        if (!chassis_number) return res.status(400).json({ error: "Missing chassis_number for markConfirmed" });

        const existing = await prisma.paymentConfirmation.findUnique({ where: { id: Number(id) } });
        if (!existing) return res.status(404).json({ error: "PaymentConfirmation not found" });

        if (session.role !== "Sadmin" && existing.companyId !== session?.companyId) {
          return res.status(403).json({ error: "Not permitted to modify this record" });
        }

        const storeJson = existing.Json || {};
        const pageArr = Array.isArray(storeJson[pageKey]) ? storeJson[pageKey] : null;
        if (!pageArr) return res.status(404).json({ error: `Page key ${pageKey} not found in Json` });

        const chassisItem = pageArr.find(ci => String(ci.chassis_number) === String(chassis_number));
        if (!chassisItem) return res.status(404).json({ error: `Chassis ${chassis_number} not found on ${pageKey}` });

        const charges = Array.isArray(chassisItem.charges) ? chassisItem.charges : [];
        let foundIdx = -1;
        if (typeof chargeIndex === "number") {
          foundIdx = chargeIndex;
        } else if (type !== undefined) {
          foundIdx = charges.findIndex(
            c => String(c.type) === String(type) && (amount == null ? c.amount == null : Number(c.amount) === Number(amount) && (c.isConfirm == null || c.isConfirm === false))
          );
        } else {
          // fallback: pick first not-yet-confirmed charge
          foundIdx = charges.findIndex(c => c.isConfirm == null || c.isConfirm === false);
        }

        if (foundIdx === -1 || !charges[foundIdx]) {
          return res.status(404).json({ error: "Matching charge not found to mark confirmed" });
        }

        // mark confirmed
        charges[foundIdx].isConfirm = true;

        // persist updated Json
        const updatedJson = { ...storeJson, [pageKey]: pageArr };

        const updated = await prisma.paymentConfirmation.update({ where: { id: Number(id) }, data: { Json: updatedJson } });

        return res.json({ ok: true, updated: true, data: updated });
      }

      // If caller provided a full Json object, replace the Json field
      if (!Json || typeof Json !== "object") return res.status(400).json({ error: "Missing or invalid Json payload" });

      // Ensure record exists and belongs to the same company (unless Sadmin)
      const existing = await prisma.paymentConfirmation.findUnique({ where: { id: Number(id) } });
      if (!existing) return res.status(404).json({ error: "PaymentConfirmation not found" });

      if (session.role !== "Sadmin" && existing.companyId !== session?.companyId) {
        return res.status(403).json({ error: "Not permitted to modify this record" });
      }

      // Update only the Json field (preserve other columns)
      const updated = await prisma.paymentConfirmation.update({ where: { id: Number(id) }, data: { Json } });

      return res.json({ ok: true, updated: true, data: updated });
    }
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
}
