/**
 * Shared vehicle diff computation.
 *
 * Two callers:
 *   - paymentConfirmation.js  → computeDetailedDiff()  (returns per-field changes for UI)
 *   - promptEvaluator.mjs     → computeScoredDiff()     (returns numeric score for evaluation)
 *
 * Core logic is unified here to avoid duplication.
 */

// @ts-ignore — schema.mjs is not yet migrated to TypeScript
import { COMPARED_FIELDS } from "../ai/schema.mjs";

// ── Types ──

interface ChargeEntry {
  type?: string;
  amount?: number | string | null;
}

interface VehicleObject {
  chassis_number?: string;
  charges?: ChargeEntry[];
  [key: string]: any;
}

interface VehicleDiffEntry {
  index: number;
  fields: Record<string, { original: string; corrected: string }>;
  charges: {
    added: Array<{ type: string; amount: number }>;
    removed: Array<{ type: string; amount: number }>;
    changed: Array<{ type: string; original: number; corrected: number }>;
  };
}

interface DiffSummary {
  vehicles: VehicleDiffEntry[];
  totalFieldsCompared: number;
  totalFieldsChanged: number;
  vehicleCountChanged?: { original: number; corrected: number };
}

export interface DetailedDiffResult {
  isCorrect: "exact_match" | "corrected";
  diffSummary: DiffSummary;
}

export interface ScoredDiffResult {
  isExactMatch: boolean;
  score: number;
  fieldsChanged: number;
  totalFieldsCompared: number;
}

// ── Internal Helpers ──

const normChassis = (s: string | undefined | null): string => (s || "").toUpperCase();

/**
 * Normalize a JSON blob into a flat array of vehicle objects.
 * Supports both { items: [...] } and { page_1: [...], page_2: [...] } formats.
 */
function normalizeVehicles(json: any): VehicleObject[] {
  if (!json) return [];
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.items)) return json.items;
  const out: VehicleObject[] = [];
  for (const key of Object.keys(json)) {
    if (Array.isArray(json[key])) out.push(...json[key]);
  }
  return out;
}

/**
 * Filter and sort charges for comparison.
 * Removes empty/zero amounts and normalizes to { type, amount } objects.
 */
function filterCharges(arr: ChargeEntry[] | undefined): Array<{ type: string; amount: number }> {
  return (arr || [])
    .filter((ch) => ch.amount != null && ch.amount !== 0 && ch.amount !== "")
    .map((ch) => ({ type: ch.type || "", amount: Number(ch.amount) }))
    .sort((a, b) => a.type.localeCompare(b.type) || a.amount - b.amount);
}

/**
 * Build a frequency map: chargeType → sorted [amounts].
 * Handles duplicate charge types (e.g., two shipping_fee entries).
 */
function buildFreqMap(charges: Array<{ type: string; amount: number }>): Map<string, number[]> {
  const map = new Map<string, number[]>();
  for (const ch of charges) {
    if (!map.has(ch.type)) map.set(ch.type, []);
    map.get(ch.type)!.push(ch.amount);
  }
  for (const [, amounts] of map) amounts.sort((a, b) => a - b);
  return map;
}

// ── Exported Functions ──

/**
 * Compare two vehicle arrays and return detailed diff per vehicle.
 * Used by paymentConfirmation.js for HITL review display.
 */
