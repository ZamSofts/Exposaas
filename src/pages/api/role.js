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
          permissions: role.permissions.map(p => p.permissionId),
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

      let whereClause = {
        name: {
          contains: search,
          mode: "insensitive",
        },
        NOT: {
          name: {
            equals: "customer",
            mode: "insensitive",
          },
        },
      };

      // Add company filtering logic
      if (session.role === "Sadmin") {

      } else {
       
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
      const formattedRoles = role.map(r => ({
        ...r,
        permissions: r.permissions.map(p => p.permissionId),
      }));

      res.status(200).json({ role: formattedRoles, total });
    }

    if (req.method === "PUT") {
      const { name, permissions, companyId } = req.body;
      if (name === "") {
        return res.status(400).json({ error: "Name is required" });
      }
      if (!Array.isArray(permissions) || permissions.length === 0) {
        return res.status(400).json({ error: "At least one permission is required" });
      }

      const reserved = ["customer", "sadmin"];
      if (reserved.includes(name.trim().toLowerCase())) {
        return res.status(400).json({ error: `Role name cannot be '${name}'. This is a reserved system role.` });
      }

      const whereClause =
        companyId === undefined || companyId === null
          ? {
              name: { equals: name, mode: "insensitive" },
              companyId: null,
            }
          : {
              name: { equals: name, mode: "insensitive" },
              companyId,
            };

      const d = await prisma.role.findFirst({
        where: whereClause,
        select: { name: true },
      });
      if (d) {
        return res.status(409).json({ error: "Role already exists" });
      }

      await prisma.role.create({
        data: {
          name,
          companyId: companyId || null, // null for global roles
          permissions: {
            create: permissions.map(permissionId => ({
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
      const { id, name, permissions } = req.body;
      if (name === "") {
        return res.status(400).json({ error: "Name is required" });
      }
      const reserved = ["customer", "sadmin"];
      if (reserved.includes(name.trim().toLowerCase())) {
        return res.status(400).json({ error: `Role name cannot be '${name}'. This is a reserved system role.` });
      }

      const existingRole = await prisma.role.findUnique({
        where: { id },
        select: { companyId: true },
      });

      if (!existingRole) {
        return res.status(404).json({ error: "Role not found" });
      }

      // Check if user has permission to edit this role
      if (session.role !== "Sadmin") {
      
        if (existingRole.companyId === null) {
          return res.status(403).json({ error: "Only Sadmin can edit global roles" });
        }
        if (existingRole.companyId !== session.companyId) {
          return res.status(403).json({ error: "You can only edit roles from your company" });
        }
      }

      const whereClause = {
        name: { equals: name, mode: "insensitive" },
        companyId: existingRole.companyId, // Use the existing role's companyId
        id: { not: id },
      };

      const d = await prisma.role.findFirst({
        where: whereClause,
      });
      if (d) {
        return res.status(409).json({ error: "Role name already exists in this scope", d, id });
      }

      await prisma.$transaction(async tx => {
        await tx.role.update({
          where: { id },
          data: {
            name,
          },
        });

        if (Array.isArray(permissions)) {

          const existing = await tx.rolePermission.findMany({
            where: { roleId: id },
            select: { permissionId: true },

          });

          const existingIds = existing.map(p => p.permissionId).sort();
          const newIds = [...permissions].sort();

          // Compare arrays
          const isSame = existingIds.length === newIds.length && existingIds.every((val, idx) => val === newIds[idx]);

          // Only update if they differ
          if (!isSame) {
            await tx.rolePermission.deleteMany({
              where: { roleId: id },
            });

            if (newIds.length > 0) {
              await tx.rolePermission.createMany({
                data: newIds.map(pid => ({
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

      // Get the existing role to check permissions
      const existingRole = await prisma.role.findUnique({
        where: { id: Number(id) },
        select: { companyId: true, name: true },
      });

      if (!existingRole) {
        return res.status(404).json({ error: "Role not found" });
      }

      // Check if user has permission to delete this role
      if (session.role !== "Sadmin") {
        // Company users can only delete roles that belong to their company
        // Global roles (companyId === null) can only be deleted by Sadmin
        if (existingRole.companyId === null) {
          return res.status(403).json({ error: "Only Sadmin can delete global roles" });
        }
        if (existingRole.companyId !== session.companyId) {
          return res.status(403).json({ error: "You can only delete roles from your company" });
        }
      }

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
