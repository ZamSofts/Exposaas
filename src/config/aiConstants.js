/**
 * Shared constants for the AI Learning Loop.
 * Used across accuracy dashboard, prompt management, review UI, and prompt generation.
 */

/** Accuracy thresholds (decimal, 0-1 scale) */
export const ACCURACY_THRESHOLDS = {
  HIGH: 0.85,
  MID: 0.60,
};

/** Same thresholds as percentages (0-100 scale) for display */
export const ACCURACY_PCT = {
  HIGH: 85,
  MID: 60,
};

/** Minimum reviewed records before auto-switching to summary review mode */
export const MIN_RECORDS_FOR_AUTO_MODE = 5;

/** Accuracy threshold for simplified prompt generation */
export const SIMPLIFIED_PROMPT_THRESHOLD = 0.90;

/** Max vehicles per invoice page — anything above is treated as AI hallucination */
export const MAX_VEHICLES_PER_PAGE = 20;

/** Delay (seconds) before re-queuing a job after Gemini daily quota exhaustion */
export const QUOTA_REQUEUE_DELAY_SECONDS = 30 * 60;

/** Confidence/accuracy color palette with foreground and background */
export const CONFIDENCE_COLORS = {
  high: { color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  mid:  { color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  low:  { color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
};

/**
 * Get confidence level label for a value (decimal 0-1).
 */
export function getConfidenceLevel(value) {
  if (value == null) return null;
  if (value >= ACCURACY_THRESHOLDS.HIGH) return "high";
  if (value >= ACCURACY_THRESHOLDS.MID) return "mid";
  return "low";
}

/**
 * Get hex color string for accuracy/confidence display.
 */
export function getAccuracyColor(value) {
  const level = getConfidenceLevel(value);
  return level ? CONFIDENCE_COLORS[level].color : "#ef4444";
}

/**
 * Get border style for confidence-highlighted input fields.
 */
export function getConfidenceBorder(confidence) {
  const level = getConfidenceLevel(confidence);
  if (!level) return {};
  return { borderColor: CONFIDENCE_COLORS[level].color, borderWidth: "2px" };
}
