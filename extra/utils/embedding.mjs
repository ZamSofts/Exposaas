/**
 * Embedding utilities for few-shot similarity search.
 *
 * Uses Gemini's gemini-embedding-001 model to compute vector embeddings
 * of PaymentConfirmation JSON data. These embeddings enable selecting
 * the most semantically similar golden records as few-shot examples.
 *
 * Part of the AI Learning Loop Stage 2 (Embedding Few-Shot Selection).
 */

import { GoogleGenAI } from "@google/genai";
import { prisma } from "../PrismaClient/prismaClient.mjs";
import { GEMINI_MODELS } from "../../src/config/aiConstants.mjs";

/**
 * Convert a PaymentConfirmation JSON to a text representation for embedding.
 * Captures the structural signature: auction name, number of vehicles,
 * charge types, and field patterns — NOT the actual values (which would
 * make every invoice unique and defeat similarity matching).
 *
 * @param {object} json - PaymentConfirmation.Json (e.g. { page_1: [...] })
 * @param {string|null} auctionHouse - Denormalized auction name
 * @returns {string} Text representation for embedding
 */
export function jsonToEmbeddingText(json, auctionHouse = null) {
  const vehicles = [];
  if (json) {
    for (const key of Object.keys(json)) {
      if (key.startsWith("page_") && Array.isArray(json[key])) {
        vehicles.push(...json[key]);
      }
    }
  }

  const parts = [];

  // Auction identity
  if (auctionHouse) {
    parts.push(`auction: ${auctionHouse}`);
  }

  // Structure: vehicle count
  parts.push(`vehicles: ${vehicles.length}`);

  // Charge type patterns per vehicle
  for (let i = 0; i < vehicles.length; i++) {
    const v = vehicles[i];
    const chargeTypes = (v.charges || [])
      .filter(c => c.type && c.amount != null && c.amount !== 0)
      .map(c => c.type)
      .sort();
    if (chargeTypes.length > 0) {
      parts.push(`v${i + 1}_charges: ${chargeTypes.join(", ")}`);
    }
    // Brand pattern (manufacturer name, not specific model)
    if (v.brand) {
      parts.push(`v${i + 1}_brand: ${v.brand}`);
    }
  }

  // Unique charge types across all vehicles (overall signature)
  const allChargeTypes = [...new Set(
    vehicles.flatMap(v => (v.charges || [])
      .filter(c => c.type && c.amount != null && c.amount !== 0)
      .map(c => c.type))
  )].sort();
  if (allChargeTypes.length > 0) {
    parts.push(`all_charge_types: ${allChargeTypes.join(", ")}`);
  }

  return parts.join(" | ");
}

/**
 * Compute embedding vector for a text string using Gemini Embedding API.
 *
 * @param {string} text - Text to embed
 * @returns {Promise<number[]>} Embedding vector
 */
export async function computeEmbedding(text) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const result = await ai.models.embedContent({
    model: GEMINI_MODELS.EMBEDDING,
    contents: text,
  });
  return result.embeddings[0].values;
}

/**
 * Cosine similarity between two vectors.
 *
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number} Similarity score (-1 to 1, higher = more similar)
 */
export function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Compute and store embedding for a PaymentConfirmation record.
 * Idempotent — skips if embedding already exists.
 *
 * @param {number} recordId - PaymentConfirmation.id
 * @returns {Promise<number[]|null>} The embedding vector, or null if skipped
 */
export async function embedRecord(recordId) {
  const record = await prisma.paymentConfirmation.findUnique({
    where: { id: recordId },
    select: { id: true, Json: true, auctionHouse: true, embedding: true },
  });

  if (!record) return null;
  if (record.embedding) return record.embedding;

  const text = jsonToEmbeddingText(record.Json, record.auctionHouse);
  const vector = await computeEmbedding(text);

  await prisma.paymentConfirmation.update({
    where: { id: recordId },
    data: { embedding: vector },
  });

  return vector;
}

/**
 * Backfill embeddings for all golden records that don't have one yet.
 *
 * @param {number} companyId
 * @returns {Promise<{ total: number, computed: number, skipped: number }>}
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const BACKFILL_DELAY_MS = 200;

export async function backfillGoldenEmbeddings(companyId) {
  const records = await prisma.paymentConfirmation.findMany({
    where: { companyId, isGolden: true },
    select: { id: true, Json: true, auctionHouse: true, embedding: true },
  });

  let computed = 0;
  let skipped = 0;

  for (const r of records) {
    if (r.embedding) {
      skipped++;
      continue;
    }

    const text = jsonToEmbeddingText(r.Json, r.auctionHouse);
    const vector = await computeEmbedding(text);

    await prisma.paymentConfirmation.update({
      where: { id: r.id },
      data: { embedding: vector },
    });

    computed++;
    await sleep(BACKFILL_DELAY_MS);
  }

  return { total: records.length, computed, skipped };
}
