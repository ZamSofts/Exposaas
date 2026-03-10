import { prisma } from "../PrismaClient/prismaClient.mjs";
import { ACCURACY_THRESHOLDS, SIMPLIFIED_PROMPT_THRESHOLD } from "../../src/config/aiConstants.mjs";

/**
 * Generate prompt variations based on accuracy data and common correction patterns.
 *
 * Strategies:
 * - "emphasize_charges": Add stronger rules for charge extraction (common weak area)
 * - "negative_examples": Add examples of common mistakes to avoid
 * - "simplified": Streamline prompt for high-accuracy auction houses
 * - "strict_chassis": Extra emphasis on chassis number extraction
 *
 * @param {string} basePrompt - The current active prompt content
 * @param {object} accuracyData - From accuracyStats API: { byField, byAuction }
 * @param {number} companyId
 * @returns {Array<{ content: string, strategy: string, description: string }>}
 */
export async function generatePromptVariations(basePrompt, accuracyData, companyId) {
  const variations = [];
  const byField = accuracyData?.byField || [];
  const byAuction = accuracyData?.byAuction || [];

  // Find weak fields (accuracy < 85%)
  const weakFields = byField.filter(f => f.accuracy < ACCURACY_THRESHOLDS.HIGH);
  // Find common correction patterns from diffSummary
  const recentCorrections = await prisma.paymentConfirmation.findMany({
    where: { companyId, isCorrect: "corrected", diffSummary: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { diffSummary: true, auctionHouse: true },
  });

  // Strategy 1: Emphasize charges if charge accuracy is low
  const chargeField = byField.find(f => f.field === "charges");
  if (chargeField && chargeField.accuracy < ACCURACY_THRESHOLDS.HIGH) {
    const chargeErrors = recentCorrections
      .filter(r => r.diffSummary?.vehicles?.some(v =>
        v.charges?.added?.length > 0 || v.charges?.removed?.length > 0 || v.charges?.changed?.length > 0
      ))
      .slice(0, 5);

    const errorExamples = chargeErrors.map(r => {
      const vehicle = r.diffSummary.vehicles?.[0];
      if (!vehicle) return null;
      const parts = [];
      if (vehicle.charges?.changed?.length > 0) {
        vehicle.charges.changed.forEach(c => {
          parts.push(`${c.type}: extracted ${c.original} but correct was ${c.corrected}`);
        });
      }
      if (vehicle.charges?.added?.length > 0) {
        vehicle.charges.added.forEach(c => {
          parts.push(`missed ${c.type}: ${c.amount}`);
        });
      }
      if (vehicle.charges?.removed?.length > 0) {
        vehicle.charges.removed.forEach(c => {
          parts.push(`incorrectly extracted ${c.type}: ${c.amount} (should not exist)`);
        });
      }
      return parts.join("; ");
    }).filter(Boolean);

    const chargeEmphasis = `
# ====== CHARGE EXTRACTION — CRITICAL ACCURACY RULES ======
Current charge extraction accuracy is ${Math.round(chargeField.accuracy * 100)}%. Pay EXTRA attention to:
${errorExamples.length > 0 ? `Common mistakes to AVOID:\n${errorExamples.map((e, i) => `  ${i + 1}. ${e}`).join("\n")}` : ""}
• Double-check EVERY numeric value against the source PDF
• Verify charge type mapping: Do NOT confuse auction_fee with listing_fee
• Stacked cells: ALWAYS extract the TOP/BASE value, never the tax line
• If a charge appears but the amount is 0 or blank, OMIT it entirely
# ====== END CHARGE EMPHASIS ======
`;
    variations.push({
      content: basePrompt.replace(
        "# ====== EXTRACTION RULES",
        chargeEmphasis + "\n# ====== EXTRACTION RULES"
      ),
      strategy: "emphasize_charges",
      description: `Emphasize charge extraction (current accuracy: ${Math.round(chargeField.accuracy * 100)}%)`,
    });
  }

  // Strategy 2: Strict chassis extraction if chassis accuracy is low
  const chassisField = byField.find(f => f.field === "chassis_number");
  if (chassisField && chassisField.accuracy < SIMPLIFIED_PROMPT_THRESHOLD) {
    const chassisErrors = recentCorrections
      .filter(r => r.diffSummary?.vehicles?.some(v => v.fields?.chassis_number))
      .slice(0, 5);

    const chassisExamples = chassisErrors.map(r => {
      const vehicle = r.diffSummary.vehicles?.find(v => v.fields?.chassis_number);
      if (!vehicle?.fields?.chassis_number) return null;
      const { original, corrected } = vehicle.fields.chassis_number;
      return `Extracted "${original}" → Correct: "${corrected}"`;
    }).filter(Boolean);

    const chassisEmphasis = `
# ====== CHASSIS NUMBER — CRITICAL ACCURACY RULES ======
Current chassis extraction accuracy is ${Math.round(chassisField.accuracy * 100)}%. Common errors:
${chassisExamples.map((e, i) => `  ${i + 1}. ${e}`).join("\n")}
• The chassis number MUST include BOTH the model code AND the serial number
• Model code is usually 3-7 alphanumeric characters (e.g., DA63T, ZVW51)
• Serial number is usually 5-8 digits following the model code
• NEVER truncate or drop digits from the serial number
• If the chassis appears on a second line below the vehicle name, extract the SECOND line
# ====== END CHASSIS EMPHASIS ======
`;
    variations.push({
      content: basePrompt.replace(
        "Chassis Number Extraction (CRITICAL):",
        chassisEmphasis + "\nChassis Number Extraction (CRITICAL):"
      ),
      strategy: "strict_chassis",
      description: `Strengthen chassis extraction (current accuracy: ${Math.round(chassisField.accuracy * 100)}%)`,
    });
  }

  // Strategy 3: Negative examples — show common mistakes from corrections
  if (recentCorrections.length >= 3) {
    const negativeExamples = recentCorrections.slice(0, 5).map(r => {
      const diff = r.diffSummary;
      if (!diff?.vehicles?.length) return null;
      const parts = [];
      for (const v of diff.vehicles) {
        for (const [field, change] of Object.entries(v.fields || {})) {
          parts.push(`Field "${field}": AI extracted "${change.original}" but correct answer was "${change.corrected}"`);
        }
      }
      return parts.length > 0 ? parts.join("\n") : null;
    }).filter(Boolean);

    if (negativeExamples.length > 0) {
      const negativeSection = `
# ====== COMMON MISTAKES TO AVOID ======
The following are REAL errors from past extractions. Study these patterns and avoid them:
${negativeExamples.map((ex, i) => `--- Mistake ${i + 1} ---\n${ex}\n--- End Mistake ${i + 1} ---`).join("\n")}
# ====== END COMMON MISTAKES ======
`;
      variations.push({
        content: negativeSection + "\n\n" + basePrompt,
        strategy: "negative_examples",
        description: `Added ${negativeExamples.length} negative examples from recent corrections`,
      });
    }
  }

  // Strategy 4: Simplified prompt for high-accuracy auction houses
  const highAccAuctions = byAuction.filter(a => a.accuracy >= SIMPLIFIED_PROMPT_THRESHOLD && a.count >= 10);
  if (highAccAuctions.length > 0) {
    const auctionNames = highAccAuctions.map(a => a.auction).join(", ");
    // Create a streamlined version by removing verbose explanations
    const simplified = basePrompt
      .replace(/\(e\.g\.,.*?\)/g, "") // Remove example parentheticals
      .replace(/Handle varied formats:.*?\./g, "") // Remove format descriptions
      .replace(/Use OCR for small\/unclear text\./g, "");

    variations.push({
      content: simplified,
      strategy: "simplified",
      description: `Simplified prompt — high-accuracy auctions: ${auctionNames}`,
    });
  }

  // Always return at least the base prompt as a variation
  if (variations.length === 0) {
    variations.push({
      content: basePrompt,
      strategy: "baseline",
      description: "Current prompt (no modifications)",
    });
  }

  return variations;
}
