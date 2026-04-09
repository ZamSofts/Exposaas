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

// Doc type labels
const DOC_TYPE_CONFIG = {
  export_cert: {
    labelJa: "輸出抹消",
    labelEn: "Export Cancellation Certificate",
    color: "#10b981",
    fields: [
      { key: "chassis_number", label: "車台番号", labelEn: "Chassis Number" },
      { key: "registration_number", label: "登録番号", labelEn: "Registration Number" },
      { key: "brand", label: "車名", labelEn: "Brand" },
      { key: "engine_model", label: "原動機の型式", labelEn: "Engine Model" },
      { key: "first_registration_date", label: "初度登録年月", labelEn: "First Registration" },
      { key: "engine_displacement", label: "排気量", labelEn: "Displacement (cc)" },
      { key: "vehicle_weight", label: "車両重量", labelEn: "Vehicle Weight (kg)" },
      { key: "gross_vehicle_weight", label: "車両総重量", labelEn: "Gross Weight (kg)" },
      { key: "length", label: "長さ", labelEn: "Length (cm)" },
      { key: "width", label: "幅", labelEn: "Width (cm)" },
      { key: "height", label: "高さ", labelEn: "Height (cm)" },
      { key: "m3", label: "M3", labelEn: "Cubic Meters" },
    ],
  },
  inspection_cert: {
    labelJa: "車検証",
    labelEn: "Vehicle Inspection Certificate",
    color: "#f59e0b",
    fields: [
      { key: "chassis_number", label: "車台番号", labelEn: "Chassis Number" },
      { key: "brand", label: "車名", labelEn: "Brand" },
      { key: "engine_model", label: "原動機の型式", labelEn: "Engine Model" },
      { key: "registration_number", label: "登録番号", labelEn: "Registration Number" },
      { key: "first_registration_date", label: "初度登録", labelEn: "First Registration" },
      { key: "engine_displacement", label: "排気量", labelEn: "Displacement (cc)" },
      { key: "vehicle_weight", label: "車両重量", labelEn: "Vehicle Weight (kg)" },
      { key: "gross_vehicle_weight", label: "車両総重量", labelEn: "Gross Weight (kg)" },
      { key: "length", label: "長さ", labelEn: "Length (cm)" },
      { key: "width", label: "幅", labelEn: "Width (cm)" },
      { key: "height", label: "高さ", labelEn: "Height (cm)" },
      { key: "m3", label: "M3", labelEn: "Cubic Meters" },
    ],
  },
  temp_cancel: {
    labelJa: "一時抹消",
    labelEn: "Temporary Cancellation Certificate",
    color: "#8b5cf6",
    fields: [
      { key: "chassis_number", label: "車台番号", labelEn: "Chassis Number" },
      { key: "registration_number", label: "登録番号", labelEn: "Registration Number" },
      { key: "brand", label: "車名", labelEn: "Brand" },
      { key: "engine_model", label: "原動機の型式", labelEn: "Engine Model" },
      { key: "first_registration_date", label: "初度登録年月", labelEn: "First Registration" },
      { key: "engine_displacement", label: "排気量", labelEn: "Displacement (cc)" },
      { key: "vehicle_weight", label: "車両重量", labelEn: "Vehicle Weight (kg)" },
      { key: "gross_vehicle_weight", label: "車両総重量", labelEn: "Gross Weight (kg)" },
      { key: "length", label: "長さ", labelEn: "Length (cm)" },
      { key: "width", label: "幅", labelEn: "Width (cm)" },
      { key: "height", label: "高さ", labelEn: "Height (cm)" },
      { key: "m3", label: "M3", labelEn: "Cubic Meters" },
    ],
  },
};

/**
 * DocumentViewer — review extracted data from non-invoice documents.
 *
 * Props:
 *   data   — InvoiceJobs row object (with Json, DocumentURL, docType, etc.)
 *   onBack — callback to return to document list
 */
