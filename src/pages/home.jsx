import Head from "next/head";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAuth, API } from "@/hooks/wrapper";
import Sidebar from "@/components/Sidebar";
import StatusBadge from "@/components/ui/StatusBadge";
import { AlertCircle, Clock, Car, FileText, ArrowRight } from "lucide-react";
import { useLocale, useT } from "@/i18n/LocaleProvider";

function getGreetingKey() {
  const h = new Date().getHours();
  if (h < 12) return "home.greetingMorning";
  if (h < 17) return "home.greetingAfternoon";
  return "home.greetingEvening";
}

function formatDate(date, locale) {
  const tag = locale === "en" ? "en-GB" : "ja-JP";
  return date.toLocaleDateString(tag, {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
}

function StatCard({ label, unit, value, color, icon: Icon, isLoading }) {
  const styles = {
    red:    { bg: "bg-red-500/20",    text: "text-red-700",    border: "border-red-500/35" },
    orange: { bg: "bg-orange-500/20", text: "text-orange-600", border: "border-orange-500/35" },
    blue:   { bg: "bg-blue-500/20",   text: "text-blue-700",   border: "border-blue-500/35" },
    gray:   { bg: "bg-gray-500/15",   text: "text-gray-600",   border: "border-gray-500/30" },
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
  const { locale } = useLocale();
  const t = useT();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => API("GET", "dashboard/stats"),
    staleTime: 60_000,
  });

  const userName = session?.name || session?.username || "";
  const greeting = t(getGreetingKey());
  const heading = userName ? t("home.greetingWithName", { greeting, name: userName }) : greeting;
  const listDateLocale = locale === "en" ? "en-GB" : "ja-JP";

  return (
    <>
      <Head>
        <title>{t("pageTitles.home")}</title>
      </Head>
      <Sidebar>
        <div className="p-6 bg-[var(--background)] min-h-screen">
          <div className="mb-8">
            <p className="text-sm text-[var(--secondary-foreground)] mb-1">
              {formatDate(new Date(), locale)}
            </p>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">
              {heading}
            </h1>
          </div>

          {!isLoading && stats?.pendingDocs > 0 && (
            <div className="mb-6 flex items-center justify-between bg-red-500/10 border border-red-500/30 text-red-600 rounded-lg px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {t("home.pendingAlert", { count: stats.pendingDocs })}
              </div>
              <Link
                href="/documents"
                className="flex items-center gap-1 text-sm font-semibold hover:underline whitespace-nowrap ml-4"
              >
                {t("common.processNow")}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              label={t("home.stats.pendingDocs")}
              unit={t("common.items")}
              value={stats?.pendingDocs ?? 0}
              color="red"
              icon={Clock}
              isLoading={isLoading}
            />
            <StatCard
              label={t("home.stats.failedDocs")}
              unit={t("common.items")}
              value={stats?.failedDocs ?? 0}
              color="orange"
              icon={AlertCircle}
              isLoading={isLoading}
            />
            <StatCard
              label={t("home.stats.todayVehicles")}
              unit={t("common.units")}
              value={stats?.todayVehicles ?? 0}
              color="blue"
              icon={Car}
              isLoading={isLoading}
            />
            <StatCard
              label={t("home.stats.missingInvoice")}
              unit={t("common.units")}
              value={stats?.missingInvoice ?? 0}
              color="gray"
              icon={FileText}
              isLoading={isLoading}
            />
          </div>

          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--foreground)]">{t("home.recentDocs")}</h2>
              <Link
                href="/documents"
                className="text-xs text-[var(--primary)] hover:underline flex items-center gap-1"
              >
                {t("common.viewAll")} <ArrowRight className="w-3 h-3" />
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
                      {new Date(doc.createdAt).toLocaleDateString(listDateLocale)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-5 py-8 text-center text-sm text-[var(--secondary-foreground)]">
                {t("home.noDocuments")}
              </div>
            )}
          </div>
        </div>
      </Sidebar>
    </>
  );
}
