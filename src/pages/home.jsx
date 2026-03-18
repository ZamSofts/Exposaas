import Head from "next/head";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAuth, API } from "@/hooks/wrapper";
import Sidebar from "@/components/Sidebar";
import StatusBadge from "@/components/ui/StatusBadge";
import { AlertCircle, Clock, Car, FileText, ArrowRight } from "lucide-react";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "おはようございます";
  if (h < 17) return "こんにちは";
  return "こんばんは";
}

function formatDateJa(date) {
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
}

function StatCard({ label, unit, value, color, icon: Icon, isLoading }) {
  const styles = {
    red:    { bg: "bg-red-500/10",    text: "text-red-600",    border: "border-red-500/20" },
    orange: { bg: "bg-orange-500/10", text: "text-orange-500", border: "border-orange-500/20" },
    blue:   { bg: "bg-blue-500/10",   text: "text-blue-600",   border: "border-blue-500/20" },
    gray:   { bg: "bg-gray-500/10",   text: "text-gray-500",   border: "border-gray-500/20" },
  };
  const s = styles[color] || styles.gray;

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 flex items-center gap-4">
      <div className={`p-3 rounded-xl ${s.bg} border ${s.border} shrink-0`}>
        <Icon className={`w-5 h-5 ${s.text}`} />
      </div>
      <div>
        <p className="text-xs text-[var(--secondary-foreground)] font-medium mb-1">{label}</p>
        {isLoading ? (
          <div className="h-7 w-14 bg-[var(--secondary)] rounded animate-pulse" />
        ) : (
          <p className={`text-2xl font-bold ${s.text}`}>
            {value}
            <span className="text-sm font-medium ml-1">{unit}</span>
          </p>
        )}
      </div>
    </div>
  );
}

export default function HomePage() {
  const { session } = useAuth(["view:vehicle"], ["Sadmin"]);

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => API("GET", "dashboard/stats"),
    staleTime: 60_000,
  });

  const userName = session?.name || session?.username || "";

  return (
    <>
      <Head>
        <title>ホーム - ExpoSaaS</title>
      </Head>
      <Sidebar>
        <div className="p-8 bg-[var(--background)] min-h-screen">
          {/* 日付 + 挨拶 */}
          <div className="mb-8">
            <p className="text-sm text-[var(--secondary-foreground)] mb-1">
              {formatDateJa(new Date())}
            </p>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">
              {getGreeting()}{userName ? `、${userName}さん` : ""}
            </h1>
          </div>

          {/* アラートバナー */}
          {!isLoading && stats?.pendingDocs > 0 && (
            <div className="mb-6 flex items-center justify-between bg-red-500/10 border border-red-500/30 text-red-600 rounded-lg px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                未処理の書類が {stats.pendingDocs} 件あります
              </div>
              <Link
                href="/documents"
                className="flex items-center gap-1 text-sm font-semibold hover:underline whitespace-nowrap ml-4"
              >
                今すぐ処理する
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}

          {/* サマリーカード */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              label="未処理書類"
              unit="件"
              value={stats?.pendingDocs ?? 0}
              color="red"
              icon={Clock}
              isLoading={isLoading}
            />
            <StatCard
              label="処理失敗"
              unit="件"
              value={stats?.failedDocs ?? 0}
              color="orange"
              icon={AlertCircle}
              isLoading={isLoading}
            />
            <StatCard
              label="本日登録車両"
              unit="台"
              value={stats?.todayVehicles ?? 0}
              color="blue"
              icon={Car}
              isLoading={isLoading}
            />
            <StatCard
              label="請求書未紐付け"
              unit="台"
              value={stats?.missingInvoice ?? 0}
              color="gray"
              icon={FileText}
              isLoading={isLoading}
            />
          </div>

          {/* 直近の書類処理 */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--foreground)]">直近の書類処理</h2>
              <Link
                href="/documents"
                className="text-xs text-[var(--primary)] hover:underline flex items-center gap-1"
              >
                すべて見る <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {isLoading ? (
              <div className="divide-y divide-[var(--border)]">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="px-5 py-3 flex items-center gap-4 animate-pulse">
                    <div className="h-4 w-10 bg-[var(--secondary)] rounded" />
                    <div className="h-4 w-20 bg-[var(--secondary)] rounded" />
                    <div className="h-5 w-20 bg-[var(--secondary)] rounded-full" />
                    <div className="h-4 w-24 bg-[var(--secondary)] rounded ml-auto" />
                  </div>
                ))}
              </div>
            ) : stats?.recentDocs?.length > 0 ? (
              <div className="divide-y divide-[var(--border)]">
                {stats.recentDocs.map((doc) => (
                  <div key={doc.id} className="px-5 py-3 flex items-center gap-4 text-sm">
                    <span className="font-mono text-[var(--secondary-foreground)] w-10 shrink-0">
                      #{doc.id}
                    </span>
                    <span className="text-[var(--secondary-foreground)] w-24 shrink-0">
                      {doc.docType || "invoice"}
                    </span>
                    <StatusBadge status={doc.status} />
                    <span className="text-[var(--secondary-foreground)] text-xs ml-auto shrink-0">
                      {new Date(doc.createdAt).toLocaleDateString("ja-JP")}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-5 py-8 text-center text-sm text-[var(--secondary-foreground)]">
                書類がありません
              </div>
            )}
          </div>
        </div>
      </Sidebar>
    </>
  );
}
