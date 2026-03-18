import { GoogleGenAI } from "@google/genai";
import { downloadFile } from "../../src/lib/blob.mjs";

const RETRY_CONFIG = {
  maxRetries: 5,
  baseDelayMs: 5000,
  maxDelayMs: 120000,
  backoffMultiplier: 2,
};

/**
 * Custom error for daily quota exhaustion.
 * Workers should NOT retry immediately — pg-boss will retry after a long delay.
 */
export class QuotaExhaustedError extends Error {
  constructor(message) {
    super(message);
    this.name = "QuotaExhaustedError";
  }
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function extractRetryDelay(error) {
  const message = error?.message || String(error);
  const match = message.match(/retry in ([\d.]+)s/i);
  if (match) {
    return Math.ceil(parseFloat(match[1]) * 1000) + 1000;
  }
  return null;
}

/**
 * Call Gemini with exponential backoff retry for rate-limit errors.
 * @param {GoogleGenAI} ai - Initialized GoogleGenAI client
 * @param {object} request - Full request object for ai.models.generateContent()
 * @param {number} pageNumber - For logging only
 */
async function callGeminiWithRetry(ai, request, pageNumber = 0) {
  let lastError = null;

  for (let attempt = 1; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      const result = await ai.models.generateContent(request);
      return result;
    } catch (error) {
      lastError = error;
      const errorMessage = error?.message || String(error);
      const isRateLimit = errorMessage.includes('429') ||
                          errorMessage.includes('quota') ||
                          errorMessage.includes('rate') ||
                          errorMessage.includes('Too Many Requests');

      if (!isRateLimit) {
        throw error;
      }

      // Distinguish daily quota exhaustion from RPM throttle.
      // Daily quota errors mention "quota" and won't resolve with short retries.
      const isDailyQuota = errorMessage.includes('quota') ||
                           errorMessage.includes('exceeded your current quota');
      if (isDailyQuota) {
        console.error(`🚫 [gemini] Daily quota exhausted (page ${pageNumber}). Will not retry immediately.`);
        throw new QuotaExhaustedError(errorMessage);
      }

      if (attempt === RETRY_CONFIG.maxRetries) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const extractedDelay = extractRetryDelay(error);
      const exponentialDelay = Math.min(
        RETRY_CONFIG.baseDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt - 1),
        RETRY_CONFIG.maxDelayMs
      );
      const delayMs = extractedDelay || exponentialDelay;
      console.warn(`⚠️ [gemini] Rate limit hit on attempt ${attempt} for page ${pageNumber}. Retrying in ${delayMs / 1000}s...`);
      await sleep(delayMs);
    }
  }

  throw lastError;
}

