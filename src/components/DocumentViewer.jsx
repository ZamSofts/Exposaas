import { useState, useMemo } from "react";
import Head from "next/head";
import { API } from "@/hooks/wrapper";
import {
  ArrowLeft,
  FileText,
  Link2,
  CheckCircle2,
  AlertTriangle,
  Car,
  ExternalLink,
  Search,
} from "lucide-react";
import { useT } from "@/i18n/LocaleProvider";

// Field key sets per doc type — labels resolved from certFields.* via i18n
const SHARED_CERT_FIELDS = [
  "chassis_number",
  "registration_number",
  "brand",
  "engine_model",
  "first_registration_date",
  "engine_displacement",
  "vehicle_weight",
  "gross_vehicle_weight",
  "length",
  "width",
  "height",
  "m3",
];
const INSPECTION_CERT_FIELDS = [
  "chassis_number",
  "brand",
  "engine_model",
  "registration_number",
  "first_registration_date",
  "engine_displacement",
  "vehicle_weight",
  "gross_vehicle_weight",
  "length",
  "width",
  "height",
  "m3",
];

const DOC_TYPE_CONFIG = {
  export_cert:     { titleKey: "docTypes.export_cert_full",     color: "#10b981", fields: SHARED_CERT_FIELDS },
  inspection_cert: { titleKey: "docTypes.inspection_cert_full", color: "#f59e0b", fields: INSPECTION_CERT_FIELDS },
  temp_cancel:     { titleKey: "docTypes.temp_cancel_full",     color: "#8b5cf6", fields: SHARED_CERT_FIELDS },
};

/**
 * DocumentViewer — review extracted data from non-invoice documents.
 *
 * Props:
 *   data   — InvoiceJobs row object (with Json, DocumentURL, docType, etc.)
 *   onBack — callback to return to document list
 */
