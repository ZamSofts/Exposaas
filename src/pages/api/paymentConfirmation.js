import { prisma, getSession } from "@/lib/useful";

export default async function handler(req, res) {
  const session = await getSession(req, res);

  try {
    if (req.method !== "POST" && req.method !== "PUT") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const body = req.body || {};
    const { Page = null, Json = null, isCorrect = null, CompanyID = null, DocumentURL = null } = body;

    if (!Json || typeof Json !== "object") return res.status(400).json({ error: "Missing or invalid Json payload for page" });

    const companyId = CompanyID || session?.companyId || null;
    if (!companyId) return res.status(400).json({ error: "Missing CompanyID and no company available in session" });

    const pageNum = typeof Page === "number" ? Page : parseInt(Page, 10);
    if (!pageNum || isNaN(pageNum)) return res.status(400).json({ error: "Invalid Page number" });

    
    const pageKey = pageNum === 1 ? "page_1" : `page_${pageNum}`;
    let pageArr = Array.isArray(Json[pageKey]) ? Json[pageKey] : null;

    
    if (!pageArr && Array.isArray(Json.items)) pageArr = Json.items;

    if (!pageArr) return res.status(400).json({ error: `Json must include ${pageKey} array or items` });

    // Normalize amounts inside charges
    const normalizeCharges = charges => (charges || []).map(c => ({
      type: c.type,
      amount: c.amount === "" || c.amount == null ? null : (isNaN(Number(c.amount)) ? c.amount : Number(c.amount)),
    }));

    const normalizedPage = pageArr.map(item => ({
      chassis_number: item.chassis_number,
      charges: normalizeCharges(item.charges),
      ...(Object.keys(item).reduce((acc, k) => { if (k !== "chassis_number" && k !== "charges") acc[k] = item[k]; return acc; }, {})),
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
      },
    });

    return res.status(201).json({ ok: true, created: true, data: saved });
  } catch (err) {
    console.error("/api/paymentConfirmation error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
