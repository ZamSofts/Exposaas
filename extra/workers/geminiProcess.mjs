import { GoogleGenerativeAI } from "@google/generative-ai";
import { downloadFile as downloadFromAzure } from "../../src/lib/blob.mjs";

const RETRY_CONFIG = {
  maxRetries: 5,
  baseDelayMs: 5000,      
  maxDelayMs: 120000,      
  backoffMultiplier: 2,
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function extractRetryDelay(error) {
  const message = error?.message || String(error);
  const match = message.match(/retry in ([\d.]+)s/i);
  if (match) {
    return Math.ceil(parseFloat(match[1]) * 1000) + 1000; 
  }
  return null;
}

async function callGeminiWithRetry(model, content, pageNumber = 0) {
  let lastError = null;

  for (let attempt = 1; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      const result = await model.generateContent(content);
      return result;
    } catch (error) {
      lastError = error;
      const errorMessage = error?.message || String(error);
      const isRateLimit = errorMessage.includes('429') ||
                          errorMessage.includes('quota') ||
                          errorMessage.includes('rate') ||
                          errorMessage.includes('Too Many Requests');

      if (!isRateLimit) {
        // Not a rate limit error, don't retry
        throw error;
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

      await sleep(delayMs);
    }
  }

  throw lastError;
}

export async function processPageWithGemini(pageUrl, pageNumber, options = {}) {
  try {
    let stream;
    try {
      stream = await downloadFromAzure(pageUrl);
    } catch (err) {
      throw new Error(`Failed to download page ${pageNumber} from Azure: ${err?.message || err}`);
    }

    if (!stream) {
      throw new Error(`Azure download returned null/undefined stream for page ${pageNumber}`);
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

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

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

    // Build prompt via promptBuilder (single path — schema + instructions + few-shot)
    const { buildPrompt } = await import("../ai/promptBuilder.mjs");
    const { EXTRACTION_SCHEMA } = await import("../ai/schema.mjs");
    const dynamicPrompt = buildPrompt({
      schema: EXTRACTION_SCHEMA,
      fewShotExamples: examples,
      instructions,  // null → buildPrompt uses buildDefaultInstructions(schema)
    });

    const result = await callGeminiWithRetry(model, [
      {
        inlineData: {
          mimeType: "application/pdf",
          data: base64Data,
        },
      },
      dynamicPrompt,
    ], pageNumber);

    // Extract text from response
    let text = "";
    try {
      if (result?.response?.text) {
        text = (await result.response.text()).trim();
      } else if (result?.output?.[0]?.content) {
        const out = result.output[0];
        text = typeof out.content === "string" ? out.content.trim() : out.content[0]?.text?.trim();
      } else if (result?.outputs?.[0]) {
        const out0 = result.outputs[0];
        text = out0.text?.trim() || out0.content?.[0]?.text?.trim() || "";
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
      return [];
    }

    if (Array.isArray(parsed)) {
      return parsed;
    }

    const vehicles = parsed["page_1"] || parsed["page_2"] || parsed["items"] || [];
    return vehicles;

  } catch (error) {
    throw error instanceof Error ? error : new Error(String(error));
  }
}
