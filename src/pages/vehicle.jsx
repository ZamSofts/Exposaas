import { useState, useCallback, useMemo } from "react";
import Head from "next/head";
import { useAuth, useConfirm, API, Error, DataTable, isAllowed, Toast, Loader, EditVehicle, FilePreviewer, usePaginatedList, useStaticOptions, queryKeys } from "@/hooks/wrapper";
import { useQueryClient } from "@tanstack/react-query";
import Sidebar from "@/components/Sidebar";
import { Plus, Search, Filter, Columns2 } from "lucide-react";
import VehicleRow from "@/components/VehicleRow";
import VehicleFilters from "@/components/VehicleFilters";
import ExportDropdown from "@/components/export/ExportDropdown";
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
    defaultPerPage: 50,
    defaultOrder: "desc",
    debounceMs: 400,
    staleTime: 5 * 60 * 1000,
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
      return (Array.isArray(data) ? data : []).map((c) => ({
        value: c.id,
        label: /^(CSV-|auto-)/.test(c.uniqueId || "") ? c.name : `${c.name}-${c.uniqueId}`,
      }));
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

  // ── Export templates (cached) ──
  const exportTemplates = useStaticOptions(
    queryKeys.exportTemplates(),
    "exportTemplate",
    (data) => {
      if (!data || data.error) return [];
      return data.templates || [];
    }
  );

  // ── Local UI state ──
  const [customLoader, setCustomLoader] = useState(false);
  const [edit, setEdit] = useState(null);
  const [documentPreview, setDocumentPreview] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [toast, setToast] = useState({ id: 0, message: "", type: "success" });
  const [mergeInfoVehicle, setMergeInfoVehicle] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  // ── Column visibility ──
  const [visibleColIds, setVisibleColIds] = useState(
    () => new Set(VEHICLE_COLUMNS.map((c) => c.id))
  );
  const [showColPicker, setShowColPicker] = useState(false);

  // ── Visible columns memo — used by both <colgroup> and <thead> to stay in sync ──
  const visibleCols = useMemo(
    () => VEHICLE_COLUMNS.filter((col) =>
      col.type === "actions" ? isAllowed(col.requirePermission, session) : visibleColIds.has(col.id)
    ),
    [visibleColIds, session]
  );

  const totalTableWidth = useMemo(
    () => visibleCols.reduce((sum, col) => sum + col.width, 0),
    [visibleCols]
  );

  const toggleCol = (colId) => {
    setVisibleColIds((prev) => {
      const next = new Set(prev);
      if (next.has(colId)) next.delete(colId);
      else next.add(colId);
      return next;
    });
  };

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

  // ── Inline editing: update cache with server-confirmed data ──
  const handleInlineSave = useCallback(
    (vehicleId, updatedVehicle) => {
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

  // ── Export handler ──
  const handleExport = useCallback(async (templateId, exportFilename) => {
    setIsExporting(true);
    try {
      const activeFilters = filters.filter(isFilterActive);
      const payload = {
        templateId,
        filename: exportFilename || undefined,
        search: searchInput.trim() || undefined,
        sortBy,
        sortOrder,
      };
      if (activeFilters.length > 0) {
        payload.filters = {
          conjunction,
          conditions: activeFilters.map((f) => ({
            field_name: f.field,
            operator: f.operator,
            value: f.value,
          })),
        };
      }

      const response = await fetch("/api/vehicleExport", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Export failed");
      }

      // Download the file
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match ? decodeURIComponent(match[1]) : "export.xlsx";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast("エクスポート完了", "success");
    } catch (err) {
      showToast(err.message || "エクスポートに失敗しました", "error");
    } finally {
      setIsExporting(false);
    }
  }, [filters, conjunction, searchInput, sortBy, sortOrder, showToast]);

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
          <Error message={listError} />
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
              <div className="relative">
                <button
                  onClick={() => setShowColPicker(!showColPicker)}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium border rounded transition-colors bg-[var(--secondary)] text-[var(--foreground)] border-[var(--border)] hover:bg-[var(--border)]"
                >
                  <Columns2 className="w-3.5 h-3.5" />
                  列を表示
                </button>
                {showColPicker && (
                  <div className="absolute right-0 top-full mt-1 z-50 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg p-2 w-44 max-h-72 overflow-y-auto">
                    {VEHICLE_COLUMNS.filter((c) => c.type !== "actions").map((col) => (
                      <label
                        key={col.id}
                        className="flex items-center gap-2 px-2 py-1 hover:bg-[var(--secondary)] rounded cursor-pointer text-xs text-[var(--foreground)]"
                      >
                        <input
                          type="checkbox"
                          checked={visibleColIds.has(col.id)}
                          onChange={() => toggleCol(col.id)}
                          className="accent-[var(--primary)]"
                        />
                        {col.label || col.id}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <ExportDropdown
                templates={exportTemplates}
                onExport={handleExport}
                isExporting={isExporting}
              />
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
              initialPerPage={50}
              tableWidth={totalTableWidth}
            >
              {/* colgroup で列幅を固定 — table-layout:fixed と組み合わせることで
                  スクロール中も幅が変わらない（Google Sheets / LarkBase と同じ仕組み） */}
              <colgroup>
                {visibleCols.map((col) => (
                  <col key={col.id} style={{ width: col.width }} />
                ))}
              </colgroup>
              <thead className="bg-[var(--secondary)]">
                <tr>
                  {visibleCols.map((col) => (
                    <th key={col.id} id={col.id}>{col.label}</th>
                  ))}
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
                    onShowMergeInfo={setMergeInfoVehicle}
                    session={session}
                    visibleColIds={visibleColIds}
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

      {/* Merge Info Popup */}
      {mergeInfoVehicle && (
        <MergeInfoPopup vehicle={mergeInfoVehicle} onClose={() => setMergeInfoVehicle(null)} />
      )}
    </>
  );
}

// ── Merge Info Popup ──

const MERGE_FIELD_LABELS = {
  chassisNumber: "車台番号", lotNumber: "ロット番号", auction: "オークション",
  auctionDate: "オークション日", brandId: "ブランド", customerId: "顧客",
  name: "名前", remarks: "備考", bidAmount: "落札額", auctionFee: "オークション手数料",
  insuranceFee: "保険料", recyclingFee: "リサイクル料", transportFee: "輸送費",
  otherFees: "その他費用", taxSum: "消費税", totalCost: "合計",
  session: "セッション", transportCompany: "輸送会社", deliverTo: "納車先",
  numberPlate: "ナンバープレート", titleTransferDeadline: "名義変更期限",
  containerNumber: "コンテナ番号", etd: "ETD", documentStatus: "書類状況",
  memo: "メモ", length: "長さ", width: "幅", height: "高さ", m3: "m³",
  sourceInvoiceJobId: "請求書ジョブ",
};

function MergeInfoPopup({ vehicle, onClose }) {
  const merged = vehicle.mergedFields;
  if (!merged) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-xl p-5 w-80 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h4 className="text-sm font-semibold text-[var(--foreground)] mb-3">統合情報</h4>

        <div className="text-xs space-y-2 text-[var(--secondary-foreground)]">
          <div className="flex justify-between">
            <span>統合日</span>
            <span className="text-[var(--foreground)]">{new Date(vehicle.mergedAt).toLocaleDateString()}</span>
          </div>
          {vehicle.mergedFromId && (
            <div className="flex justify-between">
              <span>元車両ID</span>
              <span className="text-[var(--foreground)]">#{vehicle.mergedFromId}</span>
            </div>
          )}
          {merged.absorbedChassisNumber && (
            <div className="flex justify-between">
              <span>元車台番号</span>
              <span className="text-[var(--foreground)] font-mono">{merged.absorbedChassisNumber}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>費用ソース</span>
            <span className="text-[var(--foreground)]">{merged.chargeSource === "invoice" ? "請求書" : "CSV"}</span>
          </div>

          {merged.fieldsChanged?.length > 0 && (
            <div className="pt-2 border-t border-[var(--border)]">
              <p className="mb-1 font-medium text-[var(--foreground)]">変更フィールド:</p>
              <div className="flex flex-wrap gap-1">
                {merged.fieldsChanged.map((f) => (
                  <span key={f} className="px-1.5 py-0.5 bg-[var(--input)] rounded text-[10px]">
                    {MERGE_FIELD_LABELS[f] || f}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-3 pt-2 border-t border-[var(--border)]">
          <p className="text-xs text-amber-500 font-medium">費用を確認してください</p>
        </div>

        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-[var(--secondary-foreground)] hover:text-[var(--foreground)] text-lg leading-none"
        >
          &times;
        </button>
      </div>
    </div>
  );
}
