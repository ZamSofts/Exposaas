import { useState } from "react";
import Head from "next/head";
import { useAuth, API, Error, Toast, Loader, queryKeys } from "@/hooks/wrapper";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/Sidebar";
import { BarChart3, TrendingUp, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { ACCURACY_PCT, ACCURACY_THRESHOLDS, getAccuracyColor } from "@/config/aiConstants";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";

const PERIOD_OPTIONS = [
  { label: "7 days", value: "7d" },
  { label: "30 days", value: "30d" },
  { label: "90 days", value: "90d" },
  { label: "All time", value: "3650d" },
];

const FIELD_LABELS = {
  chassis_number: "Chassis Number",
  brand: "Brand",
  auction: "Auction House",
  lot_number: "Lot Number",
  auction_date: "Auction Date",
  charges: "Charges",
};

function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 flex items-start gap-4">
      <div className="p-2.5 rounded-lg" style={{ backgroundColor: `${color}18` }}>
        <Icon size={22} style={{ color }} />
      </div>
      <div>
        <p className="text-sm text-[var(--secondary-foreground)]">{label}</p>
        <p className="text-2xl font-bold text-[var(--foreground)] mt-0.5">{value}</p>
        {sub && <p className="text-xs text-[var(--muted-foreground)] mt-1">{sub}</p>}
      </div>
    </div>
  );
}

function AccuracyBar({ value }) {
  const pct = Math.round(value * 100);
  const color = pct >= ACCURACY_PCT.HIGH ? "#22c55e" : pct >= ACCURACY_PCT.MID ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-[var(--border)] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-sm font-medium w-12 text-right" style={{ color }}>{pct}%</span>
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 shadow-lg text-sm">
      <p className="text-[var(--foreground)] font-medium">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="mt-1">
          {p.name}: {p.name === "accuracy" ? `${Math.round(p.value * 100)}%` : p.value}
        </p>
      ))}
    </div>
  );
}

