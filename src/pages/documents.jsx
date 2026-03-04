import { useState, useRef, useCallback } from "react";
import Head from "next/head";
import { useAuth } from "@/hooks/useAuth";
import { Error, API, DataTable, usePaginatedList, queryKeys } from "@/hooks/wrapper";
import { useQueryClient } from "@tanstack/react-query";
import useFileUpload from "@/hooks/useFileUpload";
import FileUploadModal from "@/components/ui/FileUploadModal";
import DocumentViewer from "@/components/DocumentViewer";
import Sidebar from "@/components/Sidebar";
import GmailSettings from "@/components/GmailSettings";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  FileText,
  Car,
  RefreshCw,
  Upload,
  Link2,
  Eye,
} from "lucide-react";
import {
  getVehicleCount,
  fetchCorrectedJson,
  buildViewerData,
  getReviewButtonLabel,
  isReviewDisabled,
  isActionDone,
} from "@/lib/invoiceJobUtils";
import { InvoiceDataViewer } from "@/hooks/wrapper";

// Doc type configuration (mirrors classificationSchema.mjs for UI)
const DOC_TYPES = {
  all:             { label: "All",         labelJa: "すべて",   color: null },
  invoice:         { label: "Invoice",     labelJa: "請求書",   color: "#3b82f6" },
  export_cert:     { label: "Export Cert", labelJa: "輸出抹消", color: "#10b981" },
  inspection_cert: { label: "Inspection",  labelJa: "車検証",   color: "#f59e0b" },
  temp_cancel:     { label: "Temp Cancel", labelJa: "一時抹消", color: "#8b5cf6" },
  unknown:         { label: "Unknown",     labelJa: "不明",     color: "#6b7280" },
};

