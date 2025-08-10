import type { NextApiRequest, NextApiResponse } from "next";
import { prisma, getSession } from "@/lib/useful";
import { Pause } from "lucide-react";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (session.role !== "Sadmin") {
    return res.status(403).json({ error: "Only administrators can view companies" });
  }

  const id = Number(req.query.id);
  try {
    if (req.method === "GET") {
      if (id) {
        const company = await prisma.company.findUnique({
          where: { id },
        });
        return res.status(200).json(company);
      }

      const company = await prisma.company.findMany({
        orderBy: {
          createdAt: "desc",
        },
      });
      res.status(200).json({ company });
    }

    if (req.method === "PUT") {
      const { name } = req.body;
      if (name === "") {
        return res.status(400).json({ error: "Name is required" });
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
      const { id, name } = req.body;
      if (name === "") {
        return res.status(400).json({ error: "Name is required" });
      }

      const result = await prisma.company.update({
        where: { id },
        data: {
          name,
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
