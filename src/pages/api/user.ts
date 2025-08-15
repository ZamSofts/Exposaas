import type { NextApiRequest, NextApiResponse } from "next";
import { prisma, getSession } from "@/lib/useful";
import { Console } from "console";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  const roles = ["Sadmin", "Admin"];
  if (!roles.includes(session.role)) {
    return res.status(403).json({ error: "Only administrators can view users" });
  }

  const id = Number(req.query.id);
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const search = String(req.query.search || "")
    .trim()
    .toLowerCase();
  const { sortBy = "id", sortOrder = "asc" } = req.query;
  const col = req.query.col ? String(req.query.col).split(",") : null;
  const selectFields = col && col.length > 0 ? Object.fromEntries(col.map((c) => [c, true])) : undefined;

  try {
    if (req.method === "GET") {
      console.log(id);
      //LoadEdit
      if (id) {
        const user = await prisma.user.findUnique({
          where: { id },
        });
        return res.status(200).json(user);
      }

      //specific
      if (selectFields) {
        const user = await prisma.user.findMany({
          select: selectFields,
          orderBy: { [sortBy]: sortOrder },
        });
        return res.status(200).json(user);
      }

      //All
      const [user, total] = await Promise.all([
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
            company: {
              select: {
                name: true,
              },
            },
          },
        }),
        prisma.user.count({ where: { username: { contains: search, mode: "insensitive" } } }), // total users
      ]);
      // await new Promise((resolve) => setTimeout(resolve, 4000));
      res.status(200).json({ user, total });
    }

    if (req.method === "PUT") {
      console.log(req.body);
      const { username, password, companyId } = req.body;
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
          createdAt: new Date(),
        },
      });
      res.status(201).json({
        message: "User created successfully",
      });
    }

    if (req.method === "POST") {
      const { id, username, password, companyId } = req.body;

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
        where: { username, id: { not: id } },
      });
      if (d) {
        res.status(409).json({ error: "Username already exists", d, id });
      }

      await prisma.user.update({
        where: { id },
        data: {
          username,
          password,
          companyId: Number(companyId),
        },
      });
      res.status(201).json({
        message: "User updated successfully",
      });
    }

    if (req.method === "DELETE") {
      await prisma.user.delete({
        where: { id },
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
