import { prisma, getSession } from "@/lib/useful";

const ALLOWED_FIELDS = new Set([
  "auction", "transportCompany", "deliverTo", "documentStatus",
]);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getSession(req, res);
  const fieldsParam = req.query.fields;

  if (!fieldsParam) {
    return res.status(400).json({ error: "fields query parameter is required" });
  }

  const fields = fieldsParam.split(",").filter(f => ALLOWED_FIELDS.has(f.trim()));

  if (fields.length === 0) {
    return res.status(400).json({ error: "No valid fields provided" });
  }

  try {
    const companyFilter = session.role === "Sadmin" ? {} : { companyId: session.companyId };
    const result = {};

    await Promise.all(
      fields.map(async (field) => {
        const vehicles = await prisma.vehicle.findMany({
          where: {
            ...companyFilter,
            [field]: { not: null },
          },
          select: { [field]: true },
          distinct: [field],
          orderBy: { [field]: "asc" },
          take: 100,
        });
        result[field] = vehicles
          .map(v => v[field])
          .filter(v => v && v.trim() !== "");
      })
    );

    return res.json(result);
  } catch (error) {
    console.error("Suggestions error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
