import { CheckCircle2, Clock, AlertCircle, Inbox, HelpCircle } from "lucide-react";
import { getStatusConfig } from "@/lib/invoiceJobUtils";
import { useT } from "@/i18n/LocaleProvider";

const ICONS = { CheckCircle2, Clock, AlertCircle, Inbox, HelpCircle };

export default function StatusBadge({ status }) {
  const t = useT();
  const cfg = getStatusConfig(status);
  const Icon = ICONS[cfg.icon] || Clock;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 ${cfg.colorClass} rounded text-xs`}>
      <Icon className="w-3 h-3" /> {t(cfg.labelKey)}
    </span>
  );
}
