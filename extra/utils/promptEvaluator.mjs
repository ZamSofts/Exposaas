import { prisma } from "../PrismaClient/prismaClient.mjs";
import { computeScoredDiff } from "./computeDiff.ts";

/**
 * Evaluate extraction against golden records.
 * Re-extracts each golden PDF with the given prompt (or current prompt) and scores.
 *
 * @param {Array} goldenRecords - PaymentConfirmation records marked as golden
 * @param {Map} jobUrlMap - Map of invoiceJobId -> DocumentURL
 * @param {number} companyId
 * @param {string|null} promptContent - Custom prompt to test, or null for current default
 * @returns {{ aggregateScore, totalRecords, exactMatches, perRecord }}
 */
export async function evaluateAgainstGolden(goldenRecords, jobUrlMap, companyId, promptContent = null) {
  const { processPageWithGemini } = await import("../workers/geminiProcess.mjs");

  const perRecord = [];
  let totalScore = 0;
  let exactMatches = 0;

  for (const record of goldenRecords) {
    const pdfUrl = jobUrlMap.get(record.invoiceJobId) || record.DocumentURL;

    if (!pdfUrl) {
      perRecord.push({
        id: record.id,
        score: null,
        isExactMatch: false,
        fieldsChanged: null,
        error: "No PDF URL available",
      });
      continue;
    }

    try {
      // Re-extract with candidate prompt
      const extracted = await processPageWithGemini(pdfUrl, record.Page, {
        companyId,
        promptContent: promptContent || undefined,
      });

      // Compare against golden correction
      const diff = computeScoredDiff(extracted, record.Json);

      perRecord.push({
        id: record.id,
        score: diff.score,
        isExactMatch: diff.isExactMatch,
        fieldsChanged: diff.fieldsChanged,
        totalFieldsCompared: diff.totalFieldsCompared,
        error: null,
      });

      totalScore += diff.score;
      if (diff.isExactMatch) exactMatches++;
    } catch (err) {
      console.error(`Evaluation failed for record #${record.id}:`, err?.message || err);
      perRecord.push({
        id: record.id,
        score: 0,
        isExactMatch: false,
        fieldsChanged: null,
        error: err?.message || "Extraction failed",
      });
    }
  }

  const validResults = perRecord.filter(r => r.score !== null);
  const aggregateScore = validResults.length > 0 ? totalScore / validResults.length : 0;

  return {
    aggregateScore,
    totalRecords: goldenRecords.length,
    exactMatches,
    perRecord,
  };
}

/**
 * Evaluate a specific PromptVersion against golden dataset.
 * Updates the PromptVersion with scores.
 *
 * @param {number} promptVersionId
 * @param {number} companyId
 */
export async function evaluatePromptVersion(promptVersionId, companyId) {
  const promptVersion = await prisma.promptVersion.findUnique({
    where: { id: promptVersionId },
  });

  if (!promptVersion) throw new Error(`PromptVersion #${promptVersionId} not found`);

  // Update status to evaluating
  await prisma.promptVersion.update({
    where: { id: promptVersionId },
    data: { status: "evaluating" },
  });

  try {
    // Fetch golden records
    const goldenRecords = await prisma.paymentConfirmation.findMany({
      where: { companyId, isGolden: true },
      select: {
        id: true,
        DocumentURL: true,
        Page: true,
        Json: true,
        invoiceJobId: true,
      },
    });

    if (goldenRecords.length === 0) {
      await prisma.promptVersion.update({
        where: { id: promptVersionId },
        data: { status: "evaluated", score: null, scoreDetails: { error: "No golden records" }, evaluatedAt: new Date() },
      });
      return { error: "No golden records" };
    }

    // Build job URL map
    const jobIds = goldenRecords.map(r => r.invoiceJobId).filter(Boolean);
    const invoiceJobs = await prisma.invoiceJobs.findMany({
      where: { id: { in: jobIds } },
      select: { id: true, DocumentURL: true },
    });
    const jobUrlMap = new Map(invoiceJobs.map(j => [j.id, j.DocumentURL]));

    // Run evaluation
    const results = await evaluateAgainstGolden(goldenRecords, jobUrlMap, companyId, promptVersion.content);

    // Store results
    await prisma.promptVersion.update({
      where: { id: promptVersionId },
      data: {
        status: "evaluated",
        score: results.aggregateScore,
        scoreDetails: results,
        evaluatedAt: new Date(),
      },
    });

    return results;
  } catch (err) {
    console.error(`Evaluation failed for PromptVersion #${promptVersionId}:`, err?.message || err);
    await prisma.promptVersion.update({
      where: { id: promptVersionId },
      data: { status: "evaluated", score: 0, scoreDetails: { error: err?.message }, evaluatedAt: new Date() },
    });
    throw err;
  }
}
