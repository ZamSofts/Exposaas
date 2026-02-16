import { useState, useEffect } from "react";
import Head from "next/head";
import { useAuth } from "@/hooks/useAuth";
import { Error, API, DataTable, InvoiceDataViewer } from "@/hooks/wrapper";
import Sidebar from "@/components/Sidebar";
import StatusBadge from "@/components/ui/StatusBadge";
import { ReceiptText, FileText, Car, RefreshCw } from "lucide-react";
import {
  getVehicleCount,
  getPageInfo,
  fetchCorrectedJson,
  buildViewerData,
  getReviewButtonLabel,
  isReviewDisabled,
} from "@/lib/invoiceJobUtils";

export default function InvoiceJobsPage() {
  const { session } = useAuth();

  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [sortBy, setSortBy] = useState("id");
  const [sortOrder, setSortOrder] = useState("desc");

  const [selected, setSelected] = useState(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [retrying, setRetrying] = useState(null);

  useEffect(() => {
    loadData();
  }, [currentPage, perPage, sortBy, sortOrder]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(perPage),
        sortBy: String(sortBy),
        sortOrder: String(sortOrder),
      });

      const res = await API("GET", `InvoiceJobs?${params}`);
      if (res.error) {
        setError(res.error);
        return;
      }

      setRows(res.data || []);
      setTotal(res.total || (res.data || []).length);
    } catch (err) {
      console.error("Error loading invoice jobs", err);
      setError("Failed to load invoice jobs");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSort = (column, order) => {
    setSortBy(column);
    setSortOrder(order);
  };

  const handlePageChange = (page, perPageValue) => {
    setCurrentPage(page);
    setPerPage(perPageValue);
  };

  const openViewer = async (row) => {
    let corrected = null;
    if (row.isEvaluated) {
      corrected = await fetchCorrectedJson(row.id);
    }
    setSelected(buildViewerData(row, corrected));
    setViewerOpen(true);
  };

  const handleBackToList = () => {
    setViewerOpen(false);
    setSelected(null);
    loadData();
  };

  const handleRetry = async (jobId) => {
    setRetrying(jobId);
    try {
      const res = await API("POST", "InvoiceJobs", { action: "retry", id: jobId });
      if (res.error) {
        setError(res.error);
      } else {
        loadData();
      }
    } catch (err) {
      console.error("Error retrying job", err);
      setError("Failed to retry job");
    } finally {
      setRetrying(null);
    }
  };

  if (viewerOpen && selected) {
    return <InvoiceDataViewer data={selected} onBack={handleBackToList} />;
  }

  return (
    <>
      <Head>
        <title>Invoice Jobs - ExpoSaaS</title>
      </Head>

      <Sidebar>
        <div className="p-8 bg-[var(--background)] min-h-screen relative">
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[var(--surface)] rounded-lg border border-[var(--border)]">
                  <ReceiptText className="w-6 h-6 text-[var(--primary)]" />
                </div>
                <h1 className="text-3xl font-bold text-[var(--foreground)]">Invoice Jobs</h1>
              </div>
            </div>
            <p className="text-[var(--secondary-foreground)]">
              List of processed invoice extraction jobs. Each page is a separate job.
            </p>
          </div>

          <Error message={error} />

          <DataTable
            data={rows}
            total={total}
            isLoading={isLoading}
            searchPlaceholder="Search InvoiceJobs..."
            onSort={handleSort}
            onPageChange={handlePageChange}
            title="Invoice Jobs"
            initialPerPage={perPage}
            sortBy={sortBy}
            sortOrder={sortOrder}
          >
            <thead className="bg-[var(--secondary)]">
              <tr>
                <th>ID</th>
                <th>Page</th>
                <th>Status</th>
                <th>Vehicles</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => {
                const vehicleCount = getVehicleCount(row.Json);
                return (
                  <tr key={row.id} className="hover:bg-[var(--input)] transition-colors duration-200">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-[var(--foreground)]">
                        #{row.id.toString().padStart(3, "0")}
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[var(--secondary-foreground)]" />
                        <span className="text-sm text-[var(--foreground)]">{getPageInfo(row)}</span>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={row.status} />
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Car className="w-4 h-4 text-[var(--secondary-foreground)]" />
                        <span className="text-sm text-[var(--foreground)]">{vehicleCount}</span>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-[var(--secondary-foreground)]">
                        {window.goodDateTime(row.createdAt)}
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
                            className={row.isEvaluated ? "applied" : "apply-button"}
                          >
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
      </Sidebar>
    </>
  );
}
