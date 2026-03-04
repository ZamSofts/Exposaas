import prismaClient from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { putFile } from "./blob.mjs";

const getSession = async (req, res) => {
  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user) {
    res.status(401).json({ error: "Unauthorized or session missing" });
    throw new Error("No session");
  }

  return session.user;
};

export const prisma = prismaClient;

export { getSession, putFile };
