import type { NextApiRequest, NextApiResponse } from "next";
import { prisma, getSession } from "@/lib/useful";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (session.role !== "Sadmin") {
    return res.status(403).json({ error: "Only administrators can view roles" });
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
      //LoadEdit
      if (id) {
        const role = await prisma.role.findUnique({
          where: { id },
        });
        return res.status(200).json(role);
      }

      //specific
      if (selectFields) {
        const role = await prisma.role.findMany({
          select: selectFields,
          orderBy: { [sortBy]: sortOrder },
        });
        return res.status(200).json(role);
      }

      //All
      const [role, total] = await Promise.all([
        prisma.role.findMany({
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
          where: {
            name: {
              contains: search,
              mode: "insensitive",
            },
          },
        }),
        prisma.role.count({ where: { name: { contains: search, mode: "insensitive" } } }), // total roles
      ]);
      // await new Promise((resolve) => setTimeout(resolve, 4000));
      res.status(200).json({ role, total });
    }

    if (req.method === "PUT") {
      const { name } = req.body;
      if (name === "") {
        return res.status(400).json({ error: "Name is required" });
      }
      const d = await prisma.role.findFirst({
        where: { name },
        select: { name: true },
      });
      if (d) {
        return res.status(409).json({ error: "Role already exists" });
      }
      await prisma.role.create({
        data: {
          name,
        },
      });
      return res.status(201).json({
        message: "Role created successfully",
      });
    }

    if (req.method === "POST") {
      const { id, name } = req.body;

      if (name === "") {
        return res.status(400).json({ error: "Name is required" });
      }

      const d = await prisma.role.findFirst({
        where: { name, id: { not: id } },
      });
      if (d) {
        return res.status(409).json({ error: "Role name already exists", d, id });
      }

      await prisma.role.update({
        where: { id },
        data: {
          name,
        },
      });
      return res.status(201).json({
        message: "Role updated successfully",
      });
    }

    if (req.method === "DELETE") {
      await prisma.role.delete({
        where: { id },
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