export default function DocumentViewer({ data, onBack }) {
  const t = useT();
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkResult, setLinkResult] = useState(null);
  const [searchChassis, setSearchChassis] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const docType = data?.docType || "unknown";
  const config = DOC_TYPE_CONFIG[docType] || null;
  const extracted = data?.Json?.extracted || {};
  const linkedVehicleId = data?.Json?.linkedVehicleId || null;
  const docTypeLabel = config ? t(config.titleKey) : t("docTypes.unknown");

  // Prefer single-page blob (DocumentURL) — split by classifyDocument worker, kept permanently.
  // Fall back to parentDocumentUrl (original multi-page PDF) with #page=N for records
  // where the split blob no longer exists (uploaded before the blob-retention fix).
  const pdfUrl = data?.DocumentURL || data?.parentDocumentUrl;
  const pdfPage = data?.pageNumber || 1;
  const isParentPdf = !data?.DocumentURL && !!data?.parentDocumentUrl;

  // Search for vehicles by chassis number
  const handleSearchVehicle = async () => {
    const chassis = searchChassis.trim() || extracted.chassis_number;
    if (!chassis) return;

    setSearchLoading(true);
    try {
      const res = await API("GET", `vehicle?search=${encodeURIComponent(chassis)}&limit=5`);
      if (res.error) {
        setSearchResults({ error: res.error });
      } else {
        setSearchResults({ vehicles: res.vehicles || [] });
      }
    } catch (err) {
      setSearchResults({ error: t("documentViewer.searchFailed") });
    } finally {
      setSearchLoading(false);
    }
  };

  // Link document to vehicle
  const handleLinkToVehicle = async (vehicleId) => {
    setLinkLoading(true);
    try {
      const res = await API("POST", "linkDocumentToVehicle", {
        invoiceJobId: data.id,
        vehicleId,
      });
      if (res.error) {
        setLinkResult({ error: res.error });
      } else {
        setLinkResult({ success: res.message });
      }
    } catch (err) {
      setLinkResult({ error: t("documentViewer.linkFailed") });
    } finally {
      setLinkLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>{t("documentViewer.title", { type: docTypeLabel })}</title>
      </Head>

      <div className="min-h-screen bg-[var(--background)]">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[var(--surface)] border-b border-[var(--border)] px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="flex items-center gap-2 px-3 py-1.5 text-[var(--secondary-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--secondary)] rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                {t("documentViewer.back")}
              </button>

              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: `${config?.color || "#6b7280"}20`,
                    color: config?.color || "#6b7280",
                    border: `1px solid ${config?.color || "#6b7280"}40`,
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: config?.color || "#6b7280" }}
                  />
                  {docTypeLabel}
                </span>
                <span className="text-sm text-[var(--secondary-foreground)]">
                  {t("documentViewer.documentLabel", { id: data?.id })}
                </span>
              </div>
            </div>

            {/* Link status */}
            {linkedVehicleId && !linkResult?.success && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 text-green-400 rounded-lg text-sm">
                <CheckCircle2 className="w-4 h-4" />
                {t("documentViewer.linkedToVehicle", { id: linkedVehicleId })}
              </span>
            )}
            {linkResult?.success && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 text-green-400 rounded-lg text-sm">
                <CheckCircle2 className="w-4 h-4" />
                {linkResult.success}
              </span>
            )}
          </div>
        </div>

        {/* Split Layout: PDF left, Data right */}
        <div className="flex h-[calc(100vh-57px)]">
          {/* Left: PDF Preview */}
          <div className="w-1/2 border-r border-[var(--border)] bg-[var(--surface)]">
            {pdfUrl ? (
              <iframe
                src={isParentPdf ? `${pdfUrl}#page=${pdfPage}&toolbar=1&navpanes=0&scrollbar=1` : `${pdfUrl}#toolbar=1&navpanes=0&scrollbar=1`}
                className="w-full h-full border-0"
                title="Document Preview"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-[var(--secondary-foreground)]">
                <div className="text-center">
                  <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p>{t("documentViewer.noUrl")}</p>
                </div>
              </div>
            )}
          </div>

          {/* Right: Extracted Data */}
          <div className="w-1/2 overflow-y-auto p-6">
            {/* Extracted Fields */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
                {t("documentViewer.extractedData")}
              </h2>

              {config?.fields ? (
                <div className="space-y-3">
                  {config.fields.map((fieldKey) => (
                    <div
                      key={fieldKey}
                      className="flex items-start gap-4 py-2 border-b border-[var(--border)] last:border-b-0"
                    >
                      <div className="w-32 flex-shrink-0">
                        <div className="text-sm font-medium text-[var(--foreground)]">
                          {t(`certFields.${fieldKey}`)}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="text-sm text-[var(--foreground)] bg-[var(--input)] px-3 py-2 rounded-lg border border-[var(--border)]">
                          {extracted[fieldKey] || (
                            <span className="text-[var(--secondary-foreground)] italic">
                              {t("documentViewer.notExtracted")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                // Unknown type — show raw JSON
                <div className="bg-[var(--input)] rounded-lg p-4 border border-[var(--border)]">
                  <pre className="text-sm text-[var(--foreground)] whitespace-pre-wrap">
                    {JSON.stringify(extracted, null, 2) || t("documentViewer.noDataExtracted")}
                  </pre>
                </div>
              )}
            </div>

            {/* Vehicle Linking Section */}
            {!linkedVehicleId && !linkResult?.success && (
              <div className="border-t border-[var(--border)] pt-6">
                <h3 className="text-md font-semibold text-[var(--foreground)] mb-3 flex items-center gap-2">
                  <Link2 className="w-4 h-4" />
                  {t("documentViewer.linkToVehicle")}
                </h3>

                {/* Auto-search by chassis */}
                {extracted.chassis_number && (
                  <div className="mb-4 p-3 bg-[var(--input)] rounded-lg border border-[var(--border)]">
                    <p className="text-sm text-[var(--secondary-foreground)] mb-2">
                      {t("documentViewer.chassisFound")}{" "}
                      <strong className="text-[var(--foreground)]">
                        {extracted.chassis_number}
                      </strong>
                    </p>
                    <button
                      onClick={handleSearchVehicle}
                      disabled={searchLoading}
                      className="flex items-center gap-2 px-3 py-1.5 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg text-sm hover:bg-[var(--primary)]/90 transition-colors disabled:opacity-50"
                    >
                      <Search className="w-3.5 h-3.5" />
                      {searchLoading ? t("documentViewer.searching") : t("documentViewer.searchVehicle")}
                    </button>
                  </div>
                )}

                {/* Manual search */}
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={searchChassis}
                    onChange={(e) => setSearchChassis(e.target.value)}
                    placeholder={t("documentViewer.searchPlaceholder")}
                    className="flex-1 px-3 py-2 text-sm bg-[var(--input)] border border-[var(--border)] rounded-lg text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)]"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSearchVehicle();
                    }}
                  />
                  <button
                    onClick={handleSearchVehicle}
                    disabled={searchLoading}
                    className="px-3 py-2 bg-[var(--secondary)] text-[var(--secondary-foreground)] rounded-lg text-sm hover:bg-[var(--border)] transition-colors disabled:opacity-50"
                  >
                    {t("documentViewer.search")}
                  </button>
                </div>

                {/* Search Results */}
                {searchResults && (
                  <div className="space-y-2">
                    {searchResults.error ? (
                      <p className="text-sm text-red-400">{searchResults.error}</p>
                    ) : searchResults.vehicles?.length === 0 ? (
                      <p className="text-sm text-[var(--secondary-foreground)]">
                        {t("documentViewer.noVehiclesFound")}
                      </p>
                    ) : (
                      searchResults.vehicles?.map((v) => (
                        <div
                          key={v.id}
                          className="flex items-center justify-between p-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <Car className="w-4 h-4 text-[var(--secondary-foreground)]" />
                            <div>
                              <div className="text-sm font-medium text-[var(--foreground)]">
                                #{v.id} — {v.chassisNumber}
                              </div>
                              <div className="text-xs text-[var(--secondary-foreground)]">
                                {v.brand?.name || ""} {v.name || ""}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleLinkToVehicle(v.id)}
                            disabled={linkLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded text-sm transition-colors disabled:opacity-50"
                          >
                            <Link2 className="w-3.5 h-3.5" />
                            {linkLoading ? t("documentViewer.linking") : t("documentViewer.linkButton")}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {linkResult?.error && (
                  <p className="text-sm text-red-400 mt-2">{linkResult.error}</p>
                )}
              </div>
            )}

            {/* Open PDF in new tab */}
            {pdfUrl && (
              <div className="border-t border-[var(--border)] pt-4 mt-6">
                <button
                  onClick={() => window.open(pdfUrl, "_blank")}
                  className="flex items-center gap-2 text-sm text-[var(--secondary-foreground)] hover:text-[var(--foreground)] transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  {t("documentViewer.openInNewTab")}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
