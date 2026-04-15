import { initQueue } from "../queues/geminiExtractHeader.mjs";
import { processPageWithGemini, QuotaExhaustedError } from "./geminiProcess.mjs";
import { prisma } from "../PrismaClient/prismaClient.mjs";
import { deleteFile } from "../../src/lib/blob.mjs";
import { InvoiceHeaderResponseSchema } from "../ai/zodSchemas.mjs";
import { QUOTA_REQUEUE_DELAY_SECONDS } from "../../src/config/aiConstants.mjs";
import HolidayJP from "@holiday-jp/holiday_jp";

let boss;

// ─── Venue Payment Rules ─────────────────────────────────────────────────────
// type "days_after":  paymentDueDate = auctionDate + N days
// type "from_invoice": paymentDueDate is printed in the invoice — use AI-extracted value
// Default (unknown venue): +1 day, prepaymentRequired = true

const VENUE_PAYMENT_RULES = [
  // ── +6 days, no prepayment ──────────────────────────────────────────────────
  { keywords: ["USS", "HAA", "JAA"],                        rule: { type: "days_after", days: 6 }, prepaymentRequired: false },
  { keywords: ["LAA"],                                      rule: { type: "days_after", days: 6 }, prepaymentRequired: false },
  { keywords: ["IAUC", "iAUC", "アイオーク", "IAA"],        rule: { type: "days_after", days: 6 }, prepaymentRequired: false },
  { keywords: ["ISUZU", "いすゞ", "イスズ"],                rule: { type: "days_after", days: 6 }, prepaymentRequired: false },
  // アライ建機のみ先払い必須 — 一般アライより先にチェック
  { keywords: ["アライ建機"],                               rule: { type: "days_after", days: 6 }, prepaymentRequired: true  },
  { keywords: ["ARAI", "アライ"],                           rule: { type: "days_after", days: 6 }, prepaymentRequired: false },
  { keywords: ["ベイオーク", "BAYOAK", "BAY OAK"],          rule: { type: "days_after", days: 6 }, prepaymentRequired: false },
  { keywords: ["ZIP", "ジップ"],                            rule: { type: "days_after", days: 6 }, prepaymentRequired: false },

  // ── +4 days, no prepayment ──────────────────────────────────────────────────
  { keywords: ["TAA"],                                      rule: { type: "days_after", days: 4 }, prepaymentRequired: false },

  // ── from invoice, no prepayment ─────────────────────────────────────────────
  // JUコーポ/ミライブ愛知 は JUコーポ系 → ミライブより先にチェック
  { keywords: ["JUコーポ/ミライブ"],                        rule: { type: "from_invoice" },        prepaymentRequired: false },
  // JUトレード / JUコーポレーション — 一般JUより先にチェック
  { keywords: ["JUトレード", "JUコーポレーション", "JUコーポ", "JU TRADE", "JU CORP"], rule: { type: "from_invoice" }, prepaymentRequired: false },

  // ── from invoice, ⚠️ prepayment required ────────────────────────────────────
  { keywords: ["花まる", "はなまる", "Hanamaru", "HANAMARU", "ハナマル"], rule: { type: "from_invoice" }, prepaymentRequired: true },
  { keywords: ["タウ", "TAU"],                              rule: { type: "from_invoice" },        prepaymentRequired: true  },

  // ── +1 day, ⚠️ prepayment required ──────────────────────────────────────────
  { keywords: ["JU広島", "JU岐阜", "JU愛知"],              rule: { type: "days_after", days: 1 }, prepaymentRequired: true  },
  { keywords: ["ミライブ", "MIRIVE"],                      rule: { type: "days_after", days: 1 }, prepaymentRequired: true  },
  { keywords: ["NAA", "NOAA"],                             rule: { type: "days_after", days: 1 }, prepaymentRequired: true  },
  { keywords: ["CAA"],                                     rule: { type: "days_after", days: 1 }, prepaymentRequired: true  },
  { keywords: ["オリックス", "ORIX"],                      rule: { type: "days_after", days: 1 }, prepaymentRequired: true  },
  { keywords: ["ホンダ", "HONDA"],                         rule: { type: "days_after", days: 1 }, prepaymentRequired: true  },
  { keywords: ["KCAA"],                                    rule: { type: "days_after", days: 6 }, prepaymentRequired: true  },

  // ── General JU (上記の特定JUより後) — from invoice ──────────────────────────
  { keywords: ["JU"],                                      rule: { type: "from_invoice" },        prepaymentRequired: false },
];

