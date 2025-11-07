import { prisma, getSession } from "@/lib/useful";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  try {
    if (req.method === "PUT") {
      const { Page, Json, isCorrect, CompanyID, DocumentURL, invoiceJobId } = req.body;

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
        await prisma.invoiceJobs.update({ where: { id: invoiceJobId }, data: { isEvaluated: true } });
      }

      const charges = [];
      const savedJson = saved.Json || {};
      for (const pageKey of Object.keys(savedJson)) {
        const pageArrLocal = Array.isArray(savedJson[pageKey]) ? savedJson[pageKey] : [];
        for (const chassisItem of pageArrLocal) {
          const chassis_number = chassisItem.chassis_number;
          const chassisCharges = Array.isArray(chassisItem.charges) ? chassisItem.charges : [];
          chassisCharges.forEach((c, idx) => {
            charges.push({
              DocumentURL: saved.DocumentURL,
              chassis_number,
              type: c.type,
              amount: c.amount,
              // include chassis-level metadata so we can create vehicles with correct details
              brand: chassisItem.brand || null,
              lot_number: chassisItem.lot_number || null,
              auction: chassisItem.auction || null,
            });
          });
        }
      }

      for (const ch of charges) {
        try {
          const chassisNumber = String(ch.chassis_number || "").trim();
          if (!chassisNumber) continue;
          let vehicle = await prisma.vehicle.findUnique({
            where: {
              companyId_chassisNumber: {
                companyId: Number(companyId),
                chassisNumber,
              },
            },
          });
          if (!vehicle) {
            // determine brand name from parsed data, fallback to '-'
            const brandName = ch.brand && String(ch.brand).trim() !== "" ? String(ch.brand).trim() : "-";
            const brand = await prisma.brand.upsert({
              where: { name: brandName },
              update: {},
              create: { name: brandName },
            });

            const lotNumber = ch.lot_number && String(ch.lot_number).trim() !== "" ? String(ch.lot_number).trim() : null;
            const auction = ch.auction && String(ch.auction).trim() !== "" ? String(ch.auction).trim() : null;

            vehicle = await prisma.vehicle.create({
              data: {
                chassisNumber,
                companyId: Number(companyId),
                brandId: brand.id,
                statusId: 1,
                lotNumber: lotNumber,
                auction: auction,
                remarks: `Auto-added from payment confirmatio`,
              },
            });
          }

          const amount = ch.amount == null || ch.amount === "" ? null : Number(ch.amount);
          if (amount == null || isNaN(amount)) {
            continue;
          }

          await prisma.vehiclePayments.create({
            data: {
              vehicleId: vehicle.id,
              name: ch.type || "Payment",
              amount: -amount,
              date: new Date(),
              remarks: `Auto-added from payment confirmation ${saved.id}`,
              url: ch.DocumentURL || saved.DocumentURL || null,
            },
          });
        } catch (err) {
          console.error("Failed to process charge for chassis", ch && ch.chassis_number, err && err.message ? err.message : err);
        }
      }
      res.status(201).json({
        message: "Page saved and payments added to vehicle payments successfully",
      });
    }
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
}