// ---------------------------------------------------------------------------
// DocTypeBadge — small pill showing the document type
// ---------------------------------------------------------------------------
function DocTypeBadge({ docType }) {
  const config = DOC_TYPES[docType] || DOC_TYPES.unknown;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{
        backgroundColor: `${config.color}20`,
        color: config.color,
        border: `1px solid ${config.color}40`,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: config.color }}
      />
      {config.labelJa}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function DocumentsPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  // Filter by docType tab
  const [activeTab, setActiveTab] = useState("all");

  // ── Data fetching (React Query) ──
  const buildDocParams = useCallback((urlParams) => {
    if (activeTab !== "all") {
      urlParams.set("docType", activeTab);
    }
  }, [activeTab]);

  // Custom key includes activeTab so tab changes trigger refetch
  const docKeyFn = useCallback(
    (params) => ["documents", { ...params, docType: activeTab }],
    [activeTab]
  );

  const {
    items: rows, total, isLoading, error: listError,
    handleSort, handlePageChange, sortBy, sortOrder, setPage,
  } = usePaginatedList(docKeyFn, "InvoiceJobs", {
    defaultPerPage: 10,
    defaultOrder: "desc",
    buildParams: buildDocParams,
    select: (res) => ({
      items: res.data || [],
      total: res.total || (res.data || []).length,
    }),
  });

  const [error, setError] = useState("");

  // Upload modal
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const uploadModalRef = useRef(null);

  // Viewer state
  const [viewerData, setViewerData] = useState(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  // Retry state
  const [retrying, setRetrying] = useState(null);

  // File upload hook (accepts PDF and CSV)
  const docUpload = useFileUpload({
    endpoint: "addDocument",
    method: "PUT",
    validExtensions: ["pdf", "csv"],
    validMimeTypes: ["application/pdf", "application/x-pdf", "text/csv", "application/vnd.ms-excel"],
    fileLabel: "PDF / CSV",
    multiple: true,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["documents"] });

  const handleUploadSuccess = () => {
    setUploadModalOpen(false);
    docUpload.reset();
    setTimeout(() => invalidate(), 1000);
  };

  const handleUploadError = (err) => {
    setError(typeof err === "string" ? err : err?.message || "Upload failed");
  };

  // -----------------------------------------------------------------------
  // Open viewer — for invoices, loads corrected data when available
  // -----------------------------------------------------------------------
  const openViewer = async (row) => {
    const isInvoice = row.docType === "invoice" || !row.docType;

    if (isInvoice && row.isEvaluated) {
      const corrected = await fetchCorrectedJson(row.id);
      if (corrected) {
        setViewerData({ ...row, _correctedJson: corrected });
        setViewerOpen(true);
        return;
      }
    }

    setViewerData(row);
    setViewerOpen(true);
  };

  const handleBackToList = () => {
    setViewerOpen(false);
    setViewerData(null);
    invalidate();
  };

  const handleRetry = async (jobId) => {
    setRetrying(jobId);
    try {
      const res = await API("POST", "InvoiceJobs", { action: "retry", id: jobId });
      if (res.error) {
        setError(res.error);
      } else {
        invalidate();
      }
    } catch (err) {
      setError("Failed to retry job");
    } finally {
      setRetrying(null);
    }
  };

  const [retryingAll, setRetryingAll] = useState(false);

  const handleRetryAllFailed = async () => {
    setRetryingAll(true);
    try {
      const res = await API("POST", "InvoiceJobs", { action: "retryAllFailed" });
      if (res.error) {
        setError(res.error);
      } else {
        invalidate();
      }
    } catch (err) {
      setError("Failed to retry jobs");
    } finally {
      setRetryingAll(false);
    }
  };

  const hasFailedJobs = rows.some((r) => r.status === "failed");

  // Get vehicle link info from Json (for non-invoice docs)
  const getLinkedInfo = (row) => {
    const json = row.Json;
    if (!json?.linkedVehicleId) return null;
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-400">
        <Link2 className="w-3 h-3" />#{json.linkedVehicleId}
      </span>
    );
  };

  // ---------------------------------------------------------------------------
  // Viewer rendering
  // ---------------------------------------------------------------------------
  if (viewerOpen && viewerData) {
    const isInvoice = viewerData.docType === "invoice" || !viewerData.docType;

    if (isInvoice) {
      const data = buildViewerData(viewerData, viewerData._correctedJson);
      return <InvoiceDataViewer data={data} onBack={handleBackToList} />;
    }

    return <DocumentViewer data={viewerData} onBack={handleBackToList} />;
  }

  // ---------------------------------------------------------------------------
  // Table rendering
  // ---------------------------------------------------------------------------
  return (
    <>
      <Head>
        <title>Documents - ExpoSaaS</title>
      </Head>

      <Sidebar>
        <div className="p-8 bg-[var(--background)] min-h-screen relative">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[var(--surface)] rounded-lg border border-[var(--border)]">
                  <FileText className="w-6 h-6 text-[var(--primary)]" />
                </div>
                <h1 className="text-3xl font-bold text-[var(--foreground)]">Documents</h1>
              </div>

              <div className="flex items-center gap-2">
                {hasFailedJobs && (
                  <button
                    onClick={handleRetryAllFailed}
                    disabled={retryingAll}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded-lg transition-colors text-sm"
                  >
                    <RefreshCw className={`w-4 h-4 ${retryingAll ? "animate-spin" : ""}`} />
                    {retryingAll ? "Retrying..." : "Retry All Failed"}
                  </button>
                )}
                <button
                  onClick={() => setUploadModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg hover:bg-[var(--primary)]/90 transition-colors shadow-sm"
                >
                  <Upload className="w-4 h-4" />
                  Upload File
                </button>
              </div>
            </div>
            <p className="text-[var(--secondary-foreground)]">
              Upload PDFs or CSVs — invoices, export certs, inspection certs, vehicle data, and more.
              Files are auto-classified and processed.
            </p>
          </div>

          {/* Gmail Auto-Import Settings */}
          <GmailSettings />

          <Error message={listError || error} />

          {/* Doc Type Tabs */}
          <div className="flex gap-1 mb-6 bg-[var(--surface)] rounded-lg p-1 border border-[var(--border)] w-fit">
            {Object.entries(DOC_TYPES).map(([key, config]) => (
              <button
                key={key}
                onClick={() => { setActiveTab(key); setPage(1); }}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeTab === key
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm"
                    : "text-[var(--secondary-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--secondary)]"
                }`}
              >
                {config.color && (
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-1.5"
                    style={{ backgroundColor: config.color }}
                  />
                )}
                {config.labelJa}
              </button>
            ))}
          </div>

          {/* Data Table */}
          <DataTable
            key={activeTab}
            data={rows}
            total={total}
            isLoading={isLoading}
            searchPlaceholder="Search documents..."
            onSort={handleSort}
            onPageChange={handlePageChange}
            title="Documents"
            initialPerPage={10}
            sortBy={sortBy}
            sortOrder={sortOrder}
          >
            <thead className="bg-[var(--secondary)]">
              <tr>
                <th>ID</th>
                <th>Type</th>
                <th>Status</th>
                <th>Info</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => {
                const isInvoice = row.docType === "invoice" || !row.docType;
                const vehicleCount = isInvoice ? getVehicleCount(row.Json) : 0;
                const linkedInfo = !isInvoice ? getLinkedInfo(row) : null;

                return (
                  <tr key={row.id} className="hover:bg-[var(--input)] transition-colors duration-200">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-[var(--foreground)]">
                        #{row.id.toString().padStart(3, "0")}
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <DocTypeBadge docType={row.docType || "invoice"} />
                    </td>

                    <td className="px-6 py-4">
                      <StatusBadge status={row.status} />
                      {row.status === "failed" && row.Json?.error && (
                        <p
                          className="text-xs text-red-400/80 mt-1 max-w-[200px] truncate"
                          title={typeof row.Json.error === "string" ? row.Json.error : JSON.stringify(row.Json.error)}
                        >
                          {typeof row.Json.error === "string" ? row.Json.error : "See details"}
                        </p>
                      )}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      {isInvoice ? (
                        <div className="flex items-center gap-2">
                          <Car className="w-4 h-4 text-[var(--secondary-foreground)]" />
                          <span className="text-sm text-[var(--foreground)]">{vehicleCount} vehicles</span>
                        </div>
                      ) : linkedInfo ? (
                        linkedInfo
                      ) : (
                        <span className="text-sm text-[var(--secondary-foreground)]">
                          {row.Json?.extracted?.chassis_number || "—"}
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-[var(--secondary-foreground)]">
                        {window.goodDateTime?.(row.createdAt) || new Date(row.createdAt).toLocaleDateString()}
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {row.status === "failed" ? (
                          <button
                            onClick={() => handleRetry(row.id)}
                            disabled={retrying === row.id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded text-sm transition-colors"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${retrying === row.id ? "animate-spin" : ""}`} />
                            {retrying === row.id ? "Retrying..." : "Retry"}
                          </button>
                        ) : (
                          <button
                            onClick={() => openViewer(row)}
                            disabled={isReviewDisabled(row)}
                            className={
                              isActionDone(row)
                                ? "applied"
                                : "inline-flex items-center gap-1 px-3 py-1.5 bg-[var(--primary)]/20 hover:bg-[var(--primary)]/30 text-[var(--primary)] rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            }
                          >
                            <Eye className="w-3.5 h-3.5" />
                            {getReviewButtonLabel(row, vehicleCount)}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        </div>

        {/* Upload Modal */}
        <FileUploadModal
          isOpen={uploadModalOpen}
          label="Upload PDF or CSV"
          accept=".pdf,.csv"
          multiple
          file={docUpload.file}
          files={docUpload.files}
          progress={docUpload.progress}
          error={docUpload.error}
          onFileChange={docUpload.validate}
          onUpload={() =>
            docUpload.upload({
              onSuccess: handleUploadSuccess,
              onError: handleUploadError,
            })
          }
          onCancel={() => {
            setUploadModalOpen(false);
            docUpload.reset();
          }}
          modalRef={uploadModalRef}
        />
      </Sidebar>
    </>
  );
}
