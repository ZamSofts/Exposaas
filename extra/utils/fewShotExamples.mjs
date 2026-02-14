import { prisma } from "../PrismaClient/prismaClient.mjs";

const MAX_EXAMPLES = 3;
const MAX_VEHICLES_PER_EXAMPLE = 5;

/**
 * Fetch best few-shot examples for a company, using DSPy-inspired selection:
 *
 * Priority order:
 *   1. Same auction + isGolden (highest quality, most relevant)
 *   2. Same auction + exact_match (relevant, AI was correct)
 *   3. Same auction + corrected (relevant, user-verified ground truth)
 *   4. Any auction + isGolden (high quality, different context)
 *   5. Any auction + exact_match (fallback)
 *
 * Also ensures diversity: avoids returning examples with identical charge type patterns.
 *
 * @param {number} companyId
 * @param {object} options
 * @param {string} [options.auctionName] - Filter examples by auction house name
 * @returns {Promise<Array<{ page_1: Array }>>}
 */
export async function fetchFewShotExamples(companyId, options = {}) {
  const { auctionName = null } = options;

  let candidates = [];

  if (auctionName) {
    // Tier 1: Same auction + golden (best quality + most relevant)
    const goldenSameAuction = await prisma.paymentConfirmation.findMany({
      where: { companyId, isGolden: true, auctionHouse: auctionName },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { Json: true, isCorrect: true, auctionHouse: true },
    });
    candidates.push(...goldenSameAuction);

    // Tier 2: Same auction + exact_match (AI was correct for this auction)
    if (candidates.length < MAX_EXAMPLES * 2) {
      const exactSameAuction = await prisma.paymentConfirmation.findMany({
        where: { companyId, isCorrect: "exact_match", auctionHouse: auctionName, isGolden: false },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { Json: true, isCorrect: true, auctionHouse: true },
      });
      candidates.push(...exactSameAuction);
    }

    // Tier 3: Same auction + corrected (user-verified ground truth)
    if (candidates.length < MAX_EXAMPLES * 2) {
      const correctedSameAuction = await prisma.paymentConfirmation.findMany({
        where: { companyId, isCorrect: "corrected", auctionHouse: auctionName, isGolden: false },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { Json: true, isCorrect: true, auctionHouse: true },
      });
      candidates.push(...correctedSameAuction);
    }
  }

  // Tier 4: Any auction + golden (high quality from other auctions)
  if (candidates.length < MAX_EXAMPLES * 2) {
    const goldenOther = await prisma.paymentConfirmation.findMany({
      where: {
        companyId,
        isGolden: true,
        ...(auctionName ? { NOT: { auctionHouse: auctionName } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { Json: true, isCorrect: true, auctionHouse: true },
    });
    candidates.push(...goldenOther);
  }

  // Tier 5: Any auction + exact_match (general fallback)
  if (candidates.length < MAX_EXAMPLES) {
    const exactAny = await prisma.paymentConfirmation.findMany({
      where: {
        companyId,
        isCorrect: "exact_match",
        ...(auctionName ? { NOT: { auctionHouse: auctionName } } : {}),
        isGolden: false,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { Json: true, isCorrect: true, auctionHouse: true },
    });
    candidates.push(...exactAny);
  }

  // Parse and clean all candidates
  const parsed = [];
  for (const r of candidates) {
    const json = r.Json || {};
    let vehicles = [];
    for (const key of Object.keys(json)) {
      if (key.startsWith("page_") && Array.isArray(json[key])) {
        vehicles.push(...json[key]);
      }
    }
    if (vehicles.length === 0) continue;

    vehicles = vehicles.slice(0, MAX_VEHICLES_PER_EXAMPLE).map(v => ({
      auction: v.auction || undefined,
      auction_date: v.auction_date || undefined,
      chassis_number: v.chassis_number,
      lot_number: v.lot_number || undefined,
      brand: v.brand || undefined,
      charges: (v.charges || [])
        .filter(ch => ch.type && ch.amount != null && ch.amount !== 0)
        .map(ch => ({ type: ch.type, amount: Number(ch.amount) })),
    }));

    // Compute charge signature for diversity check
    const chargeSignature = vehicles
      .flatMap(v => (v.charges || []).map(c => c.type))
      .sort()
      .join(",");

    parsed.push({ example: { page_1: vehicles }, chargeSignature });
  }

  // Select with diversity: prefer different charge type patterns
  const selected = [];
  const seenSignatures = new Set();

  // First pass: pick examples with unique charge patterns
  for (const p of parsed) {
    if (selected.length >= MAX_EXAMPLES) break;
    if (!seenSignatures.has(p.chargeSignature)) {
      seenSignatures.add(p.chargeSignature);
      selected.push(p.example);
    }
  }

  // Second pass: fill remaining slots regardless of diversity
  for (const p of parsed) {
    if (selected.length >= MAX_EXAMPLES) break;
    if (!selected.includes(p.example)) {
      selected.push(p.example);
    }
  }

  return selected;
}
