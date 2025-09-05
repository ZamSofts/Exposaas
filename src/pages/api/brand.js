// src/pages/api/permissions.ts
import { prisma, getSession } from "@/lib/useful"; // adjust path if needed

export default async function handler(req, res) {
  const session = await getSession(req, res);

  // Restrict to super admins for now
  if (!["Sadmin", "Admin"].includes(session.role)) {
    return res.status(403).json({ error: "Only administrators can view users" });
  }

  try {
    if (req.method === "GET") {
      const brands=await prisma.brand.findMany({orderBy: { name: 'asc' }})
      return res.status(200).json(brands);
    }

  
  } catch (error) {
    console.error("API error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
