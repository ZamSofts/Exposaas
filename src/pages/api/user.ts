import type { NextApiRequest, NextApiResponse } from "next";
import { prisma, getSession } from "@/lib/useful";
import { Console } from "console";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getSession(req, res);
  const roles = ["Sadmin", "Admin"];
  if (!roles.includes(session.role)) {
    return res
      .status(403)
      .json({ error: "Only administrators can view users" });
  }

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
      console.log(id);

      // LoadEdit: single user
      if (id) {
        const user = await prisma.user.findUnique({
          where: { id },
          include: {
            roles: { select: { roleId: true } },
          },
        });

        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }

        return res.status(200).json({
          id: user.id,
          username: user.username,
          password: user.password,
          companyId: user.companyId,
          rolesId: user.roles.map((r) => r.roleId),
        });
      }

      // specific fields
      if (selectFields) {
        const users = await prisma.user.findMany({
          select: {
            ...selectFields,
            roles: { select: { roleId: true } },
          },
          orderBy: { [sortBy]: sortOrder },
        });

        const formatted = users.map((u) => ({
          ...u,
          rolesId: u.roles.map((r) => r.roleId),
        }));

        return res.status(200).json(formatted);
      }

      // All with pagination
      const [users, total] = await Promise.all([
        prisma.user.findMany({
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
          where: {
            username: {
              contains: search,
              mode: "insensitive",
            },
          },
          include: {
            roles: { select: { roleId: true } },
            company: { select: { name: true } },
          },
        }),
        prisma.user.count({
          where: { username: { contains: search, mode: "insensitive" } },
        }),
      ]);

      const formatted = users.map((u) => ({
        id: u.id,
        username: u.username,
        password: u.password,
        companyId: u.companyId,
        rolesId: u.roles.map((r) => r.roleId),
        company: u.company, // keep this if you still want company info
      }));

      res.status(200).json({ user: formatted, total });
    }
    if (req.method === "PUT") {
      console.log(req.body);
      const { username, password, companyId, roleIds } = req.body;
      if (username === "") {
        return res.status(400).json({ error: "Username is required" });
      }
      if (password === "") {
        return res.status(400).json({ error: "Password is required" });
      }
      if (!companyId) {
        return res.status(400).json({ error: "Company is required" });
      }
      const d = await prisma.user.findFirst({
        where: { username },
        select: { username: true },
      });
      if (d) {
        res.status(409).json({ error: "Username already exists" });
      }
      await prisma.user.create({
        data: {
          username,
          password,
          companyId: Number(companyId),
          roles: {
            create: roleIds.map((roleId) => ({ roleId })),
          },
        },
        include: {
          roles: {
            include: { role: true },
          },
        },
      });
      res.status(201).json({
        message: "User created successfully",
      });
    }
    if (req.method === "POST") {
      const { id, username, password, companyId, rolesId } = req.body;
      console.log(req.body);
      if (!username) {
        return res.status(400).json({ error: "Username is required" });
      }
      if (!password) {
        return res.status(400).json({ error: "Password is required" });
      }
      if (!companyId) {
        return res.status(400).json({ error: "Company is required" });
      }

      const d = await prisma.user.findFirst({
        where: { username, id: { not: id } },
      });
      if (d) {
        return res.status(409).json({ error: "Username already exists" });
      }

      // Start transaction array
      const transactionOps: any[] = [];

      // 1️⃣ Always update basic info
      transactionOps.push(
        prisma.user.update({
          where: { id },
          data: { username, password, companyId: Number(companyId) },
        })
      );

      // 2️⃣ Only update roles if rolesId is provided
      if (Array.isArray(rolesId)) {
        const existingRoles = await prisma.userRole.findMany({
          where: { userId: id },
          select: { roleId: true },
        });

        const existingRoleIds = existingRoles.map((r) => r.roleId).sort();
        const newRoleIds = [...rolesId].sort();

        const rolesChanged =
          existingRoleIds.length !== newRoleIds.length ||
          existingRoleIds.some((r, idx) => r !== newRoleIds[idx]);

        if (rolesChanged) {
          transactionOps.push(
            prisma.userRole.deleteMany({ where: { userId: id } }),
            prisma.userRole.createMany({
              data: rolesId.map((roleId: number) => ({
                userId: id,
                roleId,
              })),
            })
          );
        }
      }

      await prisma.$transaction(transactionOps);

      res.status(201).json({ message: "User updated successfully" });
    }
    if (req.method === "DELETE") {
      const { id } = req.query;
      await prisma.userRole.deleteMany({ where: { userId: Number(id) } });
      await prisma.user.delete({
         where: { id: Number(id) },
      });
      res.status(200).json({
        message: "User deleted successfully",
      });
    }
  } catch (error) {
    console.error("API error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
