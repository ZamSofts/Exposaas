import { prisma, getSession } from "@/lib/useful";

export default async function handler(req, res) {
  const session = await getSession(req, res);

  try {
    const id = Number(req.query.id);
    switch (req.method) {
      case "GET": {
        // Single status
        if (id) {
          const status = await prisma.vehicleStatus.findUnique({
            where: { id },
            include: {
              _count: {
                select: {
                  vehicles: true, // Count vehicles using this status
                },
              },
            },
          });

          if (!status) {
            return res.status(404).json({ error: "Status not found" });
          }

          return res.json(status);
        }

        // List all statuses
        const statuses = await prisma.vehicleStatus.findMany({
          orderBy: { id: "asc" },
          include: {
            _count: {
              select: {
                vehicles: true,
              },
            },
          },
        });

        return res.json({ statuses });
      }
      case "PUT": {
        const { name } = req.body;

        if (!name) {
          return res.status(400).json({ error: "Status name is required" });
        }

        // Check if status already exists
        const existingStatus = await prisma.vehicleStatus.findFirst({
          where: { name: { equals: name, mode: "insensitive" } },
        });

        if (existingStatus) {
          return res.status(409).json({ error: "Status with this name already exists" });
        }

        const status = await prisma.vehicleStatus.create({
          data: {
            name,
          },
        });

        return res.status(201).json({
          message: "Status created successfully",
          status,
        });
      }
      case "POST": {
        const { id: bodyId, name } = req.body;
        const statusId = Number(bodyId);
        
        if (!statusId) {
          return res.status(400).json({ error: "Status ID is required" });
        }

        if (!name) {
          return res.status(400).json({ error: "Status name is required" });
        }

        // Check if another status with the same name exists
        const existingStatus = await prisma.vehicleStatus.findFirst({
          where: {
            name: { equals: name, mode: "insensitive" },
            id: { not: statusId },
          },
        });

        if (existingStatus) {
          return res.status(409).json({ error: "Another status with this name already exists" });
        }

        const status = await prisma.vehicleStatus.update({
          where: { id: statusId },
          data: {
            name,
          },
        });

        return res.json({
          message: "Status updated successfully",
          status,
        });
      }

      case "DELETE": {
        if (!id) {
          return res.status(400).json({ error: "Status ID is required" });
        }

        // Check if status is being used by any vehicles
        const vehicleCount = await prisma.vehicle.count({
          where: { statusId: id },
        });

        if (vehicleCount > 0) {
          return res.status(400).json({
            error: `Cannot delete status. It is currently used by ${vehicleCount} vehicle(s)`,
          });
        }

        await prisma.vehicleStatus.delete({ where: { id } });

        return res.json({ message: "Status deleted successfully" });
      }

      default:
        return res.status(405).json({ error: "Method not allowed" });
    }
  } catch (error) {
    console.error("Status API error:", error);
    const status = error.message.includes("not found") ? 404 : error.message.includes("already exists") ? 409 : error.message.includes("required") ? 400 : 500;
    res.status(status).json({ error: error.message || "Internal server error" });
  }
}