export async function processPageWithGemini(pageUrl, pageNumber, options = {}) {
  try {
    let stream;
    try {
      stream = await downloadFile(pageUrl);
    } catch (err) {
      throw new Error(`Failed to download page ${pageNumber} from storage: ${err?.message || err}`);
    }

    if (!stream) {
      throw new Error(`Storage download returned null/undefined stream for page ${pageNumber}`);
    }

    // Convert stream to buffer
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const pdfBuffer = Buffer.concat(chunks);

    if (pdfBuffer.length === 0) {
      throw new Error(`Downloaded PDF is empty (0 bytes) for page ${pageNumber}`);
    }

    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Missing GEMINI_API_KEY in environment");
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const base64Data = pdfBuffer.toString("base64");

    // Determine instructions: custom > active PromptVersion > default (from schema)
    let instructions = null;
    if (options.promptContent) {
      // Custom prompt passed directly (e.g., during evaluation)
      instructions = options.promptContent;
    } else if (options.companyId) {
      // Try to load active PromptVersion for this company
      try {
        const { prisma } = await import("../PrismaClient/prismaClient.mjs");
        const activeVersion = await prisma.promptVersion.findFirst({
          where: { companyId: Number(options.companyId), status: "active" },
          select: { content: true },
        });
        if (activeVersion?.content) {
          instructions = activeVersion.content;
        }
      } catch (err) {
        console.warn(`[gemini] Failed to load active PromptVersion for company ${options.companyId}:`, err?.message || err);
      }
    }

    // Build dynamic prompt with few-shot examples from confirmed data
    let examples = options.fewShotExamples || [];
    if (examples.length === 0 && options.companyId) {
      try {
        const { fetchFewShotExamples } = await import("../utils/fewShotExamples.mjs");
        examples = await fetchFewShotExamples(options.companyId, {
          auctionName: options.auctionName || null,
        });
      } catch (err) {
        console.warn(`[gemini] Few-shot fetch failed for company ${options.companyId}:`, err?.message || err);
      }
    }

    // Build prompt: use customPrompt if provided (for document classification/extraction),
    // otherwise use the standard invoice promptBuilder pipeline
    let dynamicPrompt;
    if (options.customPrompt) {
      // Custom prompt passed directly (e.g., document classification, cert extraction)
      dynamicPrompt = options.customPrompt;
    } else {
      // Standard invoice extraction: schema + instructions + few-shot
      const { buildPrompt } = await import("../ai/promptBuilder.mjs");
      const { EXTRACTION_SCHEMA } = await import("../ai/schema.mjs");
      dynamicPrompt = buildPrompt({
        schema: EXTRACTION_SCHEMA,
        fewShotExamples: examples,
        instructions,  // null → buildPrompt uses buildDefaultInstructions(schema)
      });
    }        

    // Build request with optional Structured Output config
    const request = {
      model: options.model || "gemini-2.5-flash",
      contents: [
        {
          inlineData: {
            mimeType: "application/pdf",
            data: base64Data,
          },
        },
        dynamicPrompt,
      ],
      config: options.responseConfig || {},
    };    

    const result = await callGeminiWithRetry(ai, request, pageNumber);

    // Extract text from response (new SDK: response.text is a property)
    let text = "";
    try {
      if (result?.text != null) {
        text = result.text.trim();
      } else if (result?.candidates?.[0]?.content?.parts?.[0]?.text) {
        text = result.candidates[0].content.parts[0].text.trim();
      } else {
        text = String(result).slice(0, 10000);
      }
    } catch (err) {
      text = String(result || "").slice(0, 10000);
    }

    // Parse JSON
    let cleanText = text
      .replace(/^```json/i, "")
      .replace(/```$/i, "")
      .trim();

    let parsed = null;
    try {
      parsed = JSON.parse(cleanText);
    } catch (e) {
      // Fallback: extract JSON from mixed text (only needed without Structured Output)
      const re = /({[\s\S]*}|\[[\s\S]*\])/m;
      const m = re.exec(cleanText);
      if (m) {
        try {
          parsed = JSON.parse(m[0]);
        } catch (e2) {
        }
      }
    }

    if (!parsed) {
      return options.rawJsonResponse ? null : [];
    }

    // If caller wants raw JSON (e.g., classification or document extraction), return as-is
    if (options.rawJsonResponse) {
      return parsed;
    }

    let vehicles;
    if (Array.isArray(parsed)) {
      vehicles = parsed;
    } else {
      vehicles = parsed["page_1"] || parsed["page_2"] || parsed["items"] || [];
    }

    // Normalize: if Gemini returned string elements instead of objects, try to parse them.
    // This handles cases where Structured Output wraps vehicle data as JSON strings.
    vehicles = vehicles.flatMap(item => {
      if (typeof item === "string") {
        try {
          const inner = JSON.parse(item.startsWith("[") ? item : `[${item}]`);
          return Array.isArray(inner) ? inner : [inner];
        } catch {
          console.warn("[gemini] Skipping unparseable string element in vehicles array");
          return [];
        }
      }
      return [item];
    });

    return vehicles;

  } catch (error) {
    throw error instanceof Error ? error : new Error(String(error));
  }
}
