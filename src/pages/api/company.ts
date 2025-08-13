import type { NextApiRequest, NextApiResponse } from "next";
import { prisma, getSession } from "@/lib/useful";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (session.role !== "Sadmin") {
    return res.status(403).json({ error: "Only administrators can view companies" });
  }

  const id = Number(req.query.id);
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const search = String(req.query.search || "")
    .trim()
    .toLowerCase();
  const { sortBy = "id", sortOrder = "asc" } = req.query;

  try {
    if (req.method === "GET") {
      if (id) {
        const company = await prisma.company.findUnique({
          where: { id },
        });
        return res.status(200).json(company);
      }

      const [company, total, inactive] = await Promise.all([
        prisma.company.findMany({
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
          where: {
            name: {
              contains: search,
              mode: "insensitive",
            },
          },
          include: {
            _count: { select: { users: true } },
          },
        }),
        prisma.company.count({ where: { name: { contains: search, mode: "insensitive" } } }), // total companies
        prisma.company.count({ where: { status: "inactive", name: { contains: search, mode: "insensitive" } } }), // inactive companies
      ]);
      // await new Promise((resolve) => setTimeout(resolve, 100));
      res.status(200).json({ company, total, inactive });
    }

    if (req.method === "PUT") {
      const { name } = req.body;
      if (name === "") {
        return res.status(400).json({ error: "Name is required" });
      }
      const d = await prisma.company.findFirst({
        where: { name },
        select: { name: true },
      });
      if (d) {
        res.status(409).json({ error: "Company already exists" });
      }
      await prisma.company.create({
        data: {
          name,
          status: "active",
          createdAt: new Date(),
        },
      });
      res.status(201).json({
        message: "Company created successfully",
      });
    }

    if (req.method === "POST") {
      const { id, name, status } = req.body;

      if (name === "") {
        return res.status(400).json({ error: "Name is required" });
      }

      const d = await prisma.company.findFirst({
        where: { name, id: { not: id } },
      });
      if (d) {
        res.status(409).json({ error: "Company name already exists", d, id });
      }

      await prisma.company.update({
        where: { id },
        data: {
          name,
          status,
        },
      });
      res.status(201).json({
        message: "Company updated successfully",
      });
    }

    if (req.method === "DELETE") {
      await prisma.company.delete({
        where: { id },
      });
      res.status(200).json({
        message: "Company deleted successfully",
      });
    }
  } catch (error) {
    console.error("API error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
