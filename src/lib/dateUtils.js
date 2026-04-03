/**
 * Shared date formatting utilities.
 * Safe for both client and server use (no server-only imports).
 */

/**
 * Format a date value as YYYY/MM/DD in Japanese locale.
 * Returns "-" for null/undefined/invalid dates.
 */
export function formatDate(dateInput) {
  if (!dateInput) return "-";
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return "-";
  }
}
