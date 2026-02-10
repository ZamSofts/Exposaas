import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Head from "next/head";
import { useAuth, useConfirm, API, Error, DataTable, isAllowed, Toast, Loader, EditVehicle, FilePreviewer } from "@/hooks/wrapper";
import Sidebar from "@/components/Sidebar";
import { Plus, FileUp, Search, Filter } from "lucide-react";
import useFileUpload from "@/hooks/useFileUpload";
import FileUploadModal from "@/components/ui/FileUploadModal";
import VehicleRow from "@/components/VehicleRow";
import VehicleFilters from "@/components/VehicleFilters";
import { VEHICLE_COLUMNS } from "@/config/vehicleColumns";

export default function VehiclesPage() {
  const { session, status } = useAuth(["view:vehicle"], ["Sadmin"]);
  const { confirm, ConfirmComponent } = useConfirm();

  const [vehicles, setVehicles] = useState([]);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [customLoader, setCustomLoader] = useState(false);
  const [invoiceFileModal, setInvoiceFileModal] = useState(false);
  const [csvFileModal, setCsvFileModal] = useState(false);

  const csvUpload = useFileUpload({
    endpoint: "addVehicle", method: "POST",
    validExtensions: ["csv"], validMimeTypes: ["text/csv", "application/vnd.ms-excel"],
    fileLabel: "CSV",
  });
  const invoiceUpload = useFileUpload({
    endpoint: "addInvoice", method: "PUT",
    validExtensions: ["pdf"], validMimeTypes: ["application/pdf"],
    fileLabel: "Invoice",
  });

  const [edit, setEdit] = useState(null);
  const [currentView, setCurrentView] = useState("list");
  const [documentPreview, setDocumentPreview] = useState(null);

  // Dropdown / combobox options for inline editing
  const [brandOptions, setBrandOptions] = useState([]);
  const [customerOptions, setCustomerOptions] = useState([]);
  const [suggestions, setSuggestions] = useState({});

  // Memoize dropdown options object so VehicleRow memo isn't broken
  const dropdownOpts = useMemo(() => ({ brandOptions, customerOptions }), [brandOptions, customerOptions]);

  // Modal refs for click outside
  const csvModalRef = useRef(null);

  // Pagination and search states
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [sortBy, setSortBy] = useState("id");
  const [sortOrder, setSortOrder] = useState("desc");

  // Filter state
  const [filters, setFilters] = useState([]);
  const [conjunction, setConjunction] = useState("and");
  const [showFilters, setShowFilters] = useState(false);
  const filterTimeoutRef = useRef(null);

  // Toast state
  const [toast, setToast] = useState({ id: 0, message: "", type: "success" });

  useEffect(() => {
    clearTimeout(filterTimeoutRef.current);
    filterTimeoutRef.current = setTimeout(() => {
      loadData();
    }, filters.length > 0 ? 400 : 0);
    return () => clearTimeout(filterTimeoutRef.current);
  }, [currentPage, perPage, search, sortBy, sortOrder, filters, conjunction]);

  // Load dropdown options for inline editing and filter dropdowns
  useEffect(() => {
    if (!session) return;
    const loadOptions = async () => {
      const [brandData, customerData, suggestionsData] = await Promise.all([
        API("GET", "brand"),
        API("GET", "customer?col=id,name,uniqueId"),
        API("GET", "vehicleSuggestions?fields=auction,transportCompany,deliverTo,documentStatus"),
      ]);
      if (!brandData.error) {
        setBrandOptions(brandData.map(b => ({ value: b.id, label: b.name })));
      }
      if (!customerData.error) {
        setCustomerOptions(customerData.map(c => ({ value: c.id, label: `${c.name}-${c.uniqueId}` })));
      }
      if (!suggestionsData.error) {
        setSuggestions(suggestionsData);
      }
    };
    loadOptions();
  }, [session]);

  // Handle click outside modal to close
  useEffect(() => {
    const handleClickOutside = event => {
      if (csvModalRef.current && !csvModalRef.current.contains(event.target)) {
        resetForm();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const showToast = useCallback((message, type = "success") => {
    setToast({ id: Date.now(), message, type });
  }, []);

  // Inline charge editing
  const canEditCharges = isAllowed(["edit:vehicle"], session);

  const handleInlineSave = useCallback((vehicleId, updatedVehicle) => {
    setVehicles(prev => prev.map(v => (v.id === vehicleId ? { ...v, ...updatedVehicle } : v)));
    showToast("Updated", "success");
  }, [showToast]);

  const handleInlineError = useCallback(msg => {
    showToast(msg || "Failed to update", "error");
  }, [showToast]);

  // Build combobox options from suggestions (memoized per field)
  const comboOpts = useCallback((field) =>
    (suggestions[field] || []).map(v => ({ value: v, label: v })),
  [suggestions]);

  // Filter is "active" when it has field + operator + value (or isEmpty/isNotEmpty which need no value)
  const isFilterActive = (f) =>
    f.field && f.operator &&
    (["isEmpty", "isNotEmpty"].includes(f.operator) || (f.value !== "" && f.value != null));

  const activeFilterCount = filters.filter(isFilterActive).length;

  const loadData = async () => {
    setIsLoading(true);
    setError("");
    const params = new URLSearchParams({
      page: currentPage,
      limit: perPage,
      search,
      sortBy,
      sortOrder,
    });

    const activeFilters = filters.filter(isFilterActive);
    if (activeFilters.length > 0) {
      params.set("filters", JSON.stringify({
        conjunction,
        conditions: activeFilters.map(f => ({
          field_name: f.field,
          operator: f.operator,
          value: f.value,
        })),
      }));
    }

    const data = await API("GET", `vehicle?${params}`);
    if (data.error) {
      setError(data.error);
      setIsLoading(false);
      return;
    }
    setVehicles(data.vehicles || []);
    setTotal(data.total || 0);
    setIsLoading(false);
  };

  const handleSort = (column, order) => {
    setSortBy(column);
    setSortOrder(order);
  };

  const handleSearch = value => {
    setSearch(value);
    setCurrentPage(1);
  };

  const handleFiltersChange = useCallback((newFilters) => {
    setFilters(newFilters);
    setCurrentPage(1);
  }, []);

  const handlePageChange = (page, perPageValue) => {
    setCurrentPage(page);
    setPerPage(perPageValue);
  };

  const handleUploadSuccess = (response, modalCloser) => {
    showToast(response.message, "success");
    modalCloser(false);
    setError("");
    loadData();
  };

  const handleUploadError = (msg) => {
    setError(msg);
    showToast(msg, "error");
  };

  const deleteIt = async id => {
    const confirmed = await confirm({
      title: "Delete Vehicle",
      message: "Are you sure you want to delete this vehicle? This will also permanently delete all associated documents and Payments. This action cannot be undone.",
      confirmText: "Delete",
      type: "danger",
    });
    if (!confirmed) return;

    setCustomLoader(true);
    const data = await API("DELETE", `vehicle?id=${id}`);
    if (data.error) {
      setError(data.error);
      showToast(data.error, "error");
      setCustomLoader(false);
      return;
    }

    setCustomLoader(false);
    const documentsDeletedText = data.documentsDeleted > 0 ? ` ${data.documentsDeleted} associated document(s) were also removed.` : "";
    showToast(`Vehicle deleted successfully!${documentsDeletedText}`, "success");
    loadData();
  };

  const resetForm = () => {
    setError("");
    setEdit(null);
    csvUpload.reset();
    invoiceUpload.reset();
    setCsvFileModal(false);
    setCustomLoader(false);
    setInvoiceFileModal(false);
  };

  // View management functions
  const handleAddVehicle = () => {
    setEdit(0); // 0 for new vehicle
    setCurrentView("form");
  };

  const handleEditVehicle = useCallback(vehicleId => {
    setEdit(vehicleId);
    setCurrentView("form");
  }, []);

  const handleBackToList = () => {
    setCurrentView("list");
    setEdit(null);
    loadData(); // Refresh the list
  };

  const handleFormSuccess = () => {
    handleBackToList();
  };

  // If we're in form view, render the VehicleForm component
  if (currentView === "form") {
    return <EditVehicle vehicleId={edit} onBack={handleBackToList} onSuccess={handleFormSuccess} />;
  }

  return (
    <>
      <Head>
        <title>Vehicles Management - ExpoSaaS</title>
      </Head>
      <Sidebar>
        <div className="p-2 bg-[var(--background)] min-h-screen">
          {/* Upload Modals */}
          <FileUploadModal
            isOpen={csvFileModal}
            label="Upload CSV File"
            accept=".csv"
            file={csvUpload.file}
            progress={csvUpload.progress}
            error={csvUpload.error || error}
            onFileChange={csvUpload.validate}
            onUpload={() => csvUpload.upload({ onSuccess: (r) => handleUploadSuccess(r, setCsvFileModal), onError: handleUploadError })}
            onCancel={resetForm}
            modalRef={csvModalRef}
          />
          <FileUploadModal
            isOpen={invoiceFileModal}
            label="Upload Invoice File"
            accept=".pdf"
            file={invoiceUpload.file}
            progress={invoiceUpload.progress}
            error={invoiceUpload.error || error}
            onFileChange={invoiceUpload.validate}
            onUpload={() => invoiceUpload.upload({ onSuccess: (r) => handleUploadSuccess(r, setInvoiceFileModal), onError: handleUploadError })}
            onCancel={resetForm}
          />

          <Error message={error} />
          {customLoader && <Loader />}

          {/* Spreadsheet Toolbar */}
          <div className="flex flex-wrap items-center justify-between px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] border-b-0">
            <h2 className="text-sm font-semibold text-[var(--foreground)]">
              Vehicles ({isLoading ? "..." : total})
            </h2>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--secondary-foreground)]" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSearch(searchInput); }}
                  className="pl-7 pr-2 py-1 text-xs bg-[var(--input)] border border-[var(--border)] rounded
                             text-[var(--foreground)] placeholder-[var(--secondary-foreground)]
                             focus:outline-none focus:border-[var(--primary)] w-48"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-1 px-2 py-1 text-xs font-medium border rounded transition-colors
                  ${activeFilterCount > 0
                    ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                    : "bg-[var(--secondary)] text-[var(--foreground)] border-[var(--border)] hover:bg-[var(--border)]"
                  }`}
              >
                <Filter className="w-3.5 h-3.5" />
                Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
              </button>
              {isAllowed(["add:csv"], session) && (
                <>
                  <button
                    onClick={() => setInvoiceFileModal(true)}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium
                               bg-[var(--secondary)] text-[var(--foreground)] border border-[var(--border)]
                               rounded hover:bg-[var(--border)] transition-colors"
                  >
                    <FileUp className="w-3.5 h-3.5" /> Invoice
                  </button>
                  <button
                    onClick={() => setCsvFileModal(true)}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium
                               bg-[var(--secondary)] text-[var(--foreground)] border border-[var(--border)]
                               rounded hover:bg-[var(--border)] transition-colors"
                  >
                    <FileUp className="w-3.5 h-3.5" /> CSV
                  </button>
                </>
              )}
              {isAllowed(["add:vehicle"], session) && (
                <button
                  onClick={handleAddVehicle}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium
                             bg-[var(--primary)] text-white rounded hover:bg-[var(--primary-hover)]
                             transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              )}
            </div>
          </div>

          {/* Filter panel */}
          {showFilters && (
            <VehicleFilters
              filters={filters}
              conjunction={conjunction}
              onFiltersChange={handleFiltersChange}
              onConjunctionChange={setConjunction}
              brandOptions={brandOptions}
              customerOptions={customerOptions}
              suggestions={suggestions}
            />
          )}

          <div>
            <DataTable
              data={vehicles}
              total={total}
              isLoading={isLoading}
              showSearch={false}
              onSort={handleSort}
              onPageChange={handlePageChange}
              sortBy={sortBy}
              sortOrder={sortOrder}
              variant="spreadsheet"
            >
              <thead className="bg-[var(--secondary)]">
                <tr>
                  {VEHICLE_COLUMNS.map((col) => {
                    if (col.type === "actions" && !isAllowed(col.requirePermission, session)) return null;
                    return <th key={col.id} id={col.id} style={{ width: col.width }}>{col.label}</th>;
                  })}
                </tr>
              </thead>
              <tbody>
                {vehicles.map(v => (
                  <VehicleRow
                    key={v.id}
                    vehicle={v}
                    canEdit={canEditCharges}
                    dropdownOptions={dropdownOpts}
                    comboOpts={comboOpts}
                    onInlineSave={handleInlineSave}
                    onInlineError={handleInlineError}
                    onEdit={handleEditVehicle}
                    onDelete={deleteIt}
                    setDocumentPreview={setDocumentPreview}
                    session={session}
                  />
                ))}
              </tbody>
            </DataTable>
          </div>
        </div>
      </Sidebar>
            {documentPreview && (
              <FilePreviewer url={documentPreview.url} fileName={documentPreview.fileName} isOpen={true} onClose={() => setDocumentPreview(null)} trigger={null} />
            )}

            <ConfirmComponent />
      <Toast id={toast.id} type={toast.type} message={toast.message} onClose={() => setToast({ id: 0, message: "", type: "success" })} />
    </>
  );
}
