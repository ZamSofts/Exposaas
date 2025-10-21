import { useState, useEffect, useRef } from "react";
import Head from "next/head";
import { useAuth, Error, API, Toast, Loader, FilePreviewer } from "@/hooks/wrapper";
import Sidebar from "@/components/Sidebar";
import DataTable from "@/components/ui/DataTable";
import { UserCheck } from "lucide-react";

export default function PaymentConfirmation() {
  const { session } = useAuth();

  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [customLoader, setCustomLoader] = useState(false);
  const [toast, setToast] = useState({ id: 0, message: "", type: "success" });

  // Pagination and search states
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(5);
  const [search, setSearch] = useState("");

  // Sorting state
  const [sortBy, setSortBy] = useState("id");
  const [sortOrder, setSortOrder] = useState("asc");

  // Load confirmations and extract unconfirmed charges
  const [unconfirmedCharges, setUnconfirmedCharges] = useState([]);

  const [loadingIds, setLoadingIds] = useState([]);
  const [confirmedIds, setConfirmedIds] = useState([]);

  useEffect(() => {
    loadConfirmations();
  }, [currentPage, perPage, sortBy, sortOrder, search]);

  const showToast = (message, type = "success") => {
    setToast({ id: Date.now(), message, type });
  };

  const loadConfirmations = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: perPage.toString(),
        sortBy: sortBy.toString(),
        search: search.toString(),
        sortOrder: sortOrder.toString(),
      });
      const res = await API("GET", `paymentConfirmation?${params}`);
      if (res.error) {
        setError(res.error);
        setIsLoading(false);
        return;
      }
      const rows = res.data;
      setUnconfirmedCharges(rows);
      setTotal(res.total || rows.length);
    } catch (err) {
      console.error("Error loading confirmations", err);
      setError("Failed to load confirmations");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSort = (column, order) => {
    setSortBy(column);
    setSortOrder(order);
  };

  const handleSearch = value => {
    setSearch(value);
    setCurrentPage(1);
  };

  const handlePageChange = (page, perPageValue) => {
    setCurrentPage(page);
    setPerPage(perPageValue);
  };
  const handleConfirmation = async item => {
    setLoadingIds(prev => [...prev, item.id]);
    try {
      const checkChassis = await API("GET", `vehicle?chassisNumber=${item.chassis_number}`);
      if (checkChassis.error) {
        showToast(checkChassis.error, "error");
        setLoadingIds(prev => prev.filter(id => id !== item.id));
        return;
      } else {
        const formData = new FormData();
        formData.append("name", item.type);
        formData.append("amount", -item.amount);
        formData.append("date", item.createdAt);
        formData.append("vehicleId", checkChassis.id);
        formData.append("docURL", item.DocumentURL);

        const res = await API("PUT", "vehiclePayments", formData, true);
        if (res.error) {
          showToast(res.error, "error");
          setLoadingIds(prev => prev.filter(id => id !== item.id));
          return;
        }

        const parts = String(item.id).split("_");
        const confirmationId = Number(parts[0]);
        const chargeIndex = Number(parts[parts.length - 1]);
        const chassis_number = parts[parts.length - 2];
        const pageKey = parts.slice(1, parts.length - 2).join("_");

        const patchBody = { id: confirmationId, markConfirmed: true, pageKey, chassis_number, chargeIndex };
        const updatejson = await API("PATCH", "paymentConfirmation", patchBody);
        if (!updatejson || updatejson.error) {
          showToast("Error occurred while updating confirmation", "error");
          setLoadingIds(prev => prev.filter(id => id !== item.id));
          return;
        }
        setConfirmedIds(prev => [...prev, item.id]);
        showToast("Charge confirmed successfully", "success");
        loadConfirmations();
      }
    } catch (err) {
      console.error("Error confirming charge", err);
      showToast("Failed to confirm charge", "error");
    } finally {
      setLoadingIds(prev => prev.filter(id => id !== item.id));
    }
  };

  return (
    <>
      <Head>
        <title>Payment Confirmations - ExpoSaaS</title>
      </Head>

      <Sidebar>
        <div className="p-8 bg-[var(--background)] min-h-screen relative">
          {customLoader && <Loader />}

          {/* Header Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[var(--surface)] rounded-lg border border-[var(--border)]">
                  <UserCheck className="w-6 h-6 text-[var(--primary)]" />
                </div>
                <h1 className="text-3xl font-bold text-[var(--foreground)]">Unconfirmed Charges</h1>
              </div>
            </div>
            <p className="text-[var(--secondary-foreground)]">Review charges extracted from uploaded invoices and confirm them.</p>
          </div>

          <Error message={error} />
          {customLoader && <Loader />}

          {/* DataTable: Unconfirmed Charges */}
          <DataTable
            data={unconfirmedCharges}
            total={total}
            isLoading={isLoading}
            searchPlaceholder="Search Charges..."
            onSearch={handleSearch}
            onSort={handleSort}
            onPageChange={handlePageChange}
            title="Unconfirmed Charges"
            initialPerPage={perPage}
            sortBy={sortBy}
            sortOrder={sortOrder}
          >
            <thead className="bg-[var(--secondary)]">
              <tr>
                <th>Chassis</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Page</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {unconfirmedCharges.map(item => (
                <tr key={item.id} className="hover:bg-[var(--input)] transition-colors duration-200">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-[var(--foreground)]">{item.chassis_number}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-[var(--foreground)]">{item.type}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-[var(--foreground)]">{item.amount ?? "-"}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-[var(--foreground)]">{item.Page}</div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-[var(--secondary-foreground)]">{new Date(item.createdAt).toLocaleString()}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap ">
                    <button onClick={() => handleConfirmation(item)} className="apply-button" disabled={loadingIds.includes(item.id) || confirmedIds.includes(item.id)}>
                      {loadingIds.includes(item.id) ? "Processing..." : confirmedIds.includes(item.id) ? "Confirmed" : "Mark Confirmed"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </div>
      </Sidebar>

      <Toast id={toast.id} type={toast.type} message={toast.message} onClose={() => setToast({ id: 0, message: "", type: "success" })} />
    </>
  );
}
