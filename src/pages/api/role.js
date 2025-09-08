import { prisma, getSession } from "@/lib/useful";

export default async function handler(req, res) {
  const session = await getSession(req, res);
/*   if (!["Sadmin", "Admin"].includes(session.role)) {
    return res.status(403).json({ error: "Only administrators can view users" });
  } */

  const id = Number(req.query.id);
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const search = String(req.query.search || "")
    .trim()
    .toLowerCase();
  const { sortBy = "id", sortOrder = "asc" } = req.query;
  const col = req.query.col ? String(req.query.col).split(",") : null;
  const selectFields =
    col && col.length > 0
      ? Object.fromEntries(col.map((c) => [c, true]))
      : undefined;

  try {
    if (req.method === "GET") {      
      // LoadEdit
      if (id) {
        const role = await prisma.role.findUnique({
          where: { id },
          include: {
            permissions: {
              select: { permissionId: true },
            },
          },
        });

        const formattedRole = {
          ...role,
          permissions: role.permissions.map((p) => p.permissionId),
        };

        return res.status(200).json(formattedRole);
      }

      // specific
      if (selectFields) {
        const role = await prisma.role.findMany({
          select: selectFields,
          orderBy: { [sortBy]: sortOrder },
        });
        return res.status(200).json(role);
      }

      // Build where clause based on user role
      let whereClause = {
        name: {
          contains: search,
          mode: "insensitive",
        },
      };

      // Add company filtering logic
      if (session.role === "Sadmin") {
        // Sadmin sees all roles (global + all company roles)
        // No additional filtering needed
      } else {
        // Company users see only global roles (companyId: null) + their company roles
        whereClause.OR = [
          { companyId: null }, // Global roles created by Sadmin
          { companyId: session.companyId }, // Company-specific roles
        ];
      }

      // All
      const [role, total] = await Promise.all([
        prisma.role.findMany({
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
          where: whereClause,
          include: {
            permissions: {
              select: { permissionId: true },
            },
          },
        }),
        prisma.role.count({
          where: whereClause,
        }),
      ]);

      // Flatten permissions for all roles
      const formattedRoles = role.map((r) => ({
        ...r,
        permissions: r.permissions.map((p) => p.permissionId),
      }));

      res.status(200).json({ role: formattedRoles, total });
    }

    if (req.method === "PUT") {
      const { name, permissions, companyId } = req.body;
      if (name === "") {
        return res.status(400).json({ error: "Name is required" });
      }
      if (!Array.isArray(permissions) || permissions.length === 0) {
        return res
          .status(400)
          .json({ error: "At least one permission is required" });
      }

      // Check for duplicate role name within the same scope (company or global)
      const whereClause = companyId === undefined || companyId === null
        ? { name, companyId: null } 
        : { name, companyId };

      const d = await prisma.role.findFirst({
        where: whereClause,
        select: { name: true },
      });
      if (d) {
        return res.status(409).json({ error: "Role already exists in this scope" });
      }
      
      await prisma.role.create({
        data: {
          name,
          companyId: companyId || null, // null for global roles
          permissions: {
            create: permissions.map((permissionId) => ({
              permissionId,
            })),
          },
        },
      });
      return res.status(201).json({
        message: "Role created successfully",
      });
    }

    if (req.method === "POST") {
      const { id, name, permissions, companyId } = req.body; // permissions = [7, 3, ...]

      if (name === "") {
        return res.status(400).json({ error: "Name is required" });
      }

      // Check for duplicate role name within the same scope (company or global)
      const whereClause = companyId === undefined || companyId === null
        ? { name, companyId: null, id: { not: id } } 
        : { name, companyId, id: { not: id } };

      const d = await prisma.role.findFirst({
        where: whereClause,
      });
      if (d) {
        return res
          .status(409)
          .json({ error: "Role name already exists in this scope", d, id });
      }

      await prisma.$transaction(async (tx) => {
        // Update role name and companyId
        await tx.role.update({
          where: { id },
          data: { 
            name,
            companyId: companyId || null // null for global roles
          },
        });

        // Check if permissions array is provided
        if (Array.isArray(permissions)) {
          // Get current permissions from DB
          const existing = await tx.rolePermission.findMany({
            where: { roleId: id },
            select: { permissionId: true },
          });

          const existingIds = existing.map((p) => p.permissionId).sort();
          const newIds = [...permissions].sort();

          // Compare arrays
          const isSame =
            existingIds.length === newIds.length &&
            existingIds.every((val, idx) => val === newIds[idx]);

          // Only update if they differ
          if (!isSame) {
            await tx.rolePermission.deleteMany({
              where: { roleId: id },
            });

            if (newIds.length > 0) {
              await tx.rolePermission.createMany({
                data: newIds.map((pid) => ({
                  roleId: id,
                  permissionId: pid,
                })),
              });
            }
          }
        }
      });

      return res.status(201).json({
        message: "Role updated successfully",
      });
    }

    if (req.method === "DELETE") {
      const { id } = req.query;

      // Delete all related records first to avoid foreign key constraint violations
      await prisma.rolePermission.deleteMany({ where: { roleId: Number(id) } });
      await prisma.userRole.deleteMany({ where: { roleId: Number(id) } });

      // Now delete the role itself
      await prisma.role.delete({
        where: { id: Number(id) },
      });

      res.status(200).json({
        message: "Role deleted successfully",
      });
    }
  } catch (error) {
    console.error("API error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
