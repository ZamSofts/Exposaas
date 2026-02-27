import { useState, useCallback, useMemo } from "react";
import Head from "next/head";
import { useAuth, useConfirm, API, Error, DataTable, isAllowed, Toast, Loader, EditVehicle, FilePreviewer, usePaginatedList, useStaticOptions, queryKeys } from "@/hooks/wrapper";
import { useQueryClient } from "@tanstack/react-query";
import Sidebar from "@/components/Sidebar";
import { Plus, Search, Filter } from "lucide-react";
import VehicleRow from "@/components/VehicleRow";
import VehicleFilters from "@/components/VehicleFilters";
import { VEHICLE_COLUMNS } from "@/config/vehicleColumns";

export default function VehiclesPage() {
  const { session } = useAuth(["view:vehicle"], ["Sadmin"]);
  const canEditCharges = isAllowed(["edit:vehicle"], session);

  const { confirm, ConfirmComponent } = useConfirm();
  const queryClient = useQueryClient();

  // ── Filter state (lives outside usePaginatedList) ──
  const [filters, setFilters] = useState([]);
  const [conjunction, setConjunction] = useState("and");
  const [showFilters, setShowFilters] = useState(false);

  // Filter is "active" when it has field + operator + value (or isEmpty/isNotEmpty which need no value)
  const isFilterActive = (f) =>
    f.field && f.operator && (["isEmpty", "isNotEmpty"].includes(f.operator) || (f.value !== "" && f.value != null));
  const activeFilterCount = filters.filter(isFilterActive).length;

  // ── Build extra params (filters) ──
  const buildParams = useCallback(
    (urlParams) => {
      const activeFilters = filters.filter(isFilterActive);
      if (activeFilters.length > 0) {
        urlParams.set(
          "filters",
          JSON.stringify({
            conjunction,
            conditions: activeFilters.map((f) => ({
              field_name: f.field,
              operator: f.operator,
              value: f.value,
            })),
          })
        );
      }
    },
    [filters, conjunction]
  );

  // Custom queryKey includes filters + conjunction so changes trigger refetch
  const vehicleKeyFn = useCallback(
    (params) => ["vehicles", { ...params, filters, conjunction }],
    [filters, conjunction]
  );

  // ── Data fetching (React Query) ──
  const {
    items: vehicles, total, isLoading, error: listError,
    handleSort, handleSearch, handlePageChange, sortBy, sortOrder, setPage,
  } = usePaginatedList(vehicleKeyFn, "vehicle", {
    defaultPerPage: 25,
    defaultOrder: "desc",
    debounceMs: 400,
    buildParams,
    select: (res) => ({
      items: res.vehicles || [],
      total: res.total || 0,
    }),
  });

  // ── Static options (React Query — cached indefinitely) ──
  const brandOptions = useStaticOptions(
    queryKeys.brands(),
    "brand",
    (data) => {
      if (!data || data.error) return [];
      return (Array.isArray(data) ? data : []).map((b) => ({ value: b.id, label: b.name }));
    }
  );

  const customerOptions = useStaticOptions(
    queryKeys.customerOptions(),
    "customer?col=id,name,uniqueId",
    (data) => {
      if (!data || data.error) return [];
      return (Array.isArray(data) ? data : []).map((c) => ({ value: c.id, label: `${c.name}-${c.uniqueId}` }));
    }
  );

  const suggestions = useStaticOptions(
    queryKeys.suggestions("auction,transportCompany,deliverTo,documentStatus"),
    "vehicleSuggestions?fields=auction,transportCompany,deliverTo,documentStatus",
    (data) => {
      if (!data || data.error) return {};
      return data;
    }
  );

  // ── Local UI state ──
  const [error, setError] = useState("");
  const [customLoader, setCustomLoader] = useState(false);
  const [edit, setEdit] = useState(null);
  const [documentPreview, setDocumentPreview] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [toast, setToast] = useState({ id: 0, message: "", type: "success" });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["vehicles"] });

  // Memoize dropdown options object so VehicleRow memo isn't broken
  const dropdownOpts = useMemo(() => ({ brandOptions, customerOptions }), [brandOptions, customerOptions]);

  // Build combobox options from suggestions (memoized per field)
  const comboOpts = useCallback(
    (field) => (suggestions[field] || []).map((v) => ({ value: v, label: v })),
    [suggestions]
  );

  const showToast = useCallback((message, type = "success") => {
    setToast({ id: Date.now(), message, type });
  }, []);

  // ── Inline editing: optimistic update via queryClient cache ──
  const handleInlineSave = useCallback(
    (vehicleId, updatedVehicle) => {
      // Optimistically update the React Query cache
      queryClient.setQueriesData({ queryKey: ["vehicles"] }, (old) => {
        if (!old || !old.vehicles) return old;
        return {
          ...old,
          vehicles: old.vehicles.map((v) =>
            v.id === vehicleId ? { ...v, ...updatedVehicle } : v
          ),
        };
      });
      showToast("Updated", "success");
    },
    [queryClient, showToast]
  );

  const handleInlineError = useCallback(
    (msg) => {
      showToast(msg || "Failed to update", "error");
    },
    [showToast]
  );

  // ── Filter change handler ──
  const handleFiltersChange = useCallback((newFilters) => {
    setFilters(newFilters);
    setPage(1);
  }, [setPage]);

  // ── Delete vehicle ──
  const deleteIt = async (id) => {
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
    invalidate();
  };

  // ── View management ──
  const handleAddVehicle = () => {
    setEdit(0);
  };

  const handleEditVehicle = useCallback((vehicleId) => {
    setEdit(vehicleId);
  }, []);

  const handleBackToList = () => {
    setEdit(null);
    invalidate();
  };

  const handleFormSuccess = () => {
    handleBackToList();
  };

  if (edit !== null) {
    return <EditVehicle vehicleId={edit} onBack={handleBackToList} onSuccess={handleFormSuccess} />;
  }

  return (
    <>
      <Head>
        <title>Vehicles Management - ExpoSaaS</title>
      </Head>
      <Sidebar>
        <div className="p-2 bg-[var(--background)] min-h-screen">
          <Error message={listError || error} />
          {customLoader && <Loader />}

          {/* Spreadsheet Toolbar */}
          <div className="flex flex-wrap items-center justify-between px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] border-b-0">
            <h2 className="text-sm font-semibold text-[var(--foreground)]">Vehicles ({isLoading ? "..." : total})</h2>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--secondary-foreground)]" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSearch(searchInput);
                  }}
                  className="pl-7 pr-2 py-1 text-xs bg-[var(--input)] border border-[var(--border)] rounded
                             text-[var(--foreground)] placeholder-[var(--secondary-foreground)]
                             focus:outline-none focus:border-[var(--primary)] w-48"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-1 px-2 py-1 text-xs font-medium border rounded transition-colors
                  ${
                    activeFilterCount > 0 ? "bg-[var(--primary)] text-white border-[var(--primary)]" : "bg-[var(--secondary)] text-[var(--foreground)] border-[var(--border)] hover:bg-[var(--border)]"
                  }`}
              >
                <Filter className="w-3.5 h-3.5" />
                Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
              </button>
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
                    return (
                      <th key={col.id} id={col.id} style={{ width: col.width }}>
                        {col.label}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v) => (
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
      {documentPreview && <FilePreviewer url={documentPreview.url} fileName={documentPreview.fileName} isOpen={true} onClose={() => setDocumentPreview(null)} trigger={null} />}

      <ConfirmComponent />
      <Toast id={toast.id} type={toast.type} message={toast.message} onClose={() => setToast({ id: 0, message: "", type: "success" })} />
    </>
  );
}