export default function DocumentViewer({ data, onBack }) {
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkResult, setLinkResult] = useState(null);
  const [searchChassis, setSearchChassis] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const docType = data?.docType || "unknown";
  const config = DOC_TYPE_CONFIG[docType] || null;
  const extracted = data?.Json?.extracted || {};
  const linkedVehicleId = data?.Json?.linkedVehicleId || null;

  // Prefer single-page blob (DocumentURL); fall back to original multi-page PDF
  const pdfUrl = data?.DocumentURL || data?.parentDocumentUrl;
  const pdfPage = data?.pageNumber || 1;
  // If using the multi-page parent PDF, jump to the correct page
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
      setSearchResults({ error: "Search failed" });
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
      setLinkResult({ error: "Failed to link document" });
    } finally {
      setLinkLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>
          {config?.labelJa || "Document"} Review - ExpoSaaS
        </title>
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
                Back
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
                  {config?.labelJa || "Unknown"}
                </span>
                <span className="text-sm text-[var(--secondary-foreground)]">
                  Document #{data?.id}
                </span>
              </div>
            </div>

            {/* Link status */}
            {linkedVehicleId && !linkResult?.success && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 text-green-400 rounded-lg text-sm">
                <CheckCircle2 className="w-4 h-4" />
                Linked to Vehicle #{linkedVehicleId}
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
                  <p>No document URL available</p>
                </div>
              </div>
            )}
          </div>

          {/* Right: Extracted Data */}
          <div className="w-1/2 overflow-y-auto p-6">
            {/* Extracted Fields */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
                Extracted Data
              </h2>

              {config?.fields ? (
                <div className="space-y-3">
                  {config.fields.map((field) => (
                    <div
                      key={field.key}
                      className="flex items-start gap-4 py-2 border-b border-[var(--border)] last:border-b-0"
                    >
                      <div className="w-32 flex-shrink-0">
                        <div className="text-sm font-medium text-[var(--foreground)]">
                          {field.label}
                        </div>
                        <div className="text-xs text-[var(--secondary-foreground)]">
                          {field.labelEn}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="text-sm text-[var(--foreground)] bg-[var(--input)] px-3 py-2 rounded-lg border border-[var(--border)]">
                          {extracted[field.key] || (
                            <span className="text-[var(--secondary-foreground)] italic">
                              Not extracted
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
                    {JSON.stringify(extracted, null, 2) || "No data extracted"}
                  </pre>
                </div>
              )}
            </div>

            {/* Vehicle Linking Section */}
            {!linkedVehicleId && !linkResult?.success && (
              <div className="border-t border-[var(--border)] pt-6">
                <h3 className="text-md font-semibold text-[var(--foreground)] mb-3 flex items-center gap-2">
                  <Link2 className="w-4 h-4" />
                  Link to Vehicle
                </h3>

                {/* Auto-search by chassis */}
                {extracted.chassis_number && (
                  <div className="mb-4 p-3 bg-[var(--input)] rounded-lg border border-[var(--border)]">
                    <p className="text-sm text-[var(--secondary-foreground)] mb-2">
                      Chassis number found:{" "}
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
                      {searchLoading ? "Searching..." : "Search Vehicle"}
                    </button>
                  </div>
                )}

                {/* Manual search */}
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={searchChassis}
                    onChange={(e) => setSearchChassis(e.target.value)}
                    placeholder="Search by chassis number..."
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
                    Search
                  </button>
                </div>

                {/* Search Results */}
                {searchResults && (
                  <div className="space-y-2">
                    {searchResults.error ? (
                      <p className="text-sm text-red-400">{searchResults.error}</p>
                    ) : searchResults.vehicles?.length === 0 ? (
                      <p className="text-sm text-[var(--secondary-foreground)]">
                        No vehicles found. The vehicle may not be registered yet.
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
                            {linkLoading ? "Linking..." : "Link"}
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
                  Open PDF in new tab
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