export function computeDetailedDiff(
  originalJson: Record<string, any>,
  correctedJson: Record<string, any>,
): DetailedDiffResult {
  const origVehicles = normalizeVehicles(originalJson);
  const corrVehicles = normalizeVehicles(correctedJson);

  const diff: DiffSummary = { vehicles: [], totalFieldsCompared: 0, totalFieldsChanged: 0 };

  if (origVehicles.length !== corrVehicles.length) {
    const minLen = Math.min(origVehicles.length, corrVehicles.length);
    diff.totalFieldsCompared = minLen * (COMPARED_FIELDS as string[]).length;
    diff.totalFieldsChanged = 1;
    return {
      isCorrect: "corrected",
      diffSummary: {
        ...diff,
        vehicleCountChanged: { original: origVehicles.length, corrected: corrVehicles.length },
      },
    };
  }

  let hasChanges = false;

  for (let i = 0; i < origVehicles.length; i++) {
    const o = origVehicles[i];
    const c = corrVehicles[i];
    const vDiff: VehicleDiffEntry = { index: i, fields: {}, charges: { added: [], removed: [], changed: [] } };

    for (const field of COMPARED_FIELDS as string[]) {
      diff.totalFieldsCompared++;
      const oVal = field === "chassis_number" ? normChassis(o[field]) : (o[field] || "");
      const cVal = field === "chassis_number" ? normChassis(c[field]) : (c[field] || "");
      if (oVal !== cVal) {
        vDiff.fields[field] = { original: o[field] || "", corrected: c[field] || "" };
        diff.totalFieldsChanged++;
        hasChanges = true;
      }
    }

    const oFreq = buildFreqMap(filterCharges(o.charges));
    const cFreq = buildFreqMap(filterCharges(c.charges));
    const allTypes = new Set([...oFreq.keys(), ...cFreq.keys()]);

    for (const type of allTypes) {
      const oAmounts = oFreq.get(type) || [];
      const cAmounts = cFreq.get(type) || [];
      const maxLen = Math.max(oAmounts.length, cAmounts.length);

      for (let j = 0; j < maxLen; j++) {
        diff.totalFieldsCompared++;
        const oAmt = j < oAmounts.length ? oAmounts[j] : undefined;
        const cAmt = j < cAmounts.length ? cAmounts[j] : undefined;

        if (oAmt === undefined) {
          vDiff.charges.added.push({ type, amount: cAmt! });
          diff.totalFieldsChanged++;
          hasChanges = true;
        } else if (cAmt === undefined) {
          vDiff.charges.removed.push({ type, amount: oAmt });
          diff.totalFieldsChanged++;
          hasChanges = true;
        } else if (oAmt !== cAmt) {
          vDiff.charges.changed.push({ type, original: oAmt, corrected: cAmt });
          diff.totalFieldsChanged++;
          hasChanges = true;
        }
      }
    }

    if (
      Object.keys(vDiff.fields).length > 0 ||
      vDiff.charges.added.length > 0 ||
      vDiff.charges.removed.length > 0 ||
      vDiff.charges.changed.length > 0
    ) {
      diff.vehicles.push(vDiff);
    }
  }

  return { isCorrect: hasChanges ? "corrected" : "exact_match", diffSummary: diff };
}

/**
 * Compare extracted vehicles against golden data and return a numeric score.
 * Used by promptEvaluator.mjs for prompt version evaluation.
 */
export function computeScoredDiff(
  extractedVehicles: VehicleObject[],
  goldenJson: Record<string, any>,
): ScoredDiffResult {
  const goldVehicles = normalizeVehicles(goldenJson);

  if (extractedVehicles.length !== goldVehicles.length) {
    return {
      isExactMatch: false,
      score: Math.max(0, 1 - Math.abs(extractedVehicles.length - goldVehicles.length) * 0.2),
      fieldsChanged: 1,
      totalFieldsCompared: Math.min(extractedVehicles.length, goldVehicles.length) * (COMPARED_FIELDS as string[]).length,
    };
  }

  let totalFieldsCompared = 0;
  let totalFieldsChanged = 0;

  for (let i = 0; i < extractedVehicles.length; i++) {
    const e = extractedVehicles[i];
    const g = goldVehicles[i];

    for (const field of COMPARED_FIELDS as string[]) {
      totalFieldsCompared++;
      const eVal = field === "chassis_number" ? normChassis(e[field]) : (e[field] || "");
      const gVal = field === "chassis_number" ? normChassis(g[field]) : (g[field] || "");
      if (eVal !== gVal) totalFieldsChanged++;
    }

    const eFreq = buildFreqMap(filterCharges(e.charges));
    const gFreq = buildFreqMap(filterCharges(g.charges));
    const allTypes = new Set([...eFreq.keys(), ...gFreq.keys()]);

    for (const type of allTypes) {
      const eAmounts = eFreq.get(type) || [];
      const gAmounts = gFreq.get(type) || [];
      const maxLen = Math.max(eAmounts.length, gAmounts.length);

      for (let j = 0; j < maxLen; j++) {
        totalFieldsCompared++;
        const eAmt = j < eAmounts.length ? eAmounts[j] : undefined;
        const gAmt = j < gAmounts.length ? gAmounts[j] : undefined;
        if (eAmt !== gAmt) totalFieldsChanged++;
      }
    }
  }

  const score = totalFieldsCompared > 0 ? 1 - totalFieldsChanged / totalFieldsCompared : 1;

  return { isExactMatch: totalFieldsChanged === 0, score, fieldsChanged: totalFieldsChanged, totalFieldsCompared };
}
