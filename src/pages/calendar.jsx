import { useState, useEffect, useCallback, useRef } from "react";
import Head from "next/head";
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, Pencil, X, Check } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/config/vehicleColumns";

const WEEKDAYS = ["月", "火", "水", "木", "金", "土", "日"];

const TABS = [
  { id: "all",     label: "ALL" },
  { id: "auction", label: "オークション支払い" },
  { id: "other",   label: "その他" },
];

function getDaysInMonth(year, month) {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay  = new Date(year, month, 0);
  const startPad = (firstDay.getDay() + 6) % 7;
  const endPad   = (7 - ((lastDay.getDay() + 6) % 7 + 1)) % 7;

  const days = [];
  for (let i = startPad; i > 0; i--) {
    const d = new Date(firstDay);
    d.setDate(d.getDate() - i);
    days.push({ date: d, currentMonth: false });
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push({ date: new Date(year, month - 1, d), currentMonth: true });
  }
  for (let i = 1; i <= endPad; i++) {
    const d = new Date(lastDay);
    d.setDate(d.getDate() + i);
    days.push({ date: d, currentMonth: false });
  }
  return days;
}

// Parse a DB DateTime string (ISO or date-only) to a YYYY-MM-DD key in local time
function toDateKey(dateVal) {
  if (!dateVal) return null;
  const d = new Date(dateVal);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayKey() {
  return toDateKey(new Date());
}

export default function CalendarPage() {
  const { session } = useAuth(["view:vehicle"], ["Sadmin"]);

  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [invoices, setInvoices] = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  // Inline date editing state: { invoiceId, value }
  const [editing, setEditing] = useState(null);
  const dateInputRef = useRef(null);

  const fetchInvoices = useCallback(async (y, m) => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/auctionInvoices?year=${y}&month=${m}`);
      const data = await res.json();
      setInvoices(data?.data ?? []);
    } catch (err) {
      console.error("Failed to load invoices:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoices(year, month);
  }, [year, month, fetchInvoices]);

  const goToPrev = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const goToNext = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  const togglePaid = async (invoice) => {
    const newVal = !invoice.isPaid;
    setInvoices(prev => prev.map(inv => inv.id === invoice.id ? { ...inv, isPaid: newVal } : inv));
    try {
      await fetch("/api/auctionInvoices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: invoice.id, isPaid: newVal }),
      });
    } catch (err) {
      setInvoices(prev => prev.map(inv => inv.id === invoice.id ? { ...inv, isPaid: !newVal } : inv));
      console.error("Failed to update isPaid:", err);
    }
  };

  const startEditing = (inv, e) => {
    e.stopPropagation();
    const currentKey = toDateKey(inv.paymentDueDate) ?? "";
    setEditing({ invoiceId: inv.id, value: currentKey });
    setTimeout(() => dateInputRef.current?.focus(), 0);
  };

  const cancelEditing = (e) => {
    e?.stopPropagation();
    setEditing(null);
  };

  const saveDate = async (e) => {
    e?.stopPropagation();
    if (!editing) return;
    const { invoiceId, value } = editing;
    const oldInvoice = invoices.find(i => i.id === invoiceId);
    // Optimistic update
    setInvoices(prev => prev.map(inv =>
      inv.id === invoiceId ? { ...inv, paymentDueDate: value ? value : null } : inv
    ));
    setEditing(null);
    try {
      await fetch("/api/auctionInvoices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: invoiceId, paymentDueDate: value || null }),
      });
      // Refetch to get server-confirmed value
      fetchInvoices(year, month);
    } catch (err) {
      setInvoices(prev => prev.map(inv =>
        inv.id === invoiceId ? { ...inv, paymentDueDate: oldInvoice?.paymentDueDate } : inv
      ));
      console.error("Failed to update paymentDueDate:", err);
    }
  };

  // Tab filter (currently only "auction" entries exist; "other" reserved for future)
  const filteredInvoices = invoices.filter(inv => {
    if (activeTab === "all")     return true;
    if (activeTab === "auction") return true; // all current entries are auction
    if (activeTab === "other")   return false; // reserved
    return true;
  });

  // Build map: dateKey → [invoice]
  const invoiceMap = {};
  for (const inv of filteredInvoices) {
    if (!inv.paymentDueDate) continue;
    const key = toDateKey(inv.paymentDueDate);
    if (!invoiceMap[key]) invoiceMap[key] = [];
    invoiceMap[key].push(inv);
  }

  const days = getDaysInMonth(year, month);
  const today = todayKey();

  const totalUnpaid = filteredInvoices.filter(i => !i.isPaid).reduce((s, i) => s + (i.invoiceTotal ?? 0), 0);
  const totalPaid   = filteredInvoices.filter(i =>  i.isPaid).reduce((s, i) => s + (i.invoiceTotal ?? 0), 0);

  // USS Group: USS / HAA / JAA
  const USS_KEYWORDS = ["USS", "HAA", "JAA"];
  const isUssGroup = (inv) => USS_KEYWORDS.some(kw => inv.auctionVenue?.toUpperCase().includes(kw));
  const ussUnpaid = filteredInvoices.filter(i => !i.isPaid && isUssGroup(i)).reduce((s, i) => s + (i.invoiceTotal ?? 0), 0);

  return (
    <>
      <Head><title>支払いカレンダー | Exposaas</title></Head>
      <Sidebar>
        <div className="p-4 md:p-6 max-w-6xl mx-auto">

          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-[var(--foreground)]">支払いカレンダー</h1>
            <div className="flex items-center gap-5 text-sm">
              {/* USS Group subtotal */}
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--secondary)]/40 border border-[var(--border)]">
                <span className="text-xs text-[var(--muted-foreground)] font-medium">USS/HAA/JAA</span>
                <span className="font-semibold text-[var(--error)]">{formatCurrency(ussUnpaid)}</span>
              </span>
              <span className="w-px h-4 bg-[var(--border)]" />
              <span className="text-[var(--muted-foreground)]">
                未払い <span className="font-semibold text-[var(--error)]">{formatCurrency(totalUnpaid)}</span>
              </span>
              <span className="text-[var(--muted-foreground)]">
                支払済 <span className="font-semibold text-[var(--success)]">{formatCurrency(totalPaid)}</span>
              </span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-4 border-b border-[var(--border)]">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px
                  ${activeTab === tab.id
                    ? "border-[var(--primary)] text-[var(--primary)]"
                    : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Month navigation */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={goToPrev} className="p-2 rounded-lg hover:bg-[var(--secondary)] transition-colors">
              <ChevronLeft size={20} />
            </button>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              {year}年 {month}月
            </h2>
            <button onClick={goToNext} className="p-2 rounded-lg hover:bg-[var(--secondary)] transition-colors">
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Calendar grid */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden shadow-sm">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 border-b border-[var(--border)]">
              {WEEKDAYS.map(d => (
                <div key={d} className="text-center text-xs font-medium text-[var(--muted-foreground)] py-2 bg-[var(--table-header-bg)]">
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7">
              {days.map(({ date, currentMonth }, idx) => {
                const key        = toDateKey(date);
                const dayInvoices = invoiceMap[key] ?? [];
                const isToday    = key === today;

                return (
                  <div
                    key={idx}
                    className={`min-h-[90px] p-1.5 border-b border-r border-[var(--border)] last:border-r-0
                      ${!currentMonth ? "bg-[var(--table-stripe-bg)] opacity-40" : ""}
                      ${isToday ? "ring-2 ring-inset ring-[var(--primary)]" : ""}
                    `}
                  >
                    {/* Day number */}
                    <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full
                      ${isToday ? "bg-[var(--primary)] text-white" : "text-[var(--foreground)]"}`}>
                      {date.getDate()}
                    </div>

                    {/* Invoice entries */}
                    {dayInvoices.map(inv => {
                      const isEditingThis = editing?.invoiceId === inv.id;

                      return (
                        <div key={inv.id} className="mb-1">
                          {/* Date edit mode */}
                          {isEditingThis ? (
                            <div
                              className="flex items-center gap-0.5 bg-[var(--surface)] border border-[var(--primary)] rounded px-1 py-0.5"
                              onClick={e => e.stopPropagation()}
                            >
                              <input
                                ref={dateInputRef}
                                type="date"
                                value={editing.value}
                                onChange={e => setEditing(prev => ({ ...prev, value: e.target.value }))}
                                className="text-xs bg-transparent outline-none w-[90px] text-[var(--foreground)]"
                              />
                              <button onClick={saveDate} className="text-[var(--success)] hover:opacity-70">
                                <Check size={11} />
                              </button>
                              <button onClick={cancelEditing} className="text-[var(--muted-foreground)] hover:opacity-70">
                                <X size={11} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => togglePaid(inv)}
                              className={`w-full text-left px-1.5 py-1 rounded text-xs leading-tight transition-all group relative
                                ${inv.isPaid
                                  ? "bg-[var(--success)]/10 text-[var(--success)] line-through opacity-60"
                                  : "bg-[var(--error)]/10 text-[var(--error)] hover:bg-[var(--error)]/20"
                                }`}
                            >
                              <div className="flex items-center gap-1">
                                {inv.isPaid
                                  ? <CheckCircle2 size={10} className="shrink-0" />
                                  : <Circle size={10} className="shrink-0" />
                                }
                                <span className="truncate font-medium">{inv.auctionVenue ?? "会場不明"}</span>
                                {inv.isPrepaymentRequired && !inv.isPaid && (
                                  <span className="ml-auto shrink-0 text-[10px] font-bold text-orange-500" title="先払い必須">⚠️</span>
                                )}
                                {/* Edit date pencil */}
                                <span
                                  role="button"
                                  onClick={e => startEditing(inv, e)}
                                  className="ml-auto shrink-0 opacity-0 group-hover:opacity-60 hover:!opacity-100 text-[var(--muted-foreground)]"
                                >
                                  <Pencil size={9} />
                                </span>
                              </div>
                              <div className="pl-3 font-semibold">
                                {inv.invoiceTotal != null ? formatCurrency(inv.invoiceTotal) : "-"}
                              </div>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {loading && (
            <div className="text-center text-sm text-[var(--muted-foreground)] mt-4">読み込み中...</div>
          )}

          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 text-xs text-[var(--muted-foreground)]">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-[var(--error)]/20" />
              <span>未払い（クリックで支払済みに）</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-[var(--success)]/20" />
              <span>支払済み</span>
            </div>
            <div className="flex items-center gap-1">
              <span>⚠️</span>
              <span>先払い必須（当日中に支払いが必要）</span>
            </div>
            <div className="flex items-center gap-1">
              <Pencil size={10} />
              <span>ホバーで日付変更</span>
            </div>
          </div>
        </div>
      </Sidebar>
    </>
  );
}
