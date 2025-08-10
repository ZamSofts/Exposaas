import prismaClient from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { NextApiRequest, NextApiResponse } from "next";

const getSession = async (req: NextApiRequest, res: NextApiResponse) => {
  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user) {
    res.status(500).json({ error: "Unauthorized or session missing" });
    throw new Error("No session");
  }

  return session.user;
};

export const prisma = prismaClient;

export { getSession };
