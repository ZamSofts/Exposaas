/**
 * Shared utilities for InvoiceJobs — used by the /documents page.
 */

// ---------------------------------------------------------------------------
// Vehicle count from InvoiceJob Json
// ---------------------------------------------------------------------------
export function getVehicleCount(json) {
  if (!json) return 0;
  // New format: { items: [...] }
  if (Array.isArray(json.items)) return json.items.length;
  // Legacy format: { page_1: [...], page_2: [...] }
  let count = 0;
  for (const key of Object.keys(json)) {
    if (key.startsWith("page_") && Array.isArray(json[key])) {
      count += json[key].length;
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// Fetch user-corrected Json for an evaluated InvoiceJob.
// Returns the corrected Json object, or null if not available.
// ---------------------------------------------------------------------------
export async function fetchCorrectedJson(jobId) {
  try {
    const res = await API("GET", `InvoiceJobs?id=${jobId}&includeCorrections=1`);
    return res?._correctedJson || null;
  } catch (err) {
    console.warn("Could not load corrections, using original data:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Build the data object that InvoiceDataViewer expects.
// Accepts the raw row + an optional corrected Json override.
// ---------------------------------------------------------------------------
export function buildViewerData(row, correctedJson) {
  const jsonSource = correctedJson || row.Json;
  return {
    ...(jsonSource && typeof jsonSource === "object" ? jsonSource : {}),
    blobUrl: row.parentDocumentUrl || row.DocumentURL || null,
    companyId: row.companyId,
    id: row.id,
    createdAt: row.createdAt,
    status: row.status,
    pageNumber: row.pageNumber,
    originalTotalPages: row.originalTotalPages,
    auctionInvoice: row.auctionInvoice ?? null,
  };
}

// ---------------------------------------------------------------------------
// Status badge config — returns { icon, label, colorClass } for a given status.
// Keeps rendering in the page, but centralises the status → display mapping.
// ---------------------------------------------------------------------------
const STATUS_CONFIG = {
  completed:            { icon: "CheckCircle2", label: "Completed",  colorClass: "bg-green-100 text-green-800 border border-green-300" },
  processing:           { icon: "Clock",        label: "Processing", colorClass: "bg-blue-100 text-blue-800 border border-blue-300" },
  failed:               { icon: "AlertCircle",  label: "Failed",     colorClass: "bg-red-100 text-red-800 border border-red-300" },
  empty:                { icon: "Inbox",        label: "Empty",      colorClass: "bg-gray-100 text-gray-700 border border-gray-300" },
  needs_classification: { icon: "HelpCircle",   label: "要確認",      colorClass: "bg-amber-100 text-amber-800 border border-amber-300" },
  pending:              { icon: "Clock",        label: "Pending",    colorClass: "bg-gray-100 text-gray-700 border border-gray-300" },
};

export function getStatusConfig(status) {
  return STATUS_CONFIG[status] || STATUS_CONFIG.pending;
}

// ---------------------------------------------------------------------------
// Review button label — what should the action button say?
// Handles both invoice and cert docTypes.
// ---------------------------------------------------------------------------
export function getReviewButtonLabel(row, vehicleCount) {
  // Common statuses (all doc types)
  if (row.status === "processing") return "Processing...";
  if (row.status === "pending") return "Pending...";
  if (row.status === "needs_classification") return "Classify";

  const isInvoice = row.docType === "invoice" || !row.docType;

  if (isInvoice) {
    if (row.isEvaluated) return "Evaluated";
    if (vehicleCount === 0) return "Empty";
    return "Review";
  }

  // Cert types (export_cert, inspection_cert, temp_cancel, unknown)
  if (row.Json?.linkedVehicleId) return "Linked";
  return "View";
}

// ---------------------------------------------------------------------------
// Whether the review button should be disabled
// ---------------------------------------------------------------------------
export function isReviewDisabled(row) {
  return row.status === "processing" || row.status === "pending";
}

// ---------------------------------------------------------------------------
// Whether the action button should show the "applied" (done) style.
// Invoice: isEvaluated=true. Cert: linkedVehicleId exists.
// ---------------------------------------------------------------------------
export function isActionDone(row) {
  const isInvoice = row.docType === "invoice" || !row.docType;
  if (isInvoice) return !!row.isEvaluated;
  return !!row.Json?.linkedVehicleId;
}
