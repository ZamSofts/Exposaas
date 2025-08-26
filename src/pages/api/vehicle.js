import { prisma, getSession } from "@/lib/useful";

export default async function handler(req, res) {
  const session = await getSession(req, res);

  const id = Number(req.query.id);
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const search = String(req.query.search || "")
    .trim()
    .toLowerCase();
  const { sortBy = "id", sortOrder = "asc" } = req.query;
  const col = req.query.col ? String(req.query.col).split(",") : null;
  const selectFields = col && col.length > 0 ? Object.fromEntries(col.map(c => [c, true])) : undefined;

  try {
    if (req.method === "GET") {
      const userCompanyId = session?.companyId;
      const filterByCompany = session.role === "Sadmin" ? {} : { companyId: userCompanyId };

      // ---- Load single vehicle ----
      if (id) {
        const vehicle = await prisma.vehicle.findUnique({
          where: { id },
          include: {
            company: { select: { name: true } },
            brand: { select: { name: true } },
            status: { select: { name: true } },
          },
        });

        if (!vehicle || (session.role !== "Sadmin" && vehicle.companyId !== userCompanyId)) {
          return res.status(404).json({ error: "Vehicle not found" });
        }

        return res.status(200).json(vehicle);
      }

      // ---- Specific fields ----
      if (selectFields) {
        const vehicles = await prisma.vehicle.findMany({
          select: {
            ...selectFields,
            company: { select: { name: true } },
            brand: { select: { name: true } },
            status: { select: { name: true } },
          },
          where: {
            ...filterByCompany,
            ...(search? { name: { contains: search, mode: "insensitive" } }: {}), // only add search filter if not empty
          },
          orderBy: { [String(sortBy)]: String(sortOrder) },
        });

        return res.status(200).json(vehicles);
      }

      // ---- All with pagination ----
      const [vehicles, total] = await Promise.all([
        prisma.vehicle.findMany({
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { [String(sortBy)]: String(sortOrder) },
          where: {
            ...filterByCompany,
            ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
          },
          include: {
            company: { select: { name: true } },
            brand: { select: { name: true } },
            status: { select: { name: true } },
          },
        }),
        prisma.vehicle.count({
          where: {
            ...filterByCompany,
            ...(search ? { name: { contains: search, mode: "insensitive" } } : {}), // only add search filter if not empty
          },
        }),
      ]);

      return res.status(200).json({ vehicles, total });
    }

    if (req.method === "PUT") {
      const { name, chassisNumber, brandId, remarks, companyId, statusId } = req.body;

      
      if (!chassisNumber) return res.status(400).json({ error: "Chassis number is required" });
      if (!brandId) return res.status(400).json({ error: "Brand is required" });
      if (!companyId) return res.status(400).json({ error: "Company is required" });
      if (!statusId) return res.status(400).json({ error: "Status is required" });

      // ensure brand exists
      const brandExists = await prisma.brand.findUnique({ where: { id: Number(brandId) } });
      if (!brandExists) return res.status(404).json({ error: "Brand not found" });

      // ensure status exists
      const statusExists = await prisma.vehicleStatus.findUnique({ where: { id: Number(statusId) } });
      if (!statusExists) return res.status(404).json({ error: "Status not found" });

      const exists = await prisma.vehicle.findUnique({ where: { chassisNumber } });
      if (exists) return res.status(409).json({ error: "Chassis number already exists" });

      await prisma.vehicle.create({
        data: {
          name,
          chassisNumber,
          brandId: Number(brandId),
          remarks,
          companyId: Number(companyId),
          statusId: Number(statusId),
        },
      });

      res.status(201).json({ message: "Vehicle created successfully" });
    }

    if (req.method === "POST") {
      const { id, name, chassisNumber, brandId, remarks, companyId, statusId } = req.body;

      if (!id) return res.status(400).json({ error: "Vehicle ID is required" });
     
      if (!chassisNumber) return res.status(400).json({ error: "Chassis number is required" });
      if (!brandId) return res.status(400).json({ error: "Brand is required" });
      if (!companyId) return res.status(400).json({ error: "Company is required" });
      if (!statusId) return res.status(400).json({ error: "Status is required" });

      // ensure brand exists
      const brandExists = await prisma.brand.findUnique({ where: { id: Number(brandId) } });
      if (!brandExists) return res.status(404).json({ error: "Brand not found" });

      // ensure status exists
      const statusExists = await prisma.vehicleStatus.findUnique({ where: { id: Number(statusId) } });
      if (!statusExists) return res.status(404).json({ error: "Status not found" });

      const exists = await prisma.vehicle.findFirst({
        where: { chassisNumber, id: { not: id } },
      });
      if (exists) return res.status(409).json({ error: "Chassis number already exists" });

      await prisma.vehicle.update({
        where: { id },
        data: {
          name,
          chassisNumber,
          brandId: Number(brandId),
          remarks,
          companyId: Number(companyId),
          statusId: Number(statusId),
        },
      });

      res.status(200).json({ message: "Vehicle updated successfully" });
    }

    if (req.method === "DELETE") {
      if (!id) return res.status(400).json({ error: "Vehicle ID is required" });

      await prisma.vehicle.delete({ where: { id: Number(id) } });

      res.status(200).json({ message: "Vehicle deleted successfully" });
    }
  } catch (error) {
    console.error("API error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
