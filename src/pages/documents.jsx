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
import { useConfirm } from "@/components/ui/ConfirmModal";
import {
  FileText,
  Car,
  RefreshCw,
  Upload,
  Link2,
  Eye,
  Mail,
} from "lucide-react";
import {
  getVehicleCount,
  fetchCorrectedJson,
  buildViewerData,
  isActionDone,
} from "@/lib/invoiceJobUtils";
import { InvoiceDataViewer } from "@/hooks/wrapper";
import { useT } from "@/i18n/LocaleProvider";

function getErrorMessageKey(error) {
  if (!error) return null;
  const code = error?.code || error?.status;
  if (code === 429) return "documents.errors.rateLimit";
  if (code === 400) return "documents.errors.badFormat";
  if (code === 500) return "documents.errors.serverError";
  return "documents.errors.generic";
}

// Doc type colour configuration. Labels resolved via i18n at render time.
const DOC_TYPE_STYLES = {
  all:             { dotColor: null,      bg: null,        text: null,        border: null },
  invoice:         { dotColor: "#2563eb", bg: "#dbeafe",   text: "#1e40af",   border: "#93c5fd" },
  export_cert:     { dotColor: "#059669", bg: "#d1fae5",   text: "#065f46",   border: "#6ee7b7" },
  inspection_cert: { dotColor: "#d97706", bg: "#fef3c7",   text: "#92400e",   border: "#fcd34d" },
  temp_cancel:     { dotColor: "#7c3aed", bg: "#ede9fe",   text: "#4c1d95",   border: "#c4b5fd" },
  unknown:         { dotColor: "#6b7280", bg: "#f3f4f6",   text: "#374151",   border: "#d1d5db" },
  skipped:         { dotColor: "#ea580c", bg: "#ffedd5",   text: "#9a3412",   border: "#fdba74" },
};
const DOC_TYPE_KEYS = Object.keys(DOC_TYPE_STYLES);

