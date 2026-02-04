import { PrismaClient } from "../../src/generated/prisma/index.js"; // <- point to generated client

const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Graceful shutdown
process.on("SIGTERM", async () => {
  try {
    await prisma.$disconnect();
  } catch (e) {
    console.error("❌ [prisma] Error disconnecting on SIGTERM:", e);
  }
});

process.on("SIGINT", async () => {
  try {
    await prisma.$disconnect();
  } catch (e) {
    console.error("❌ [prisma] Error disconnecting on SIGINT:", e);
  }
});

export { prisma };
