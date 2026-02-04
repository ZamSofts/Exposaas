import { useState, useEffect } from "react";
import Head from "next/head";
import { useAuth } from "@/hooks/useAuth";
import Error from "@/components/ui/Error";
import { API } from "@/lib/api";
import { InvoiceDataViewer } from "@/components/InvoiceDataViewer";
import Sidebar from "@/components/Sidebar";
import DataTable from "@/components/ui/DataTable";
import { ReceiptText, CheckCircle2, Clock, AlertCircle, FileText, Car, Inbox, RefreshCw } from "lucide-react";

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

  const openViewer = row => {
    // Pass row data for single-page view
    const data = {
      ...(row.Json && typeof row.Json === "object" ? row.Json : {}),
      blobUrl: row.DocumentURL || null,
      companyId: row.companyId,
      id: row.id,
      createdAt: row.createdAt,
      status: row.status,
      pageNumber: row.pageNumber,
      originalTotalPages: row.originalTotalPages,
    };
    setSelected(data);
    setViewerOpen(true);
  };

  // Helper to get vehicle count from Json
  const getVehicleCount = (json) => {
    if (!json) return 0;
    // New format: { items: [...] }
    if (Array.isArray(json.items)) return json.items.length;
    // Legacy format: { page_1: [...], page_2: [...] }
    let count = 0;
    for (const key of Object.keys(json)) {
      if (key.startsWith('page_') && Array.isArray(json[key])) {
        count += json[key].length;
      }
    }
    return count;
  };

  // Helper to get status badge
  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs"><CheckCircle2 className="w-3 h-3" /> Completed</span>;
      case 'processing':
        return <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs"><Clock className="w-3 h-3" /> Processing</span>;
      case 'failed':
        return <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs"><AlertCircle className="w-3 h-3" /> Failed</span>;
      case 'empty':
        return <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-500/20 text-gray-400 rounded text-xs"><Inbox className="w-3 h-3" /> Empty</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-500/20 text-gray-400 rounded text-xs"><Clock className="w-3 h-3" /> Pending</span>;
    }
  };

  // Helper to get page info
  const getPageInfo = (row) => {
    if (row.pageNumber && row.originalTotalPages) {
      return `Page ${row.pageNumber} of ${row.originalTotalPages}`;
    }
    // Legacy job (before per-page architecture)
    if (row.totalPages) {
      return `${row.totalPages} pages (legacy)`;
    }
    return "Single";
  };

  const handleBackToList = () => {
    setViewerOpen(false);
    setSelected(null);
    loadData();
  };

  const [retrying, setRetrying] = useState(null);

  const handleRetry = async (jobId) => {
    setRetrying(jobId);
    try {
      const res = await API("POST", "InvoiceJobs", { action: "retry", id: jobId });
      if (res.error) {
        setError(res.error);
      } else {
        // Reload data to show updated status
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
            <p className="text-[var(--secondary-foreground)]">List of processed invoice extraction jobs. Each page is a separate job.</p>
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
              {rows.map(row => {
                const vehicleCount = getVehicleCount(row.Json);
                return (
                  <tr key={row.id} className="hover:bg-[var(--input)] transition-colors duration-200">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-[var(--foreground)]">#{row.id.toString().padStart(3, "0")}</div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[var(--secondary-foreground)]" />
                        <span className="text-sm text-[var(--foreground)]">{getPageInfo(row)}</span>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(row.status)}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Car className="w-4 h-4 text-[var(--secondary-foreground)]" />
                        <span className="text-sm text-[var(--foreground)]">{vehicleCount}</span>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-[var(--secondary-foreground)]">{window.goodDateTime(row.createdAt)}</div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {row.status === 'failed' ? (
                          <button
                            onClick={() => handleRetry(row.id)}
                            disabled={retrying === row.id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded text-sm transition-colors"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${retrying === row.id ? 'animate-spin' : ''}`} />
                            {retrying === row.id ? "Retrying..." : "Retry"}
                          </button>
                        ) : (
                          <button
                            onClick={() => openViewer(row)}
                            disabled={row.status === 'processing' || row.status === 'pending'}
                            className={row.isEvaluated ? "applied" : "apply-button"}
                          >
                            {row.isEvaluated ? "Evaluated" : row.status === 'processing' ? "Processing..." : row.status === 'pending' ? "Pending..." : vehicleCount === 0 ? "Empty" : "Review"}
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
