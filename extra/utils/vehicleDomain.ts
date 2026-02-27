/**
 * Domain functions for vehicle-related entity resolution.
 *
 * These functions extract duplicated brand/customer find-or-create logic
 * that was previously copy-pasted across API routes and workers.
 *
 * All functions accept `prisma` as a parameter so they work with both
 * the API Prisma instance (src/lib/db.js) and the worker instance
 * (extra/PrismaClient/prismaClient.mjs).
 */

// Use minimal interfaces instead of importing PrismaClient directly.
// This avoids import path issues between src/ and extra/ while keeping type safety.
interface BrandPrisma {
  brand: {
    findMany: (args: { select: { id: true; name: true } }) => Promise<Array<{ id: number; name: string }>>;
    create: (args: { data: { name: string } }) => Promise<{ id: number; name: string }>;
    findUnique: (args: { where: { name: string } }) => Promise<{ id: number; name: string } | null>;
  };
}

interface CustomerPrisma {
  customer: {
    findMany: (args: any) => Promise<Array<{ id: number; name: string }>>;
    create: (args: any) => Promise<{ id: number; name: string }>;
    findFirst: (args: any) => Promise<{ id: number } | null>;
  };
}

// ── Types ──

export interface BrandResolution {
  brandMap: Map<string, number>;
  defaultBrandId: number;
}

// ── Functions ──

/**
 * Pre-load all brands and create any missing ones.
 * Returns a Map (name -> id) including the default "-" brand.
 *
 * Race condition safe: uses P2002 (unique constraint violation) catch
 * to handle concurrent creation of the same brand.
 */
export async function resolveBrands(
  prisma: BrandPrisma,
  brandNames: (string | null | undefined)[],
): Promise<BrandResolution> {
  // Load all existing brands into a Map
  const allBrands = await prisma.brand.findMany({ select: { id: true, name: true } });
  const brandMap = new Map<string, number>(allBrands.map(b => [b.name, b.id]));

  // Ensure default brand "-" exists
  if (!brandMap.has("-")) {
    const created = await prisma.brand.create({ data: { name: "-" } });
    brandMap.set("-", created.id);
  }
  const defaultBrandId = brandMap.get("-")!;

  // Collect unique new brand names that need creation
  const newNames = new Set<string>();
  for (const raw of brandNames) {
    const name = raw?.trim();
    if (name && name !== "" && !brandMap.has(name)) {
      newNames.add(name);
    }
  }

  // Batch-create missing brands (with race condition protection)
  for (const name of newNames) {
    try {
      const created = await prisma.brand.create({ data: { name } });
      brandMap.set(name, created.id);
    } catch (e: any) {
      if (e.code === "P2002") {
        // Brand was created by concurrent request, fetch it
        const existing = await prisma.brand.findUnique({ where: { name } });
        if (existing) brandMap.set(name, existing.id);
      } else {
        throw e;
      }
    }
  }

  return { brandMap, defaultBrandId };
}

/**
 * Pre-load company-scoped customers and create any missing ones.
 * Returns a Map (lowercased name -> id).
 *
 * Race condition safe: uses P2002 catch to handle concurrent creation.
 */
export async function resolveCustomers(
  prisma: CustomerPrisma,
  companyId: number,
  customerNames: (string | null | undefined)[],
  sourcePrefix: string = "auto",
): Promise<Map<string, number>> {
  const customerMap = new Map<string, number>();

  // Deduplicate and filter empty names
  const uniqueNames = new Set<string>();
  for (const raw of customerNames) {
    const name = raw?.trim();
    if (name) uniqueNames.add(name);
  }

  if (uniqueNames.size === 0) return customerMap;

  // Batch load existing customers (case-insensitive)
  const existingCustomers = await prisma.customer.findMany({
    where: {
      companyId: Number(companyId),
      name: { in: [...uniqueNames], mode: "insensitive" },
    },
    select: { id: true, name: true },
  });
  for (const c of existingCustomers) {
    customerMap.set(c.name.toLowerCase(), c.id);
  }

  // Auto-create missing customers (with race condition protection)
  for (const name of uniqueNames) {
    if (!customerMap.has(name.toLowerCase())) {
      try {
        const created = await prisma.customer.create({
          data: {
            name,
            companyId: Number(companyId),
            uniqueId: `${sourcePrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          },
        });
        customerMap.set(name.toLowerCase(), created.id);
      } catch (e: any) {
        if (e.code === "P2002") {
          // Customer was created by concurrent request, fetch it
          const existing = await prisma.customer.findFirst({
            where: { companyId: Number(companyId), name: { equals: name, mode: "insensitive" } },
            select: { id: true },
          });
          if (existing) customerMap.set(name.toLowerCase(), existing.id);
        } else {
          throw e;
        }
      }
    }
  }

  return customerMap;
}
