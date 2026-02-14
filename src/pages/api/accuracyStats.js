import { prisma, getSession } from "@/lib/useful";
import { COMPARED_FIELDS } from "../../../extra/ai/schema.mjs";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session?.companyId) return res.status(401).json({ error: "Unauthorized" });

  try {
    if (req.method === "GET") {
      const { period = "30d", auctionHouse } = req.query;
      const companyId = session.companyId;

      // Parse period into a date cutoff
      const days = parseInt(period) || 30;
      const since = new Date();
      since.setDate(since.getDate() - days);

      const where = {
        companyId,
        createdAt: { gte: since },
        ...(auctionHouse ? { auctionHouse } : {}),
      };

      // Fetch all PaymentConfirmation records in period
      const records = await prisma.paymentConfirmation.findMany({
        where,
        select: {
          id: true,
          isCorrect: true,
          diffSummary: true,
          auctionHouse: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });

      // --- Overview ---
      const totalReviewed = records.length;
      const exactMatch = records.filter(r => r.isCorrect === "exact_match").length;
      const corrected = records.filter(r => r.isCorrect === "corrected").length;
      const accuracyRate = totalReviewed > 0 ? exactMatch / totalReviewed : 0;

      // --- By Field ---
      // Aggregate field-level errors from diffSummary
      const fieldErrors = {};
      const fieldTotals = {};
      for (const r of records) {
        const diff = r.diffSummary;
        if (!diff || !diff.vehicles) continue;
        for (const v of diff.vehicles) {
          if (v.fields) {
            for (const field of Object.keys(v.fields)) {
              fieldErrors[field] = (fieldErrors[field] || 0) + 1;
            }
          }
          if (v.charges) {
            const chargeChanges = (v.charges.added?.length || 0) + (v.charges.removed?.length || 0) + (v.charges.changed?.length || 0);
            if (chargeChanges > 0) {
              fieldErrors["charges"] = (fieldErrors["charges"] || 0) + chargeChanges;
            }
          }
        }
        // Count total fields compared
        if (diff.totalFieldsCompared) {
          // Distribute across known fields proportionally (approximation)
          const fields = COMPARED_FIELDS;
          for (const f of fields) {
            fieldTotals[f] = (fieldTotals[f] || 0) + (diff.vehicles?.length || 1);
          }
          fieldTotals["charges"] = (fieldTotals["charges"] || 0) + (diff.totalFieldsCompared - (fields.length * (diff.vehicles?.length || 1)));
        }
      }

      const byField = Object.keys({ ...fieldErrors, ...fieldTotals }).map(field => {
        const errors = fieldErrors[field] || 0;
        const total = Math.max(fieldTotals[field] || totalReviewed, errors);
        return {
          field,
          errors,
          total,
          accuracy: total > 0 ? (total - errors) / total : 1,
        };
      }).sort((a, b) => a.accuracy - b.accuracy);

      // --- By Auction House ---
      const auctionGroups = {};
      for (const r of records) {
        const key = r.auctionHouse || "Unknown";
        if (!auctionGroups[key]) auctionGroups[key] = { total: 0, exact: 0 };
        auctionGroups[key].total++;
        if (r.isCorrect === "exact_match") auctionGroups[key].exact++;
      }
      const byAuction = Object.entries(auctionGroups)
        .map(([auction, { total, exact }]) => ({
          auction,
          accuracy: total > 0 ? exact / total : 0,
          count: total,
        }))
        .sort((a, b) => a.accuracy - b.accuracy);

      // --- Trend (group by date) ---
      const dateGroups = {};
      for (const r of records) {
        const dateKey = r.createdAt.toISOString().split("T")[0];
        if (!dateGroups[dateKey]) dateGroups[dateKey] = { total: 0, exact: 0 };
        dateGroups[dateKey].total++;
        if (r.isCorrect === "exact_match") dateGroups[dateKey].exact++;
      }
      const trend = Object.entries(dateGroups)
        .map(([date, { total, exact }]) => ({
          date,
          accuracy: total > 0 ? exact / total : 0,
          count: total,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // --- Recent corrections ---
      const recentCorrections = records
        .filter(r => r.isCorrect === "corrected" && r.diffSummary)
        .slice(0, 10)
        .map(r => ({
          id: r.id,
          auctionHouse: r.auctionHouse,
          createdAt: r.createdAt,
          fieldsChanged: r.diffSummary?.totalFieldsChanged || 0,
          fieldsCompared: r.diffSummary?.totalFieldsCompared || 0,
          vehicles: r.diffSummary?.vehicles || [],
        }));

      return res.status(200).json({
        overview: { totalReviewed, exactMatch, corrected, accuracyRate },
        byField,
        byAuction,
        trend,
        recentCorrections,
      });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("accuracyStats error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
