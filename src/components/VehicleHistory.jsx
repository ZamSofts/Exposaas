import { useState, useEffect } from "react";
import { API } from "@/hooks/wrapper";
import { useT } from "@/i18n/LocaleProvider";

// Currency fields that should be formatted with ¥
const CURRENCY_FIELDS = new Set(["bidAmount", "auctionFee", "insuranceFee", "recyclingFee", "transportFee", "otherFees", "taxSum", "totalCost"]);

// Maps internal field codes to i18n keys (shared with vehicle.jsx MergeInfoPopup)
const FIELD_LABEL_KEYS = {
  chassisNumber: "fields.chassisNumber",
  lotNumber: "fields.lotNumber",
  auction: "fields.auction",
  auctionDate: "fields.auctionDateLabel",
  brandId: "fields.brandId",
  customerId: "fields.customerId",
  name: "fields.name",
  remarks: "fields.remarks",
  bidAmount: "fields.bidAmountShort",
  auctionFee: "fields.auctionFee",
  insuranceFee: "fields.insuranceFee",
  recyclingFee: "fields.recyclingFee",
  transportFee: "fields.transportFee",
  otherFees: "fields.otherFees",
  taxSum: "fields.taxSumAlt",
  totalCost: "fields.totalCostShort",
  session: "fields.session",
  transportCompany: "fields.transportCompany",
  deliverTo: "fields.deliverToAlt",
  numberPlate: "fields.numberPlate",
  titleTransferDeadline: "fields.titleTransferDeadline",
  containerNumber: "fields.containerNumber",
  etd: "fields.etd",
  documentStatus: "fields.documentStatusAlt",
  memo: "fields.memo",
  length: "fields.lengthShort",
  width: "fields.widthShort",
  height: "fields.heightShort",
  m3: "fields.m3",
};

// Actor icons
const ACTOR_ICONS = {
  user: "👤",
  ai: "🤖",
  system: "⚙️",
  csv_import: "📊",
};

function formatValue(field, value) {
  if (value === null || value === undefined || value === "null") return "—";
  if (CURRENCY_FIELDS.has(field)) {
    const num = parseFloat(value);
    if (!isNaN(num)) return `¥${num.toLocaleString()}`;
  }
  return String(value);
}

function formatTime(dateStr, t) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;

  if (diff < 3600000) {
    const mins = Math.floor(diff / 60000);
    return mins <= 0 ? t("vehicle.history.justNow") : t("vehicle.history.minutesAgo", { minutes: mins });
  }
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return t("vehicle.history.hoursAgo", { hours });
  }
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hour = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${month}/${day} ${hour}:${min}`;
}

function ActionDescription({ log }) {
  const t = useT();
  const { action, field, oldValue, newValue, actionLabel, metadata } = log;

  if (action === "update" && field) {
    const label = FIELD_LABEL_KEYS[field] ? t(FIELD_LABEL_KEYS[field]) : field;
    return (
      <span>
        <span className="font-medium">{label}</span>
        {": "}
        <span className="text-[var(--secondary-foreground)]">{formatValue(field, oldValue)}</span>
        {" → "}
        <span className="font-medium">{formatValue(field, newValue)}</span>
      </span>
    );
  }

  if (action === "payment_create" && metadata) {
    const amount = metadata.amount != null ? `¥${Number(metadata.amount).toLocaleString()}` : "";
    return (
      <span>
        {actionLabel}: {metadata.name} {amount}
      </span>
    );
  }

  if (action === "payment_delete" && metadata) {
    const amount = metadata.amount != null ? `¥${Number(metadata.amount).toLocaleString()}` : "";
    return (
      <span>
        {actionLabel}: {metadata.name} {amount}
      </span>
    );
  }

  if (action === "payment_update" && metadata) {
    return (
      <span>
        {actionLabel}: {metadata.name}
      </span>
    );
  }

  if (action === "link_document" && metadata) {
    const docLabel = metadata.docType || "";
    return (
      <span>
        {actionLabel} ({docLabel})
      </span>
    );
  }

  if (action === "merge" && metadata) {
    return (
      <span>
        {actionLabel}: #{metadata.absorbedId} ({metadata.absorbedChassis || "—"})
        {metadata.relocationCounts && (
          <span className="text-[var(--secondary-foreground)] text-xs ml-1">
            ({t("vehicle.history.docsLabel")}: {metadata.relocationCounts.documents}, {t("vehicle.history.paymentsLabel")}: {metadata.relocationCounts.payments})
          </span>
        )}
      </span>
    );
  }

  return <span>{actionLabel}</span>;
}

export default function VehicleHistory({ vehicleId }) {
  const t = useT();
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!vehicleId) return;

    setLoading(true);
    API("GET", `/vehicleAuditLog?vehicleId=${vehicleId}&limit=100`)
      .then(data => {
        setLogs(data.logs || []);
        setTotal(data.total || 0);
      })
      .catch(err => {
        console.error("Failed to load audit log:", err);
        setLogs([]);
      })
      .finally(() => setLoading(false));
  }, [vehicleId]);

  if (loading) {
    return <div className="py-8 text-center text-[var(--secondary-foreground)]">{t("vehicle.history.loading")}</div>;
  }

  if (logs.length === 0) {
    return (
      <div className="py-8 text-center text-[var(--secondary-foreground)]">
        <p className="text-lg mb-2">{t("vehicle.history.empty")}</p>
        <p className="text-sm">{t("vehicle.history.emptyDetail")}</p>
      </div>
    );
  }

  const countSuffix = t("vehicle.history.countSuffix");

  return (
    <div>
      <h3 className="text-xl font-semibold text-[var(--foreground)] mb-4">
        {t("vehicle.history.title")}
        <span className="text-sm font-normal text-[var(--secondary-foreground)] ml-2">({total}{countSuffix})</span>
      </h3>

      <div className="space-y-1">
        {logs.map(log => (
          <div key={log.id} className="flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-[var(--input)] transition-colors">
            {/* Actor icon */}
            <span className="text-base mt-0.5 flex-shrink-0" title={log.actorLabel}>
              {ACTOR_ICONS[log.actor] || "❓"}
            </span>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="text-sm text-[var(--foreground)]">
                {/* Actor name */}
                {log.actorName && <span className="font-medium mr-1">{log.actorName}</span>}
                {/* Action description */}
                <ActionDescription log={log} />
              </div>

              {/* Source + time */}
              <div className="flex items-center gap-2 mt-0.5 text-xs text-[var(--secondary-foreground)]">
                <span>{formatTime(log.createdAt, t)}</span>
                {log.sourceLabel && (
                  <>
                    <span>·</span>
                    <span>{log.sourceLabel}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