const DEFAULT_RULE = { rule: { type: "days_after", days: 1 }, prepaymentRequired: true };

function getVenueConfig(venueStr) {
  if (!venueStr) return DEFAULT_RULE;
  const upper = venueStr.toUpperCase();
  for (const entry of VENUE_PAYMENT_RULES) {
    if (entry.keywords.some(k => upper.includes(k.toUpperCase()))) {
      return { rule: entry.rule, prepaymentRequired: entry.prepaymentRequired };
    }
  }
  return DEFAULT_RULE;
}

/**
 * Shift a date back to the nearest preceding business day
 * if it falls on a weekend or Japanese public holiday.
 * If the holiday span is 3+ days, keep the date as-is (manual correction required).
 */
function shiftToBusinessDay(date) {
  const d = new Date(date);
  let shifted = 0;
  while (
    d.getDay() === 0 ||               // Sunday
    d.getDay() === 6 ||               // Saturday
    HolidayJP.isHoliday(d)            // Japanese public holiday
  ) {
    d.setDate(d.getDate() - 1);
    shifted++;
    if (shifted >= 3) {
      // Long holiday (≥3 days): revert to original, let user fix manually
      return new Date(date);
    }
  }
  return d;
}

function calcPaymentDueDate(auctionDate, rule, extractedPaymentDueDate) {
  if (!rule) return null;

  if (rule.type === "from_invoice") {
    // Use the date extracted by Gemini from the invoice
    if (!extractedPaymentDueDate) return null;
    const normalized = extractedPaymentDueDate.replace(/\//g, "-");
    const d = new Date(normalized);
    if (isNaN(d.getTime())) return null;
    return shiftToBusinessDay(d);
  }

  if (!auctionDate) return null;
  const base = new Date(auctionDate);
  if (isNaN(base.getTime())) return null;

  if (rule.type === "days_after") {
    const due = new Date(base);
    due.setDate(due.getDate() + rule.days);
    return shiftToBusinessDay(due);
  }

  return null;
}

// ─── Header Extraction Prompt ────────────────────────────────────────────────

const HEADER_EXTRACTION_PROMPT = `
You are extracting invoice header information from a Japanese car auction invoice (精算書).
This page is the LAST page of a multi-page invoice.

Extract ONLY these 5 fields and return them as JSON:

{
  "auctionVenue":   string | null,  // auction venue name (e.g. "USS大阪会場", "HAA神戸")
  "auctionDate":    string | null,  // auction date in YYYY/MM/DD format
  "sessionNumber":  string | null,  // session number (e.g. "第1285回", "第2026-001回")
  "invoiceTotal":   integer | null, // final amount due (integer, no commas)
  "paymentDueDate": string | null   // payment due date in YYYY/MM/DD format, if explicitly printed
}

Rules:
- auctionVenue: the name of the auction house. Look for text like "USS大阪会場", "HAA神戸", "LAA関西" etc.
- auctionDate: the date of the auction session in YYYY/MM/DD format. Convert Japanese date format if needed.
- sessionNumber: look for 「第○○○回」 or similar pattern in the header.
- invoiceTotal: use 「差引ご請求残高」 or 「差引お支払額」 or 「差引合計」 FIRST.
  NEVER use 「本日取引ご請求額」 or 「当回AA小計」.
  If no carryover balance field exists, use 「請求書合計」.
  Return as integer with no commas (e.g. 2614210, not ¥2,614,210).
- paymentDueDate: only extract if the invoice explicitly prints a payment due date (お支払期日, 振込期限 etc.).
  If no such date is printed, return null.

Return ONLY valid JSON. No explanation, no markdown.
`.trim();

// ─── Worker ──────────────────────────────────────────────────────────────────

(async () => {
  try {
    boss = await initQueue();

    if (boss && typeof boss.on === "function") {
      boss.on("error", err => console.error("[pg-boss] error:", err));
    }

    console.log("🗂️  Invoice header worker started and listening...");

    await boss.work("gemini-extract-header", { teamConcurrency: 1 }, async ([job]) => {
      const { auctionInvoiceId } = job.data;

      if (!auctionInvoiceId) {
        console.warn("[invoiceHeader] Missing auctionInvoiceId in job payload");
        return;
      }

      console.log(`📋 Extracting header for AuctionInvoice #${auctionInvoiceId}`);

      // Get the last page's blob URL from InvoiceJobs
      const lastPageJob = await prisma.invoiceJobs.findFirst({
        where: { auctionInvoiceId },
        orderBy: { pageNumber: "desc" },
        select: { DocumentURL: true, pageNumber: true, companyId: true },
      });

      if (!lastPageJob?.DocumentURL) {
        console.warn(`[invoiceHeader] No last page URL found for AuctionInvoice #${auctionInvoiceId}`);
        await prisma.auctionInvoice.update({
          where: { id: auctionInvoiceId },
          data: { status: "completed" },
        });
        return;
      }

      const { DocumentURL: lastPageUrl, pageNumber, companyId } = lastPageJob;
      console.log(`📄 Processing last page (page ${pageNumber}) for AuctionInvoice #${auctionInvoiceId}`);

      try {
        // Send last page to Gemini with header-focused prompt
        const rawResponse = await processPageWithGemini(lastPageUrl, pageNumber, {
          companyId,
          customPrompt: HEADER_EXTRACTION_PROMPT,
          rawJsonResponse: true,
        });

        // Validate response
        const parsed = InvoiceHeaderResponseSchema.safeParse(rawResponse);
        if (!parsed.success) {
          console.warn(`[invoiceHeader] Zod validation warning for AuctionInvoice #${auctionInvoiceId}:`,
            parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join(", ")
          );
        }

        const { auctionVenue, auctionDate, sessionNumber, invoiceTotal, paymentDueDate: extractedPaymentDueDate } = rawResponse ?? {};

        // Parse auctionDate string → Date object
        let auctionDateParsed = null;
        if (auctionDate) {
          const normalized = auctionDate.replace(/\//g, "-");
          const d = new Date(normalized);
          if (!isNaN(d.getTime())) auctionDateParsed = d;
        }

        // Get venue config (rule + prepaymentRequired)
        const { rule, prepaymentRequired } = getVenueConfig(auctionVenue);
        const paymentDueDate = calcPaymentDueDate(auctionDateParsed, rule, extractedPaymentDueDate);

        if (paymentDueDate) {
          console.log(`💳 Payment due: ${paymentDueDate.toISOString().split("T")[0]} (venue: ${auctionVenue}, prepay: ${prepaymentRequired})`);
        }

        // Update AuctionInvoice with extracted header data
        await prisma.auctionInvoice.update({
          where: { id: auctionInvoiceId },
          data: {
            auctionVenue:         auctionVenue  ?? undefined,
            auctionDate:          auctionDateParsed ?? undefined,
            sessionNumber:        sessionNumber ?? undefined,
            invoiceTotal:         Number.isInteger(invoiceTotal) ? invoiceTotal : undefined,
            paymentDueDate:       paymentDueDate ?? undefined,
            isPrepaymentRequired: prepaymentRequired,
            status:               "completed",
          },
        });

        console.log(`✅ AuctionInvoice #${auctionInvoiceId} header saved — venue: ${auctionVenue}, session: ${sessionNumber}, total: ${invoiceTotal}`);

        // Cleanup: delete the last page blob now that header extraction is done
        try { await deleteFile(lastPageUrl); }
        catch (cleanupErr) { console.warn(`[invoiceHeader] Failed to delete last page blob:`, cleanupErr.message); }

      } catch (err) {
        console.error(`❌ Header extraction failed for AuctionInvoice #${auctionInvoiceId}:`, err.message);

        if (err instanceof QuotaExhaustedError) {
          console.warn(`⏳ Quota exhausted — re-queuing header extraction in 30 minutes`);
          await boss.send("gemini-extract-header", job.data, { startAfter: QUOTA_REQUEUE_DELAY_SECONDS });
          return;
        }

        // Mark as completed even on failure so it doesn't block the payment calendar
        await prisma.auctionInvoice.update({
          where: { id: auctionInvoiceId },
          data: { status: "completed" },
        });

        throw err;
      }
    });

  } catch (err) {
    console.error("[invoiceHeader] Fatal error:", err);
    process.exit(1);
  }
})();

process.on("SIGTERM", async () => {
  try {
    if (boss && typeof boss.stop === "function") await boss.stop();
    await prisma.$disconnect();
  } catch {}
  finally { process.exit(0); }
});

process.on("SIGINT", async () => {
  try {
    if (boss && typeof boss.stop === "function") await boss.stop();
    await prisma.$disconnect();
  } catch {}
  finally { process.exit(0); }
});
