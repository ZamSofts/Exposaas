// src/pages/api/permissions.ts
import { prisma, getSession } from "@/lib/useful"; // adjust path if needed

export default async function handler(req, res) {
  const session = await getSession(req, res);

  try {
    if (req.method === "GET") {
      const permissions=await prisma.permission.findMany({orderBy: { name: 'asc' }})
      return res.status(200).json({ permissions});
    }

  
  } catch (error) {
    console.error("API error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