// ---------------------------------------------------------------------------
// DocTypeBadge — small pill showing the document type
// ---------------------------------------------------------------------------
function DocTypeBadge({ docType }) {
  const t = useT();
  const styles = DOC_TYPE_STYLES[docType] || DOC_TYPE_STYLES.unknown;
  const labelKey = DOC_TYPE_STYLES[docType] ? `docTypes.${docType}` : "docTypes.unknown";
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{
        backgroundColor: styles.bg,
        color: styles.text,
        border: `1px solid ${styles.border}`,
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: styles.dotColor }} />
      {t(labelKey)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function DocumentsPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const t = useT();

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

  // Skipped emails — separate fetch from /api/gmail/skipped
  const {
    items: skippedRows, total: skippedTotal, isLoading: skippedLoading,
    handlePageChange: skippedPageChange, setPage: setSkippedPage,
  } = usePaginatedList(
    useCallback((params) => ["skipped-emails", params], []),
    "gmail/skipped",
    {
      defaultPerPage: 10,
      defaultOrder: "desc",
      select: (res) => ({
        items: res.data || [],
        total: res.total || 0,
      }),
    }
  );

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
    setError(typeof err === "string" ? err : err?.message || t("documents.uploadFailed"));
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
      setError(t("documents.retryFailed"));
    } finally {
      setRetrying(null);
    }
  };

  const [retryingAll, setRetryingAll] = useState(false);
  const { confirm, ConfirmComponent } = useConfirm();

  const failedCount = rows.filter((r) => r.status === "failed").length;
  const hasFailedJobs = failedCount > 0;

  const handleRetryAllFailed = async () => {
    const ok = await confirm({
      title: t("documents.retryAllConfirmTitle"),
      message: t("documents.retryAllConfirmMessage", { count: failedCount }),
      type: "warning",
    });
    if (!ok) return;

    setRetryingAll(true);
    try {
      const res = await API("POST", "InvoiceJobs", { action: "retryAllFailed" });
      if (res.error) {
        setError(res.error);
      } else {
        invalidate();
      }
    } catch (err) {
      setError(t("documents.retryAllFailedError"));
    } finally {
      setRetryingAll(false);
    }
  };

  // Reclassify a skipped email
  const [reclassifying, setReclassifying] = useState(null);
  const handleReclassify = async (emailMessageId) => {
    setReclassifying(emailMessageId);
    try {
      const res = await API("POST", "gmail/skipped", { action: "reclassify", emailMessageId });
      if (res.error) setError(res.error);
      else queryClient.invalidateQueries({ queryKey: ["skipped-emails"] });
    } catch (err) {
      setError(t("documents.reclassifyFailed"));
    } finally {
      setReclassifying(null);
    }
  };

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
        <title>{t("pageTitles.documents")}</title>
      </Head>

      <Sidebar>
        <div className="p-6 bg-[var(--background)] min-h-screen relative">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[var(--surface)] rounded-lg border border-[var(--border)]">
                  <FileText className="w-6 h-6 text-[var(--primary)]" />
                </div>
                <h1 className="text-3xl font-bold text-[var(--foreground)]">{t("documents.header")}</h1>
              </div>

              <div className="flex items-center gap-2">
                {hasFailedJobs && (
                  <button
                    onClick={handleRetryAllFailed}
                    disabled={retryingAll}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-100 hover:bg-orange-200 text-orange-800 border border-orange-300 rounded-lg transition-colors text-sm"
                  >
                    <RefreshCw className={`w-4 h-4 ${retryingAll ? "animate-spin" : ""}`} />
                    {retryingAll ? t("documents.retryingAll") : t("documents.retryAllFailed")}
                  </button>
                )}
                <button
                  onClick={() => setUploadModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg hover:bg-[var(--primary)]/90 transition-colors shadow-sm"
                >
                  <Upload className="w-4 h-4" />
                  {t("documents.uploadButton")}
                </button>
              </div>
            </div>
            <p className="text-[var(--secondary-foreground)]">
              {t("documents.subtitle")}
            </p>
          </div>

          {/* Gmail Auto-Import Settings */}
          <GmailSettings />

          <Error message={listError || error} />

          {/* Pending count banner */}
          {activeTab !== "skipped" && (() => {
            const pendingCount = rows.filter(r => r.status === "pending" || r.status === "processing").length;
            if (pendingCount === 0) return null;
            return (
              <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-600 rounded-lg p-3 text-sm font-medium">
                {t("documents.pendingBanner", { count: pendingCount })}
              </div>
            );
          })()}

          {/* Doc Type Tabs */}
          <div className="flex gap-1 mb-6 bg-[var(--surface)] rounded-lg p-1 border border-[var(--border)] w-fit">
            {DOC_TYPE_KEYS.map((key) => {
              const styles = DOC_TYPE_STYLES[key];
              return (
                <button
                  key={key}
                  onClick={() => { setActiveTab(key); setPage(1); setSkippedPage(1); }}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    activeTab === key
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm"
                      : "text-[var(--secondary-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--secondary)]"
                  }`}
                >
                  {styles.dotColor && (
                    <span
                      className="inline-block w-2 h-2 rounded-full mr-1.5"
                      style={{ backgroundColor: styles.dotColor }}
                    />
                  )}
                  {t(`docTypes.${key}`)}
                </button>
              );
            })}
          </div>

          {/* Data Table — skipped emails tab uses a different endpoint */}
          {activeTab === "skipped" ? (
            <DataTable
              key="skipped"
              data={skippedRows}
              total={skippedTotal}
              isLoading={skippedLoading}
              onPageChange={skippedPageChange}
              title={t("documents.skipped.title")}
              initialPerPage={10}
            >
              <thead className="bg-[var(--secondary)]">
                <tr>
                  <th>{t("documents.skipped.date")}</th>
                  <th>{t("documents.skipped.from")}</th>
                  <th>{t("documents.skipped.subject")}</th>
                  <th>{t("documents.skipped.reason")}</th>
                  <th>{t("documents.skipped.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {skippedRows.map((row) => (
                  <tr key={row.id} className="hover:bg-[var(--input)] transition-colors duration-200">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-[var(--secondary-foreground)]">
                        {row.receivedAt ? new Date(row.receivedAt).toLocaleDateString() : "—"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-sm text-[var(--foreground)]">
                        <Mail className="w-3.5 h-3.5 text-[var(--secondary-foreground)]" />
                        {row.fromAddress || "—"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-[var(--foreground)] max-w-[240px] truncate" title={row.subject}>
                        {row.subject || "—"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs text-[var(--secondary-foreground)] max-w-[180px] truncate" title={row.skipReason}>
                        {row.skipReason || "—"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {row.attachmentUrl && (
                          <button
                            onClick={() => {
                              setViewerData({ parentDocumentUrl: row.attachmentUrl, docType: "unknown" });
                              setViewerOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-[var(--primary)]/20 hover:bg-[var(--primary)]/30 text-[var(--primary)] rounded text-sm transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            {t("documents.skipped.view")}
                          </button>
                        )}
                        <button
                          onClick={() => handleReclassify(row.id)}
                          disabled={reclassifying === row.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded text-sm transition-colors"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${reclassifying === row.id ? "animate-spin" : ""}`} />
                          {reclassifying === row.id ? t("documents.skipped.reclassifying") : t("documents.skipped.reclassify")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          ) : (
            <DataTable
              key={activeTab}
              data={rows}
              total={total}
              isLoading={isLoading}
              searchPlaceholder={t("dataTable.search")}
              onSort={handleSort}
              onPageChange={handlePageChange}
              title={t("documents.title")}
              initialPerPage={10}
              sortBy={sortBy}
              sortOrder={sortOrder}
            >
              <thead className="bg-[var(--secondary)]">
                <tr>
                  <th>{t("documents.table.id")}</th>
                  <th>{t("documents.table.type")}</th>
                  <th>{t("documents.table.status")}</th>
                  <th>{t("documents.table.info")}</th>
                  <th>{t("documents.table.createdAt")}</th>
                  <th>{t("documents.table.actions")}</th>
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

                      <td className="px-6 py-4 whitespace-nowrap">
                        <span title={row.status === "failed" && row.Json?.error ? t(getErrorMessageKey(row.Json.error)) : undefined}>
                          <StatusBadge status={row.status} />
                        </span>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        {isInvoice ? (
                          <div className="flex items-center gap-2">
                            <Car className="w-4 h-4 text-[var(--secondary-foreground)]" />
                            <span className="text-sm text-[var(--foreground)]">{t("documents.table.vehiclesCount", { count: vehicleCount })}</span>
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
                              {retrying === row.id ? t("documents.retrying") : t("documents.retry")}
                            </button>
                          ) : isActionDone(row) ? (
                            <div className="flex items-center gap-1.5">
                              <span className="px-2 py-0.5 bg-[var(--success)]/10 text-[var(--success)] rounded-full text-[11px] font-medium border border-[var(--success)]/20">{t("status.confirmed")}</span>
                              <button
                                onClick={() => openViewer(row)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-[var(--secondary)] hover:bg-[var(--border)] text-[var(--secondary-foreground)] rounded text-[11px] transition-colors"
                              >
                                <Eye className="w-3 h-3" />
                                PDF
                              </button>
                            </div>
                          ) : row.status === "completed" ? (
                            <button
                              onClick={() => openViewer(row)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-[var(--primary)]/20 hover:bg-[var(--primary)]/30 text-[var(--primary)] rounded text-sm transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              {t("documents.review")}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          )}
        </div>

        {/* Confirm Dialog */}
        <ConfirmComponent />

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
