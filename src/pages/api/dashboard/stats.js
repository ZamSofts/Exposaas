import { prisma, getSession } from "@/lib/useful";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getSession(req, res);

  // Sadmin can see all; others are scoped to their company
  const isSadmin = session.role === "Sadmin";
  if (!isSadmin && !session.companyId) {
    return res.status(400).json({ error: "Missing companyId" });
  }

  const companyFilter = isSadmin ? {} : { companyId: session.companyId };

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [pendingDocs, failedDocs, todayVehicles, totalVehicles, missingInvoice, recentDocs] =
      await Promise.all([
        prisma.invoiceJobs.count({
          where: { ...companyFilter, status: { in: ["pending", "processing"] } },
        }),
        prisma.invoiceJobs.count({
          where: { ...companyFilter, status: "failed" },
        }),
        prisma.vehicle.count({
          where: { ...companyFilter, createdAt: { gte: today } },
        }),
        prisma.vehicle.count({
          where: companyFilter,
        }),
        prisma.vehicle.count({
          where: { ...companyFilter, sourceInvoiceJobId: null },
        }),
        prisma.invoiceJobs.findMany({
          where: companyFilter,
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, docType: true, status: true, createdAt: true },
        }),
      ]);

    return res.status(200).json({
      pendingDocs,
      failedDocs,
      todayVehicles,
      totalVehicles,
      missingInvoice,
      recentDocs,
    });
  } catch (err) {
    console.error("dashboard/stats error:", err);
    return res.status(500).json({ error: "Failed to load stats" });
  }
}
