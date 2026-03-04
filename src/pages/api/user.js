import { prisma, getSession } from "@/lib/useful";
import { hashPassword } from "@/lib/password";

// Shared helper: get admin role IDs + check if current user is admin
async function getAdminContext(session) {
  if (session.role === "Sadmin") return { roleFilter: {} };

  const [adminRoles, currentUserData] = await Promise.all([
    prisma.role.findMany({
      where: { name: { contains: "admin", mode: "insensitive" } },
      select: { id: true },
    }),
    prisma.user.findUnique({
      where: { id: Number(session.id) },
      select: { roles: { select: { roleId: true } } },
    }),
  ]);

  const adminIds = adminRoles.map(r => r.id);
  const isCurrentUserAdmin = currentUserData?.roles?.some(ur => adminIds.includes(ur.roleId));

  if (adminRoles.length > 0 && !isCurrentUserAdmin) {
    return {
      roleFilter: { roles: { none: { roleId: { in: adminIds } } } },
    };
  }
  return { roleFilter: {} };
}

// Format user with role names from a pre-loaded map
function formatUser(user, roleMap) {
  return {
    id: user.id,
    username: user.username,
    companyId: user.companyId,
    createdAt: user.createdAt,
    rolesId: user.roles.map(r => r.roleId),
    rolesnames: user.roles.map(r => roleMap.get(r.roleId) || "Unknown"),
    company: user.company,
  };
}

export default async function handler(req, res) {
  const session = await getSession(req, res);

  const id = Number(req.query.id);
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const search = String(req.query.search || "").trim().toLowerCase();
  const { sortBy = "id", sortOrder = "asc" } = req.query;
  const col = req.query.col ? String(req.query.col).split(",") : null;
  const selectFields = col && col.length > 0 ? Object.fromEntries(col.map(c => [c, true])) : undefined;

  try {
    if (req.method === "GET") {
      const userCompanyId = session?.companyId;
      const filterByCompany = session.role === "Sadmin" ? {} : { companyId: userCompanyId };

      // ---- Load single user (include role names in one round-trip) ----
      if (id) {
        const user = await prisma.user.findUnique({
          where: { id },
          include: {
            roles: { include: { role: { select: { id: true, name: true } } } },
            company: { select: { name: true } },
          },
        });

        if (!user || (session.role !== "Sadmin" && user.companyId !== userCompanyId)) {
          return res.status(404).json({ error: "User not found" });
        }

        return res.status(200).json({
          id: user.id,
          username: user.username,
          companyId: user.companyId,
          createdAt: user.createdAt,
          rolesId: user.roles.map(r => r.roleId),
          rolesnames: user.roles.map(r => r.role?.name || "Unknown"),
          company: user.company,
        });
      }

      // ---- Specific fields (dropdown lists etc.) ----
      if (selectFields) {
        const { roleFilter } = await getAdminContext(session);

        const users = await prisma.user.findMany({
          select: {
            ...selectFields,
            roles: { select: { roleId: true } },
          },
          where: {
            ...filterByCompany,
            ...roleFilter,
            username: { not: session.name },
          },
          orderBy: { [sortBy]: sortOrder },
        });

        return res.status(200).json(
          users.map(u => ({ ...u, rolesId: u.roles.map(r => r.roleId) }))
        );
      }

      // ---- Paginated list ----
      const { roleFilter } = await getAdminContext(session);

      const whereClause = {
        ...filterByCompany,
        ...roleFilter,
        username: { contains: search, mode: "insensitive", not: session.name },
        customer: null,
      };

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
          where: whereClause,
          include: {
            roles: { include: { role: { select: { id: true, name: true } } } },
            company: { select: { name: true } },
          },
        }),
        prisma.user.count({ where: whereClause }),
      ]);

      // Build role map from already-included data (zero extra queries)
      const roleMap = new Map();
      for (const u of users) {
        for (const ur of u.roles) {
          if (ur.role && !roleMap.has(ur.roleId)) {
            roleMap.set(ur.roleId, ur.role.name);
          }
        }
      }

      return res.status(200).json({
        user: users.map(u => formatUser(u, roleMap)),
        total,
      });
    }

    if (req.method === "PUT") {
      const { username, password, companyId, rolesId } = req.body;
      if (username === "") return res.status(400).json({ error: "Username is required" });
      if (password === "") return res.status(400).json({ error: "Password is required" });
      if (!companyId) return res.status(400).json({ error: "Company is required" });

      const d = await prisma.user.findFirst({
        where: { username: { equals: username, mode: "insensitive" } },
        select: { username: true },
      });
      if (d) return res.status(409).json({ error: "Username already exists" });

      await prisma.user.create({
        data: {
          username,
          password: await hashPassword(password),
          companyId: Number(companyId),
          roles: { create: rolesId.map(roleId => ({ roleId })) },
        },
      });

      res.status(201).json({ message: "User created successfully" });
    }

    if (req.method === "POST") {
      const { id, username, password, companyId, rolesId } = req.body;
      if (!username) return res.status(400).json({ error: "Username is required" });
      if (!companyId) return res.status(400).json({ error: "Company is required" });

      const d = await prisma.user.findFirst({
        where: { username: { equals: username, mode: "insensitive" }, id: { not: id } },
      });
      if (d) return res.status(409).json({ error: "Username already exists" });

      const transactionOps = [
        prisma.user.update({
          where: { id },
          data: { username, ...(password ? { password: await hashPassword(password) } : {}), companyId: Number(companyId) },
        }),
      ];

      if (Array.isArray(rolesId)) {
        const existingRoles = await prisma.userRole.findMany({
          where: { userId: id },
          select: { roleId: true },
        });

        const existingRoleIds = existingRoles.map(r => r.roleId).sort();
        const newRoleIds = [...rolesId].sort();
        const rolesChanged = existingRoleIds.length !== newRoleIds.length || existingRoleIds.some((r, idx) => r !== newRoleIds[idx]);

        if (rolesChanged) {
          transactionOps.push(
            prisma.userRole.deleteMany({ where: { userId: id } }),
            prisma.userRole.createMany({ data: rolesId.map(roleId => ({ userId: id, roleId })) })
          );
        }
      }

      await prisma.$transaction(transactionOps);
      res.status(201).json({ message: "User updated successfully" });
    }

    if (req.method === "DELETE") {
      const { id } = req.query;
      const userId = Number(id);

      const customer = await prisma.customer.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (customer) {
        const vehicleCount = await prisma.vehicle.count({ where: { customerId: customer.id } });
        if (vehicleCount > 0) {
          return res.status(400).json({ error: `Cannot delete customer. ${vehicleCount} vehicle(s) are still associated with this customer. Please reassign or remove the vehicles first.` });
        }
      }

      await prisma.$transaction([
        prisma.userRole.deleteMany({ where: { userId } }),
        prisma.customer.deleteMany({ where: { userId } }),
        prisma.user.delete({ where: { id: userId } }),
      ]);

      res.status(200).json({ message: "User and all associated data deleted successfully" });
    }
  } catch (error) {
    console.error("API error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
