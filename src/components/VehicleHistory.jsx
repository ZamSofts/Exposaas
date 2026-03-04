import { useState, useEffect } from "react";
import { API } from "@/hooks/wrapper";

// Currency fields that should be formatted with ¥
const CURRENCY_FIELDS = new Set(["bidAmount", "auctionFee", "insuranceFee", "recyclingFee", "transportFee", "otherFees", "taxSum", "totalCost"]);

// Field display names
const FIELD_LABELS = {
  chassisNumber: "車台番号",
  lotNumber: "ロット番号",
  auction: "オークション",
  auctionDate: "オークション日",
  brandId: "ブランド",
  customerId: "顧客",
  name: "名前",
  remarks: "備考",
  bidAmount: "落札額",
  auctionFee: "オークション手数料",
  insuranceFee: "保険料",
  recyclingFee: "リサイクル料",
  transportFee: "輸送費",
  otherFees: "その他費用",
  taxSum: "消費税",
  totalCost: "合計",
  session: "セッション",
  transportCompany: "輸送会社",
  deliverTo: "納車先",
  numberPlate: "ナンバープレート",
  titleTransferDeadline: "名義変更期限",
  containerNumber: "コンテナ番号",
  etd: "ETD",
  documentStatus: "書類状況",
  memo: "メモ",
  length: "長さ (cm)",
  width: "幅 (cm)",
  height: "高さ (cm)",
  m3: "m³",
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

function formatTime(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;

  // Less than 1 hour
  if (diff < 3600000) {
    const mins = Math.floor(diff / 60000);
    return mins <= 0 ? "たった今" : `${mins}分前`;
  }
  // Less than 24 hours
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}時間前`;
  }
  // Format as date
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hour = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${month}/${day} ${hour}:${min}`;
}

function ActionDescription({ log }) {
  const { action, field, oldValue, newValue, actionLabel, metadata } = log;

  if (action === "update" && field) {
    const label = FIELD_LABELS[field] || field;
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
            (書類: {metadata.relocationCounts.documents}, 支払: {metadata.relocationCounts.payments})
          </span>
        )}
      </span>
    );
  }

  return <span>{actionLabel}</span>;
}

export default function VehicleHistory({ vehicleId }) {
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
    return <div className="py-8 text-center text-[var(--secondary-foreground)]">読み込み中...</div>;
  }

  if (logs.length === 0) {
    return (
      <div className="py-8 text-center text-[var(--secondary-foreground)]">
        <p className="text-lg mb-2">履歴がありません</p>
        <p className="text-sm">この車両の変更履歴はまだ記録されていません。</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-xl font-semibold text-[var(--foreground)] mb-4">
        変更履歴
        <span className="text-sm font-normal text-[var(--secondary-foreground)] ml-2">({total}件)</span>
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
                <span>{formatTime(log.createdAt)}</span>
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