export default function AccuracyPage() {
  const { session, status } = useAuth(["view:vehicle"], ["Sadmin"]);
  const [period, setPeriod] = useState("30d");
  const [toast, setToast] = useState({ id: 0, message: "", type: "success" });

  // ── Data fetching (React Query) ──
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.accuracy({ period }),
    queryFn: async () => {
      const res = await API("GET", `accuracyStats?period=${period}`);
      if (res.error) throw new Error(res.error);
      return res;
    },
    enabled: status === "authenticated",
  });

  if (status === "loading") return <Loader />;

  const overview = data?.overview || {};
  const byField = (data?.byField || []).map(f => ({
    ...f,
    label: FIELD_LABELS[f.field] || f.field,
    accuracyPct: Math.round(f.accuracy * 100),
  }));
  const byAuction = (data?.byAuction || []).map(a => ({
    ...a,
    accuracyPct: Math.round(a.accuracy * 100),
  }));
  const trend = (data?.trend || []).map(t => ({
    ...t,
    accuracyPct: Math.round(t.accuracy * 100),
    dateLabel: t.date.slice(5), // MM-DD
  }));
  const recentCorrections = data?.recentCorrections || [];

  const worstField = byField.length > 0 ? byField[0] : null;

  return (
    <>
      <Head>
        <title>AI Accuracy - ExpoSaaS</title>
      </Head>
      <Sidebar>
        <div className="p-6 md:p-8 bg-[var(--background)] min-h-screen">
          <Error message={error?.message || ""} />

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-7 h-7 text-[var(--primary)]" />
              <div>
                <h1 className="text-2xl font-bold text-[var(--foreground)]">AI Accuracy</h1>
                <p className="text-sm text-[var(--secondary-foreground)]">Extraction accuracy tracking</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {PERIOD_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setPeriod(opt.value)}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    period === opt.value
                      ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                      : "bg-[var(--surface)] text-[var(--foreground)] border-[var(--border)] hover:bg-[var(--input)]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <Loader />
          ) : data ? (
            <>
              {/* Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <StatCard
                  icon={BarChart3}
                  label="Total Reviewed"
                  value={overview.totalReviewed || 0}
                  sub="invoices reviewed"
                  color="#6366f1"
                />
                <StatCard
                  icon={CheckCircle}
                  label="Exact Match"
                  value={overview.exactMatch || 0}
                  sub="AI got it right"
                  color="#22c55e"
                />
                <StatCard
                  icon={AlertTriangle}
                  label="Corrected"
                  value={overview.corrected || 0}
                  sub="user had to fix"
                  color="#f59e0b"
                />
                <StatCard
                  icon={TrendingUp}
                  label="Accuracy Rate"
                  value={`${Math.round((overview.accuracyRate || 0) * 100)}%`}
                  sub={worstField ? `Weakest: ${worstField.label}` : null}
                  color={getAccuracyColor(overview.accuracyRate)}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Accuracy by Field */}
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
                  <h3 className="text-base font-semibold text-[var(--foreground)] mb-4">Accuracy by Field</h3>
                  {byField.length > 0 ? (
                    <div className="space-y-3">
                      {byField.map(f => (
                        <div key={f.field}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-[var(--foreground)]">{f.label}</span>
                            <span className="text-xs text-[var(--muted-foreground)]">{f.errors} errors / {f.total}</span>
                          </div>
                          <AccuracyBar value={f.accuracy} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--muted-foreground)]">No field-level data yet</p>
                  )}
                </div>

                {/* Accuracy by Auction House */}
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
                  <h3 className="text-base font-semibold text-[var(--foreground)] mb-4">Accuracy by Auction House</h3>
                  {byAuction.length > 0 ? (
                    <ResponsiveContainer width="100%" height={byAuction.length * 45 + 20}>
                      <BarChart data={byAuction} layout="vertical" margin={{ left: 10, right: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                        <YAxis dataKey="auction" type="category" width={120} tick={{ fontSize: 12 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="accuracyPct" name="accuracy" radius={[0, 4, 4, 0]}>
                          {byAuction.map((entry, i) => (
                            <Cell key={i} fill={entry.accuracyPct >= ACCURACY_PCT.HIGH ? "#22c55e" : entry.accuracyPct >= ACCURACY_PCT.MID ? "#f59e0b" : "#ef4444"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-[var(--muted-foreground)]">No auction data yet</p>
                  )}
                </div>
              </div>

              {/* Accuracy Trend */}
              {trend.length > 1 && (
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 mb-8">
                  <h3 className="text-base font-semibold text-[var(--foreground)] mb-4">Accuracy Trend</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={trend} margin={{ left: 10, right: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="dateLabel" tick={{ fontSize: 12 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="accuracyPct"
                        name="accuracy"
                        stroke="#6366f1"
                        strokeWidth={2}
                        dot={{ r: 4, fill: "#6366f1" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Recent Corrections Table */}
              {recentCorrections.length > 0 && (
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
                  <h3 className="text-base font-semibold text-[var(--foreground)] mb-4">Recent Corrections</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border)]">
                          <th className="text-left py-2 px-3 text-[var(--secondary-foreground)] font-medium">ID</th>
                          <th className="text-left py-2 px-3 text-[var(--secondary-foreground)] font-medium">Auction</th>
                          <th className="text-left py-2 px-3 text-[var(--secondary-foreground)] font-medium">Date</th>
                          <th className="text-left py-2 px-3 text-[var(--secondary-foreground)] font-medium">Fields Changed</th>
                          <th className="text-left py-2 px-3 text-[var(--secondary-foreground)] font-medium">Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentCorrections.map(r => {
                          const changedFields = r.vehicles
                            .flatMap(v => Object.keys(v.fields || {}))
                            .map(f => FIELD_LABELS[f] || f);
                          const chargeChanges = r.vehicles.reduce((sum, v) => {
                            return sum + (v.charges?.added?.length || 0) + (v.charges?.removed?.length || 0) + (v.charges?.changed?.length || 0);
                          }, 0);
                          if (chargeChanges > 0) changedFields.push(`${chargeChanges} charge(s)`);

                          return (
                            <tr key={r.id} className="border-b border-[var(--border)] hover:bg-[var(--input)] transition-colors">
                              <td className="py-2.5 px-3 text-[var(--foreground)]">#{r.id}</td>
                              <td className="py-2.5 px-3 text-[var(--foreground)]">{r.auctionHouse || "-"}</td>
                              <td className="py-2.5 px-3 text-[var(--muted-foreground)]">
                                {new Date(r.createdAt).toLocaleDateString()}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                                  {r.fieldsChanged}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-[var(--muted-foreground)] text-xs">
                                {changedFields.length > 0 ? changedFields.join(", ") : "-"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Empty state */}
              {overview.totalReviewed === 0 && (
                <div className="text-center py-16">
                  <XCircle className="mx-auto mb-3 text-[var(--muted-foreground)]" size={40} />
                  <p className="text-lg text-[var(--foreground)]">No reviews yet</p>
                  <p className="text-sm text-[var(--muted-foreground)] mt-1">
                    Review some invoice extractions to start tracking accuracy
                  </p>
                </div>
              )}
            </>
          ) : null}
        </div>
      </Sidebar>
      <Toast id={toast.id} type={toast.type} message={toast.message}
             onClose={() => setToast({ id: 0, message: "", type: "success" })} />
    </>
  );
}
