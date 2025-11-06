import { useState, useEffect } from "react";
import Head from "next/head";
import { useAuth, Error, API, InvoiceDataViewer } from "@/hooks/wrapper";
import Sidebar from "@/components/Sidebar";
import DataTable from "@/components/ui/DataTable";
import { ReceiptText } from "lucide-react";

export default function InvoiceJobsPage() {
  const { session } = useAuth();

  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(5);
  const [sortBy, setSortBy] = useState("id");
  const [sortOrder, setSortOrder] = useState("desc");

  const [selected, setSelected] = useState(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  useEffect(() => {
     loadData();
  }, [currentPage, perPage, sortBy, sortOrder]);

  const  loadData = async () => {
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
    const data = {
      ...(row.Json && typeof row.Json === "object" ? row.Json : {}),
      blobUrl: row.DocumentURL || null,
      companyId: row.companyId,
      id: row.id,
      createdAt: row.createdAt,
    };
    setSelected(data);
    setViewerOpen(true);
  };

  const handleBackToList = () => {
    setViewerOpen(false);
    setSelected(null);
    loadData();
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
            <p className="text-[var(--secondary-foreground)]">List of processed invoice extraction jobs.</p>
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
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {rows.map(row => (
                <tr key={row.id} className="hover:bg-[var(--input)] transition-colors duration-200">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-[var(--foreground)]">#{row.id.toString().padStart(3, "0")}</div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-[var(--secondary-foreground)]">{window.goodDateTime(row.createdAt)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap ">
                    <button onClick={() => openViewer(row)} disabled={row.isEvaluated} className={row.isEvaluated ? "applied" : "apply-button"}>
                     {row.isEvaluated ? "Evaluated" : "Review Job"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </div>
      </Sidebar>
    </>
  );
}
