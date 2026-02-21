import { prisma } from "../PrismaClient/prismaClient.mjs";
import { jsonToEmbeddingText, computeEmbedding, cosineSimilarity } from "./embedding.mjs";

const MAX_EXAMPLES = 3;
const MAX_VEHICLES_PER_EXAMPLE = 5;

/**
 * Fetch best few-shot examples using embedding similarity.
 *
 * Selection strategy (Stage 2 of AI Learning Loop):
 *   1. Compute embedding of the incoming invoice's structure
 *   2. Fetch all golden records with embeddings for this company
 *   3. Rank by cosine similarity
 *   4. Select top-K with charge-type diversity
 *
 * Falls back to tier-based selection (Stage 1) when:
 *   - No golden records have embeddings yet
 *   - Embedding computation fails (e.g., API error)
 *
 * @param {number} companyId
 * @param {object} options
 * @param {string} [options.auctionName] - Auction house name (used for embedding context + fallback)
 * @param {object} [options.inputJson] - The extracted JSON to find similar examples for
 * @returns {Promise<Array<{ page_1: Array }>>}
 */
export async function fetchFewShotExamples(companyId, options = {}) {
  const { auctionName = null, inputJson = null } = options;

  // Try embedding-based selection first
  try {
    const result = await fetchByEmbedding(companyId, auctionName, inputJson);
    if (result && result.length > 0) {
      return result;
    }
  } catch (err) {
    console.warn(`[fewShot] Embedding selection failed, falling back to tier-based:`, err?.message || err);
  }

  // Fallback: tier-based selection (Stage 1)
  return fetchByTier(companyId, auctionName);
}

/**
 * Embedding-based few-shot selection (Stage 2).
 *
 * @param {number} companyId
 * @param {string|null} auctionName
 * @param {object|null} inputJson - Current extraction to find similar examples for
 * @returns {Promise<Array|null>}
 */
async function fetchByEmbedding(companyId, auctionName, inputJson) {
  // Fetch golden records that have embeddings
  const goldenRecords = await prisma.paymentConfirmation.findMany({
    where: {
      companyId,
      isGolden: true,
      embedding: { not: null },
    },
    select: { id: true, Json: true, auctionHouse: true, embedding: true },
  });

  if (goldenRecords.length === 0) return null;

  // Compute query embedding from input context
  const queryText = inputJson
    ? jsonToEmbeddingText(inputJson, auctionName)
    : `auction: ${auctionName || "unknown"} | vehicles: 1`;

  const queryEmbedding = await computeEmbedding(queryText);

  // Rank by cosine similarity
  const ranked = goldenRecords
    .map(r => ({
      record: r,
      similarity: cosineSimilarity(queryEmbedding, r.embedding),
    }))
    .sort((a, b) => b.similarity - a.similarity);

  // Select top-K with diversity
  return selectWithDiversity(ranked.map(r => r.record));
}

/**
 * Tier-based few-shot selection (Stage 1 fallback).
 * Original 5-tier priority: same auction+golden > same auction+exact >
 * same auction+corrected > any golden > any exact.
 *
 * @param {number} companyId
 * @param {string|null} auctionName
 * @returns {Promise<Array>}
 */
async function fetchByTier(companyId, auctionName) {
  let candidates = [];

  if (auctionName) {
    // Tier 1: Same auction + golden
    const goldenSameAuction = await prisma.paymentConfirmation.findMany({
      where: { companyId, isGolden: true, auctionHouse: auctionName },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { Json: true, isCorrect: true, auctionHouse: true },
    });
    candidates.push(...goldenSameAuction);

    // Tier 2: Same auction + exact_match
    if (candidates.length < MAX_EXAMPLES * 2) {
      const exactSameAuction = await prisma.paymentConfirmation.findMany({
        where: { companyId, isCorrect: "exact_match", auctionHouse: auctionName, isGolden: false },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { Json: true, isCorrect: true, auctionHouse: true },
      });
      candidates.push(...exactSameAuction);
    }

    // Tier 3: Same auction + corrected
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

  // Tier 4: Any auction + golden
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

  // Tier 5: Any auction + exact_match
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

  return selectWithDiversity(candidates);
}

/**
 * Parse records and select with charge-type diversity.
 * Shared by both embedding and tier-based selection.
 *
 * @param {Array} records - PaymentConfirmation records (must have .Json)
 * @returns {Array<{ page_1: Array }>}
 */
function selectWithDiversity(records) {
  const parsed = [];
  for (const r of records) {
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

    const chargeSignature = vehicles
      .flatMap(v => (v.charges || []).map(c => c.type))
      .sort()
      .join(",");

    parsed.push({ example: { page_1: vehicles }, chargeSignature });
  }

  // First pass: pick examples with unique charge patterns
  const selected = [];
  const seenSignatures = new Set();

  for (const p of parsed) {
    if (selected.length >= MAX_EXAMPLES) break;
    if (!seenSignatures.has(p.chargeSignature)) {
      seenSignatures.add(p.chargeSignature);
      selected.push(p.example);
    }
  }

  // Second pass: fill remaining slots
  for (const p of parsed) {
    if (selected.length >= MAX_EXAMPLES) break;
    if (!selected.includes(p.example)) {
      selected.push(p.example);
    }
  }

  return selected;
}
