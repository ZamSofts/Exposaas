import { prisma, getSession } from "@/lib/useful"; // adjust path if needed

export default async function handler(req, res) {
  const session = await getSession(req, res);


  try {
    if (req.method === "GET") {
      const status=await prisma.vehicleStatus.findMany()
      return res.status(200).json(status);
    }

  
  } catch (error) {
    console.error("API error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
