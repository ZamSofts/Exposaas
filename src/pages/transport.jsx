import { useState, useEffect, useCallback, useMemo } from "react";
import Head from "next/head";
import { Truck, AlertTriangle, CheckCircle2, X, Search, PackageCheck, FileText } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import { useAuth } from "@/hooks/useAuth";
import { TRANSPORT_COMPANIES } from "@/config/transportCompanies";

// 依頼書作成モーダル：車両チェック済み → 業者選択 → 印刷ページへ
function PrintOrderModal({ vehicles, onClose }) {
  const [company, setCompany] = useState("");
  const [requester, setRequester] = useState("");
  const [orderDate, setOrderDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  });

  const handlePrint = () => {
    if (!company) { alert("陸送業者を選択してください"); return; }
    const params = new URLSearchParams();
    params.set("company",   company);
    params.set("requester", requester);
    params.set("orderDate", orderDate);
    params.set("ids",       vehicles.map(v => v.id).join(","));
    window.open(`/transport/print?${params}`, "_blank");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-[var(--surface)] rounded-xl shadow-xl border border-[var(--border)] w-full max-w-md mx-4 p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-[var(--foreground)]">陸送依頼書の作成</h2>
            <p className="text-sm text-[var(--muted-foreground)]">{vehicles.length}台 選択中</p>
          </div>
          <button onClick={onClose} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"><X size={20} /></button>
        </div>

        {/* 選択車両プレビュー */}
        <div className="mb-4 max-h-36 overflow-y-auto rounded-lg border border-[var(--border)] divide-y divide-[var(--border)]">
          {vehicles.map(v => (
            <div key={v.id} className="px-3 py-1.5 text-xs text-[var(--foreground)] flex justify-between">
              <span className="font-mono">{v.chassisNumber}</span>
              <span className="text-[var(--muted-foreground)]">{v.auction ?? "—"}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* 陸送業者 */}
          <div className="col-span-2">
            <label className="text-xs text-[var(--muted-foreground)] mb-1 block">陸送業者 <span className="text-[var(--error)]">*</span></label>
            <input
              list="print-companies-list"
              value={company}
              onChange={e => setCompany(e.target.value)}
              placeholder="業者名を選択または入力"
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] text-sm"
            />
            <datalist id="print-companies-list">
              {TRANSPORT_COMPANIES.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>

          {/* 依頼者 */}
          <div>
            <label className="text-xs text-[var(--muted-foreground)] mb-1 block">依頼者</label>
            <input
              type="text"
              value={requester}
              onChange={e => setRequester(e.target.value)}
              placeholder="氏名"
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] text-sm"
            />
          </div>

          {/* 依頼日 */}
          <div>
            <label className="text-xs text-[var(--muted-foreground)] mb-1 block">依頼日</label>
            <input
              type="date"
              value={orderDate}
              onChange={e => setOrderDate(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-[var(--border)] rounded-lg text-[var(--foreground)] hover:bg-[var(--secondary)]">
            キャンセル
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 text-sm bg-[var(--primary)] text-white rounded-lg flex items-center gap-2"
          >
            <FileText size={15} /> 依頼書を開く
          </button>
        </div>
      </div>
    </div>
  );
}

function toDateKey(val) {
  if (!val) return null;
  const d = new Date(val);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

function toInputDate(val) {
  if (!val) return "";
  const d = new Date(val);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

const STATUS_FILTER_OPTIONS = [
  { value: "",          label: "搬出完了を除く（デフォルト）" },
  { value: "all",       label: "全て表示" },
  { value: "pending",   label: "⚠️ 未依頼のみ" },
  { value: "requested", label: "✅ 依頼済みのみ" },
  { value: "completed", label: "📦 搬出完了のみ" },
];

// Modal: create or edit transport request for a vehicle
function TransportModal({ vehicle, users, onClose, onSave }) {
  const existing = vehicle.transportRequest;
  const [form, setForm] = useState({
    transportCompany: existing?.transportCompany ?? "",
    requestedById:    existing?.requestedBy?.id  ?? "",
    requestedAt:      toInputDate(existing?.requestedAt) || toInputDate(new Date()),
    destination:      existing?.destination ?? vehicle.deliverTo ?? vehicle.customer?.name ?? "",
    notes:            existing?.notes ?? "",
    extractionDeadline: toInputDate(vehicle.extractionDeadline),
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.transportCompany || !form.requestedById) {
      alert("陸送業者と依頼者は必須です");
      return;
    }
    setSaving(true);
    await onSave(vehicle, form, existing?.id ?? null);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-[var(--surface)] rounded-xl shadow-xl border border-[var(--border)] w-full max-w-lg mx-4 p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-[var(--foreground)]">陸送依頼</h2>
            <p className="text-sm text-[var(--muted-foreground)]">{vehicle.chassisNumber} · {vehicle.auction ?? "会場不明"}</p>
          </div>
          <button onClick={onClose} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* 搬出期限 */}
          <div className="col-span-2">
            <label className="text-xs text-[var(--muted-foreground)] mb-1 block">搬出期限</label>
            <input
              type="date"
              value={form.extractionDeadline}
              onChange={e => setForm(f => ({ ...f, extractionDeadline: e.target.value }))}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] text-sm"
            />
          </div>

          {/* 陸送業者 */}
          <div className="col-span-2">
            <label className="text-xs text-[var(--muted-foreground)] mb-1 block">陸送業者 <span className="text-[var(--error)]">*</span></label>
            <input
              list="transport-companies-list"
              value={form.transportCompany}
              onChange={e => setForm(f => ({ ...f, transportCompany: e.target.value }))}
              placeholder="業者名を選択または入力"
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] text-sm"
            />
            <datalist id="transport-companies-list">
              {TRANSPORT_COMPANIES.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>

          {/* 依頼者 */}
          <div>
            <label className="text-xs text-[var(--muted-foreground)] mb-1 block">依頼者 <span className="text-[var(--error)]">*</span></label>
            <select
              value={form.requestedById}
              onChange={e => setForm(f => ({ ...f, requestedById: e.target.value }))}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] text-sm"
            >
              <option value="">選択してください</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.username}</option>
              ))}
            </select>
          </div>

          {/* 依頼日 */}
          <div>
            <label className="text-xs text-[var(--muted-foreground)] mb-1 block">依頼日</label>
            <input
              type="date"
              value={form.requestedAt}
              onChange={e => setForm(f => ({ ...f, requestedAt: e.target.value }))}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] text-sm"
            />
          </div>

          {/* 行き先 */}
          <div className="col-span-2">
            <label className="text-xs text-[var(--muted-foreground)] mb-1 block">行き先（お客さん）</label>
            <input
              type="text"
              value={form.destination}
              onChange={e => setForm(f => ({ ...f, destination: e.target.value }))}
              placeholder="World Auto など"
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] text-sm"
            />
          </div>

          {/* 備考 */}
          <div className="col-span-2">
            <label className="text-xs text-[var(--muted-foreground)] mb-1 block">備考</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] text-sm resize-none"
            />
          </div>
        </div>

        <div className="flex justify-between items-center mt-6">
          {/* 搬出完了ボタン（依頼済みの場合のみ表示） */}
          <div>
            {existing && !existing.completedAt && (
              <button
                onClick={async () => {
                  setSaving(true);
                  await onSave(vehicle, { ...form, completedAt: new Date().toISOString() }, existing.id);
                  setSaving(false);
                }}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-[var(--border)] rounded-lg text-[var(--success)] hover:bg-[var(--success)]/10 disabled:opacity-50"
              >
                <PackageCheck size={15} /> 搬出完了にする
              </button>
            )}
            {existing?.completedAt && (
              <span className="text-xs text-[var(--muted-foreground)]">
                📦 搬出完了: {toDateKey(existing.completedAt)}
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm border border-[var(--border)] rounded-lg text-[var(--foreground)] hover:bg-[var(--secondary)]"
            >
              キャンセル
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm bg-[var(--primary)] text-white rounded-lg disabled:opacity-50"
            >
              {saving ? "保存中..." : existing ? "更新" : "依頼を記録"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TransportPage() {
  const { session } = useAuth(["view:vehicle"], ["Sadmin"]);

  const [vehicles, setVehicles]     = useState([]);
  const [users, setUsers]           = useState([]);
  const [loading, setLoading]       = useState(false);
  const [selected, setSelected]     = useState(null); // vehicle for modal

  // 依頼書作成モード
  const [printMode,    setPrintMode]    = useState(false);
  const [checkedIds,   setCheckedIds]   = useState(new Set());
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Filters
  const [statusFilter,    setStatusFilter]    = useState("");  // "" = 搬出完了を除く (default)
  const [searchQuery,     setSearchQuery]     = useState("");
  const [requesterFilter, setRequesterFilter] = useState("");  // user id
  const [companyFilter,   setCompanyFilter]   = useState("");  // transport company name

  const fetchVehicles = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const res  = await fetch(`/api/transportRequests?${params}`);
      const data = await res.json();
      setVehicles(data?.data ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  // Unique transport companies present in loaded data (for dropdown)
  const companyOptions = useMemo(() => {
    const seen = new Set();
    vehicles.forEach(v => {
      const c = v.transportRequest?.transportCompany;
      if (c) seen.add(c);
    });
    return Array.from(seen).sort();
  }, [vehicles]);

  // Client-side filters: free-text + 依頼者 + 陸送業者
  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => {
      if (requesterFilter && v.transportRequest?.requestedBy?.id !== Number(requesterFilter)) return false;
      if (companyFilter   && v.transportRequest?.transportCompany !== companyFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          v.chassisNumber?.toLowerCase().includes(q) ||
          v.auction?.toLowerCase().includes(q) ||
          v.deliverTo?.toLowerCase().includes(q) ||
          v.customer?.name?.toLowerCase().includes(q) ||
          v.transportRequest?.transportCompany?.toLowerCase().includes(q) ||
          v.transportRequest?.requestedBy?.username?.toLowerCase().includes(q) ||
          v.transportRequest?.destination?.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [vehicles, searchQuery, requesterFilter, companyFilter]);

  useEffect(() => { fetchVehicles(); }, [fetchVehicles]);

  useEffect(() => {
    fetch("/api/user").then(r => r.json()).then(d => setUsers(d?.user ?? d?.data ?? [])).catch(() => {});
  }, []);

  const handleSave = async (vehicle, form, existingId) => {
    try {
      if (existingId) {
        // Update existing
        await fetch("/api/transportRequests", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id:               existingId,
            vehicleId:        vehicle.id,
            transportCompany: form.transportCompany,
            requestedById:    form.requestedById,
            requestedAt:      form.requestedAt  || null,
            completedAt:      form.completedAt  ?? undefined,
            destination:      form.destination  || null,
            notes:            form.notes        || null,
            extractionDeadline: form.extractionDeadline || null,
          }),
        });
      } else {
        // Create new (extractionDeadline is handled server-side in POST)
        await fetch("/api/transportRequests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vehicleId:          vehicle.id,
            transportCompany:   form.transportCompany,
            requestedById:      form.requestedById,
            requestedAt:        form.requestedAt        || null,
            destination:        form.destination        || null,
            notes:              form.notes              || null,
            extractionDeadline: form.extractionDeadline || null,
          }),
        });
      }
      setSelected(null);
      fetchVehicles();
    } catch (err) {
      console.error("Save failed:", err);
    }
  };

  const pending   = filteredVehicles.filter(v => !v.transportRequest).length;
  const requested = filteredVehicles.filter(v =>  v.transportRequest && !v.transportRequest.completedAt).length;
  const completed = filteredVehicles.filter(v =>  v.transportRequest?.completedAt).length;

  const toggleCheck = (id) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (checkedIds.size === filteredVehicles.length) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(filteredVehicles.map(v => v.id)));
    }
  };
  const checkedVehicles = filteredVehicles.filter(v => checkedIds.has(v.id));

  return (
    <>
      <Head><title>陸送管理 | Exposaas</title></Head>
      <Sidebar>
        <div className="p-4 md:p-6 max-w-6xl mx-auto">

          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-2xl font-bold text-[var(--foreground)] flex items-center gap-2">
                <Truck size={24} /> 陸送管理
              </h1>
              <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
                表示 {filteredVehicles.length} 台 ·
                <span className="text-[var(--error)] mx-1">⚠️ 未依頼 {pending}</span>·
                <span className="text-[var(--success)] mx-1">✅ 依頼済み {requested}</span>·
                <span className="mx-1">📦 搬出完了 {completed}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              {printMode ? (
                <>
                  <span className="text-sm text-[var(--muted-foreground)]">{checkedIds.size}台 選択中</span>
                  <button
                    onClick={() => { setPrintMode(false); setCheckedIds(new Set()); }}
                    className="px-3 py-2 text-sm border border-[var(--border)] rounded-lg text-[var(--foreground)] hover:bg-[var(--secondary)]"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={() => checkedIds.size > 0 && setShowPrintModal(true)}
                    disabled={checkedIds.size === 0}
                    className="px-3 py-2 text-sm bg-[var(--primary)] text-white rounded-lg flex items-center gap-1.5 disabled:opacity-40"
                  >
                    <FileText size={15} /> 依頼書作成
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setPrintMode(true)}
                  className="px-3 py-2 text-sm border border-[var(--border)] rounded-lg text-[var(--foreground)] hover:bg-[var(--secondary)] flex items-center gap-1.5"
                >
                  <FileText size={15} /> 依頼書作成
                </button>
              )}
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            {/* フリーテキスト検索 */}
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="車体番号・会場・行き先で検索..."
                className="w-full pl-8 pr-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]"
              />
            </div>

            {/* 依頼者フィルター */}
            <select
              value={requesterFilter}
              onChange={e => setRequesterFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)]"
            >
              <option value="">依頼者: すべて</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.username}</option>
              ))}
            </select>

            {/* 陸送業者フィルター */}
            <select
              value={companyFilter}
              onChange={e => setCompanyFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)]"
            >
              <option value="">業者: すべて</option>
              {companyOptions.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* ステータスフィルター */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)]"
            >
              {STATUS_FILTER_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            {(searchQuery || requesterFilter || companyFilter) && (
              <button
                onClick={() => { setSearchQuery(""); setRequesterFilter(""); setCompanyFilter(""); }}
                className="px-3 py-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] border border-[var(--border)] rounded-lg"
              >
                クリア
              </button>
            )}
          </div>

          {/* Table */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--table-header-bg)]">
                    {printMode && (
                      <th className="px-3 py-2 w-10" onClick={e => e.stopPropagation()}>
                        <input type="checkbox"
                          checked={checkedIds.size === filteredVehicles.length && filteredVehicles.length > 0}
                          onChange={toggleAll}
                          className="w-4 h-4 cursor-pointer"
                        />
                      </th>
                    )}
                    <th className="text-left px-3 py-2 font-medium text-[var(--muted-foreground)] w-24">状態</th>
                    <th className="text-left px-3 py-2 font-medium text-[var(--muted-foreground)] w-44">車体番号</th>
                    <th className="text-left px-3 py-2 font-medium text-[var(--muted-foreground)] w-28">会場</th>
                    <th className="text-left px-3 py-2 font-medium text-[var(--muted-foreground)] w-24">開催日</th>
                    <th className="text-left px-3 py-2 font-medium text-[var(--muted-foreground)] w-20">搬出期限</th>
                    <th className="text-left px-3 py-2 font-medium text-[var(--muted-foreground)]">行き先</th>
                    <th className="text-left px-3 py-2 font-medium text-[var(--muted-foreground)] w-20">陸送業者</th>
                    <th className="text-left px-3 py-2 font-medium text-[var(--muted-foreground)] w-16">依頼者</th>
                    <th className="text-left px-3 py-2 font-medium text-[var(--muted-foreground)] w-20">依頼日</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><td colSpan={printMode ? 9 : 8} className="text-center py-12 text-[var(--muted-foreground)]">読み込み中...</td></tr>
                  )}
                  {!loading && vehicles.length === 0 && (
                    <tr><td colSpan={printMode ? 9 : 8} className="text-center py-12 text-[var(--muted-foreground)]">データがありません</td></tr>
                  )}
                  {!loading && filteredVehicles.map(v => {
                    const tr = v.transportRequest;
                    const isPending   = !tr;
                    const isCompleted = !!tr?.completedAt;
                    const dest = tr?.destination ?? v.deliverTo ?? v.customer?.name ?? "";

                    return (
                      <tr
                        key={v.id}
                        onClick={() => printMode ? toggleCheck(v.id) : setSelected(v)}
                        className={`border-b border-[var(--border)] cursor-pointer transition-colors select-none
                          ${printMode && checkedIds.has(v.id) ? "bg-[var(--primary)]/10 hover:bg-[var(--primary)]/15" :
                            printMode ? "hover:bg-[var(--secondary)]/30" :
                            isPending   ? "hover:bg-[var(--error)]/5" :
                            isCompleted ? "opacity-50 hover:opacity-80 hover:bg-[var(--secondary)]/20" :
                            "hover:bg-[var(--secondary)]/30"}`}
                      >
                        {printMode && (
                          <td className="px-3 py-2" onClick={e => { e.stopPropagation(); toggleCheck(v.id); }}>
                            <input
                              type="checkbox"
                              checked={checkedIds.has(v.id)}
                              onChange={() => toggleCheck(v.id)}
                              className="w-4 h-4 cursor-pointer"
                            />
                          </td>
                        )}
                        {/* 状態 */}
                        <td className="px-3 py-2">
                          {isPending ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium whitespace-nowrap bg-[var(--error)]/10 text-[var(--error)]">
                              <AlertTriangle size={10} /> 未依頼
                            </span>
                          ) : isCompleted ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium whitespace-nowrap bg-[var(--muted-foreground)]/10 text-[var(--muted-foreground)]">
                              <PackageCheck size={10} /> 搬出完了
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium whitespace-nowrap bg-[var(--success)]/10 text-[var(--success)]">
                              <CheckCircle2 size={10} /> 依頼済み
                            </span>
                          )}
                        </td>
                        {/* 車体番号 — w-44(176px)で17桁フルに表示 */}
                        <td className="px-3 py-2 font-mono font-medium text-[var(--foreground)] w-44">
                          {v.chassisNumber}
                        </td>
                        {/* 会場 */}
                        <td className="px-3 py-2 text-[var(--foreground)] max-w-[112px] truncate">
                          {v.auction ?? <span className="text-[var(--muted-foreground)]">—</span>}
                        </td>
                        {/* 開催日 */}
                        <td className="px-3 py-2 text-[var(--foreground)] whitespace-nowrap">
                          {v.auctionDate ?? <span className="text-[var(--muted-foreground)]">—</span>}
                        </td>
                        {/* 搬出期限 */}
                        <td className="px-3 py-2 whitespace-nowrap">
                          {v.extractionDeadline
                            ? <span className="text-[var(--foreground)]">{toDateKey(v.extractionDeadline)}</span>
                            : <span className="text-[var(--muted-foreground)]">未設定</span>
                          }
                        </td>
                        {/* 行き先 */}
                        <td className="px-3 py-2 text-[var(--foreground)]">
                          {dest || <span className="text-[var(--muted-foreground)]">—</span>}
                        </td>
                        {/* 陸送業者 */}
                        <td className="px-3 py-2 text-[var(--foreground)]">
                          {tr?.transportCompany ?? <span className="text-[var(--muted-foreground)]">—</span>}
                        </td>
                        {/* 依頼者 */}
                        <td className="px-3 py-2 text-[var(--foreground)]">
                          {tr?.requestedBy?.username ?? <span className="text-[var(--muted-foreground)]">—</span>}
                        </td>
                        {/* 依頼日 */}
                        <td className="px-3 py-2 whitespace-nowrap text-[var(--foreground)]">
                          {tr?.requestedAt
                            ? toDateKey(tr.requestedAt)
                            : <span className="text-[var(--muted-foreground)]">—</span>
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {loading && vehicles.length > 0 && (
            <p className="text-center text-xs text-[var(--muted-foreground)] mt-3">更新中...</p>
          )}
        </div>

        {/* 依頼詳細モーダル */}
        {selected && (
          <TransportModal
            vehicle={selected}
            users={users}
            onClose={() => setSelected(null)}
            onSave={handleSave}
          />
        )}

        {/* 依頼書作成モーダル */}
        {showPrintModal && (
          <PrintOrderModal
            vehicles={checkedVehicles}
            onClose={() => setShowPrintModal(false)}
          />
        )}
      </Sidebar>
    </>
  );
}
