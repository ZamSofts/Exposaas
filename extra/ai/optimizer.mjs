import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "../PrismaClient/prismaClient.mjs";
import { EXTRACTION_SCHEMA, schemaToConstraintText } from "./schema.mjs";

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ============================================
// Step A: Analyze error patterns from user corrections
// ============================================

/**
 * Aggregate diffSummary data to find systematic error patterns.
 * This is the "trace collection" step in DSPy's MIPROv2.
 *
 * @param {number} companyId
 * @param {object} [options]
 * @param {number} [options.limit=50] - Max records to analyze
 * @returns {Promise<{ totalDiffs, ranking, chargeErrors }>}
 */
export async function analyzeErrors(companyId, options = {}) {
  const { limit = 50 } = options;

  const corrections = await prisma.paymentConfirmation.findMany({
    where: { companyId, isCorrect: "corrected", diffSummary: { not: null } },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { diffSummary: true, auctionHouse: true },
  });

  if (corrections.length === 0) {
    return { totalDiffs: 0, ranking: [], chargeErrors: [] };
  }

  // Aggregate field-level errors
  const fieldErrors = {};
  const chargeErrors = [];

  for (const r of corrections) {
    const diff = r.diffSummary;
    if (!diff?.vehicles) continue;

    for (const v of diff.vehicles) {
      // Field-level errors
      for (const [field, change] of Object.entries(v.fields || {})) {
        if (!fieldErrors[field]) {
          fieldErrors[field] = { count: 0, examples: [] };
        }
        fieldErrors[field].count++;
        if (fieldErrors[field].examples.length < 5) {
          fieldErrors[field].examples.push({
            auction: r.auctionHouse || "unknown",
            original: change.original,
            corrected: change.corrected,
          });
        }
      }

      // Charge-level errors
      const charges = v.charges || {};
      if (charges.added?.length > 0) {
        for (const ch of charges.added) {
          chargeErrors.push({
            type: "missing",
            auction: r.auctionHouse,
            chargeType: ch.type,
            amount: ch.amount,
            desc: `missed ${ch.type}: ${ch.amount}`,
          });
        }
      }
      if (charges.removed?.length > 0) {
        for (const ch of charges.removed) {
          chargeErrors.push({
            type: "extra",
            auction: r.auctionHouse,
            chargeType: ch.type,
            amount: ch.amount,
            desc: `incorrectly extracted ${ch.type}: ${ch.amount}`,
          });
        }
      }
      if (charges.changed?.length > 0) {
        for (const ch of charges.changed) {
          chargeErrors.push({
            type: "wrong_amount",
            auction: r.auctionHouse,
            chargeType: ch.type,
            original: ch.original,
            corrected: ch.corrected,
            desc: `${ch.type}: extracted ${ch.original} but correct was ${ch.corrected}`,
          });
        }
      }
    }
  }

  // Build ranking: sorted by error rate (highest first)
  const ranking = Object.entries(fieldErrors)
    .map(([field, data]) => ({
      field,
      count: data.count,
      errorRate: Math.round((data.count / corrections.length) * 100),
      examples: data.examples,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    totalDiffs: corrections.length,
    ranking,
    chargeErrors: chargeErrors.slice(0, 20), // Cap at 20 for prompt size
  };
}

// ============================================
// Step B: Generate prompt candidates via meta-prompting
// ============================================

/**
 * Use Gemini to analyze error patterns and generate improved prompts.
 * This is the core "optimizer" — Gemini rewrites its own extraction prompt.
 *
 * @param {object} params
 * @param {string} params.currentPrompt - The current active prompt content
 * @param {object} params.errorAnalysis - Output from analyzeErrors()
 * @param {number} [params.numCandidates=3] - How many variations to generate
 * @returns {Promise<Array<{ approach, content }>>}
 */
export async function generateCandidates({
  currentPrompt,
  errorAnalysis,
  numCandidates = 3,
}) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const schemaText = schemaToConstraintText(EXTRACTION_SCHEMA);

  // Build the meta-prompt
  const metaPrompt = `あなたはプロンプトエンジニアリングの専門家です。

以下は、日本のオークション請求書PDFからデータを抽出するAIシステムの現在のプロンプトとエラー分析結果です。

## 現在のプロンプト（改善対象）
\`\`\`
${currentPrompt.slice(0, 8000)}
\`\`\`

## フィールド定義（出力の型）
${schemaText}

## エラー分析結果（ユーザーの修正パターン）

### フィールド別エラーランキング
${errorAnalysis.ranking.map(r =>
    `- **${r.field}** (エラー率: ${r.errorRate}%, ${r.count}件)\n` +
    r.examples.map(e =>
      `  AI出力: "${e.original}" → 正解: "${e.corrected}" (${e.auction})`
    ).join("\n")
  ).join("\n")}

### 料金分類エラー（${errorAnalysis.chargeErrors.length}件）
${errorAnalysis.chargeErrors.slice(0, 10).map(e => `- ${e.desc}`).join("\n")}

## あなたのタスク

上記のエラーパターンを分析し、プロンプトを改善してください。
${numCandidates}つの異なるアプローチで改善案を作成してください。

各改善案は以下を満たすこと:
1. エラー率が高いフィールドに特に注力
2. 具体的な正例・誤例を含める
3. 既存の抽出ロジックを壊さない
4. JSON出力形式は変更しない

以下のJSON配列形式で返してください:
[
  {
    "id": 1,
    "approach": "改善アプローチの1行説明",
    "content": "改善されたプロンプト全文"
  },
  {
    "id": 2,
    "approach": "...",
    "content": "..."
  },
  {
    "id": 3,
    "approach": "...",
    "content": "..."
  }
]

注意:
- "content"は完全なプロンプト文を含めること（差分ではなく全文）
- プロンプトは英語で書く（日本語のフィールド名・例は英語プロンプト内に含めてよい）
- 必ず有効なJSON配列で返すこと`;

  // Call Gemini for meta-prompting
  let result;
  try {
    result = await model.generateContent(metaPrompt);
  } catch (err) {
    // Retry once after delay for rate limiting
    if (err?.message?.includes("429") || err?.message?.includes("quota")) {
      console.warn("[optimizer] Rate limited, retrying in 10s...");
      await sleep(10000);
      result = await model.generateContent(metaPrompt);
    } else {
      throw err;
    }
  }

  const text = (await result.response.text()).trim();

  // Parse JSON response
  const cleanText = text
    .replace(/^```json\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let candidates;
  try {
    candidates = JSON.parse(cleanText);
  } catch (e) {
    // Try to extract JSON from response
    const match = /(\[[\s\S]*\])/m.exec(cleanText);
    if (match) {
      candidates = JSON.parse(match[1]);
    } else {
      throw new Error(`Failed to parse meta-prompt response: ${cleanText.slice(0, 200)}`);
    }
  }

  if (!Array.isArray(candidates)) {
    throw new Error("Meta-prompt did not return an array");
  }

  return candidates.map(c => ({
    approach: c.approach || `Candidate ${c.id}`,
    content: c.content,
  }));
}

// ============================================
// Step C: Evaluate candidates against golden dataset
// ============================================

/**
 * Evaluate prompt candidates against golden dataset, save as PromptVersions.
 * Reuses existing evaluateAgainstGolden() infrastructure.
 *
 * @param {object} params
 * @param {Array} params.candidates - From generateCandidates()
 * @param {number} params.companyId
 * @param {number|null} params.parentId - Active PromptVersion id (parent)
 * @returns {Promise<{ results, bestCandidate, baselineScore }>}
 */
export async function evaluateAndSaveCandidates({ candidates, companyId, parentId }) {
  const { evaluateAgainstGolden } = await import("../utils/promptEvaluator.mjs");

  // Fetch golden records
  const goldenRecords = await prisma.paymentConfirmation.findMany({
    where: { companyId, isGolden: true },
    select: { id: true, DocumentURL: true, Page: true, Json: true, invoiceJobId: true },
  });

  if (goldenRecords.length === 0) {
    throw new Error("ゴールデンデータがありません。最低1件レビュー済みデータをゴールデンに指定してください。");
  }

  // Build job URL map
  const jobIds = goldenRecords.map(r => r.invoiceJobId).filter(Boolean);
  const invoiceJobs = await prisma.invoiceJobs.findMany({
    where: { id: { in: jobIds } },
    select: { id: true, DocumentURL: true },
  });
  const jobUrlMap = new Map(invoiceJobs.map(j => [j.id, j.DocumentURL]));

  // Also evaluate current active prompt as baseline
  const activeVersion = await prisma.promptVersion.findFirst({
    where: { companyId, status: "active" },
    select: { id: true, content: true, score: true },
  });

  // Count existing versions for naming
  const versionCount = await prisma.promptVersion.count({ where: { companyId } });

  const results = [];

  // Evaluate each candidate
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    console.log(`[optimizer] Evaluating candidate ${i + 1}/${candidates.length}: ${candidate.approach}`);

    try {
      const evalResult = await evaluateAgainstGolden(
        goldenRecords,
        jobUrlMap,
        companyId,
        candidate.content
      );

      // Save as PromptVersion
      const pv = await prisma.promptVersion.create({
        data: {
          version: `v${versionCount + i + 1}.0-auto`,
          content: candidate.content,
          strategy: "meta_optimized",
          status: "evaluated",
          score: evalResult.aggregateScore,
          scoreDetails: {
            ...evalResult,
            approach: candidate.approach,
            optimizerGenerated: true,
          },
          parentId: parentId || null,
          companyId,
          evaluatedAt: new Date(),
        },
      });

      results.push({
        id: pv.id,
        version: pv.version,
        approach: candidate.approach,
        score: evalResult.aggregateScore,
        exactMatches: evalResult.exactMatches,
        totalRecords: evalResult.totalRecords,
      });
    } catch (err) {
      console.error(`[optimizer] Candidate ${i + 1} evaluation failed:`, err?.message || err);
      results.push({
        id: null,
        approach: candidate.approach,
        score: 0,
        error: err?.message || "Evaluation failed",
      });
    }

    // Delay between evaluations to avoid rate limiting
    if (i < candidates.length - 1) {
      await sleep(2000);
    }
  }

  // Sort by score
  results.sort((a, b) => (b.score || 0) - (a.score || 0));

  const baselineScore = activeVersion?.score || null;
  const bestCandidate = results[0];

  return {
    results,
    bestCandidate,
    baselineScore,
    improvement: bestCandidate && baselineScore != null
      ? Math.round((bestCandidate.score - baselineScore) * 100)
      : null,
    goldenCount: goldenRecords.length,
  };
}

// ============================================
// Full optimization pipeline
// ============================================

/**
 * Run the full optimization pipeline: Analyze → Generate → Evaluate.
 * Called from the API endpoint.
 *
 * @param {number} companyId
 * @returns {Promise<object>} Results including candidates, scores, improvement
 */
export async function runOptimization(companyId) {
  console.log("[optimizer] Starting optimization for company", companyId);

  // Step A: Analyze errors
  console.log("[optimizer] Step A: Analyzing error patterns...");
  const errorAnalysis = await analyzeErrors(companyId);

  if (errorAnalysis.totalDiffs < 1) {
    return {
      error: "修正データが不足しています。最低1件のレビュー修正が必要です。",
      step: "A",
    };
  }

  console.log(`[optimizer]   ${errorAnalysis.totalDiffs} corrections analyzed`);
  console.log(`[optimizer]   Top errors: ${errorAnalysis.ranking.slice(0, 3).map(r => `${r.field}(${r.errorRate}%)`).join(", ")}`);

  // Get current active prompt
  const activeVersion = await prisma.promptVersion.findFirst({
    where: { companyId, status: "active" },
    select: { id: true, content: true, score: true },
  });

  if (!activeVersion?.content) {
    return {
      error: "アクティブなプロンプトバージョンがありません。まず /prompts でプロンプトを作成してください。",
      step: "B",
    };
  }

  // Step B: Generate candidates
  console.log("[optimizer] Step B: Generating prompt candidates via meta-prompting...");
  let candidates;
  try {
    candidates = await generateCandidates({
      currentPrompt: activeVersion.content,
      errorAnalysis,
      numCandidates: 3,
    });
  } catch (err) {
    console.error("[optimizer] Meta-prompting failed:", err?.message || err);
    return {
      error: `プロンプト候補の生成に失敗しました: ${err?.message || err}`,
      step: "B",
    };
  }

  console.log(`[optimizer]   Generated ${candidates.length} candidates`);

  // Step C: Evaluate candidates
  console.log("[optimizer] Step C: Evaluating candidates against golden dataset...");
  const evalResults = await evaluateAndSaveCandidates({
    candidates,
    companyId,
    parentId: activeVersion.id,
  });

  console.log("[optimizer] Optimization complete!");
  console.log(`[optimizer]   Best: ${evalResults.bestCandidate?.approach} (${Math.round((evalResults.bestCandidate?.score || 0) * 100)}%)`);
  if (evalResults.improvement != null) {
    console.log(`[optimizer]   Improvement: ${evalResults.improvement >= 0 ? "+" : ""}${evalResults.improvement}%`);
  }

  return {
    errorAnalysis: {
      totalDiffs: errorAnalysis.totalDiffs,
      topErrors: errorAnalysis.ranking.slice(0, 5),
      chargeErrorCount: errorAnalysis.chargeErrors.length,
    },
    ...evalResults,
  };
}
