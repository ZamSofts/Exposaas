import React from "react";
import { Edit, Trash2, FileText, ShieldCheck, ClipboardCheck, FileX } from "lucide-react";
import EditableCell from "@/components/ui/EditableCell";
import { VEHICLE_COLUMNS, formatCurrency } from "@/config/vehicleColumns";
import { isAllowed } from "@/hooks/wrapper";

const VehicleRow = React.memo(function VehicleRow({
  vehicle: v,
  canEdit,
  dropdownOptions,
  comboOpts,
  onInlineSave,
  onInlineError,
  onEdit,
  onDelete,
  setDocumentPreview,
  session,
}) {
  return (
    <tr className="hover:bg-[var(--input)]/50 transition-colors" style={{ height: 32 }}>
      {VEHICLE_COLUMNS.map((col) => {
        // ── Actions column (conditional) ──────────────────────
        if (col.type === "actions") {
          if (!isAllowed(col.requirePermission, session)) return null;
          return (
            <td key={col.id} className="px-2 py-1 whitespace-nowrap text-right text-sm border border-[var(--border)] overflow-hidden">
              <div className="flex items-center justify-end gap-0.5">
                <button
                  onClick={() => onEdit(v.id)}
                  className="p-1 text-[var(--secondary-foreground)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 rounded transition-all"
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onDelete(v.id)}
                  className="p-1 text-[var(--secondary-foreground)] hover:text-[var(--error)] hover:bg-[var(--error)]/10 rounded transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </td>
          );
        }

        // ── Static columns (custom rendering) ─────────────────
        if (col.type === "static") {
          return (
            <td key={col.id} className="px-2 py-1 whitespace-nowrap border border-[var(--border)] overflow-hidden text-ellipsis">
              {renderStaticCell(col, v, { setDocumentPreview })}
            </td>
          );
        }

        // ── Read-only currency columns ────────────────────────
        if (col.type === "readonly-currency" || col.type === "readonly-currency-primary") {
          const isPrimary = col.type === "readonly-currency-primary";
          return (
            <td key={col.id} className="px-2 py-1 whitespace-nowrap text-right border border-[var(--border)] overflow-hidden text-ellipsis">
              <span className={`text-sm tabular-nums ${isPrimary ? "font-semibold text-[var(--primary)]" : "text-[var(--foreground)]"}`}>
                {formatCurrency(v[col.field] ?? 0)}
              </span>
            </td>
          );
        }

        // ── Editable columns (EditableCell) ───────────────────
        const options =
          col.type === "combobox" && col.isRelation
            ? dropdownOptions[col.optionsKey]
            : col.type === "combobox"
              ? comboOpts(col.optionsKey)
              : col.type === "dropdown"
                ? dropdownOptions[col.optionsKey]
                : undefined;

        return (
          <EditableCell
            key={col.id}
            type={col.type}
            value={v[col.field]}
            displayValue={col.displayValueFn?.(v)}
            vehicleId={v.id}
            field={col.field}
            options={options}
            onSaved={(updated) => onInlineSave(v.id, updated)}
            onError={onInlineError}
            editable={canEdit}
            isClearable={col.isClearable}
          />
        );
      })}
    </tr>
  );
});

/** Renders content for static column types based on column ID. */
function renderStaticCell(col, v, ctx) {
  switch (col.id) {
    case "id":
      return (
        <span className="text-sm font-mono tabular-nums text-[var(--secondary-foreground)] text-right block">
          #{v.id}
        </span>
      );
    case "invoice":
      return v.sourceInvoiceJob?.DocumentURL ? (
        <button
          onClick={() =>
            ctx.setDocumentPreview({
              url: v.sourceInvoiceJob.DocumentURL,
              fileName: `invoice_${v.sourceInvoiceJob.DocumentURL.split("/").pop()}`,
            })
          }
          className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-500/10 text-green-500 rounded hover:bg-green-500/20 transition-colors"
          title="Preview Invoice PDF"
          aria-label={`Preview invoice for vehicle ${v.id}`}
        >
          <FileText className="w-3.5 h-3.5" />
        </button>
      ) : (
        <span className="text-sm text-[var(--secondary-foreground)]">-</span>
      );
    case "docs": {
      const certDocs = (v.documents || []).filter(d => d.docType && d.docType !== "invoice");
      if (certDocs.length === 0) {
        return <span className="text-sm text-[var(--secondary-foreground)]">-</span>;
      }
      const docTypeConfig = {
        export_cert:     { icon: ShieldCheck,    color: "#10b981", title: "輸出抹消" },
        inspection_cert: { icon: ClipboardCheck, color: "#f59e0b", title: "車検証" },
        temp_cancel:     { icon: FileX,          color: "#8b5cf6", title: "一時抹消" },
      };
      return (
        <div className="flex items-center gap-0.5">
          {certDocs.map((doc) => {
            const cfg = docTypeConfig[doc.docType] || { icon: FileText, color: "#6b7280", title: doc.docType };
            const Icon = cfg.icon;
            return (
              <button
                key={doc.id}
                onClick={() =>
                  ctx.setDocumentPreview({
                    url: doc.Url,
                    fileName: `${doc.docType}_${doc.Url.split("/").pop()}`,
                  })
                }
                className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded hover:opacity-80 transition-colors"
                style={{ backgroundColor: `${cfg.color}15`, color: cfg.color }}
                title={cfg.title}
                aria-label={`Preview ${cfg.title} for vehicle ${v.id}`}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            );
          })}
        </div>
      );
    }
    case "createdAt":
      return (
        <span className="text-sm text-[var(--secondary-foreground)]">
          {new Date(v.createdAt).toLocaleDateString()}
        </span>
      );
    default:
      return <span className="text-sm text-[var(--secondary-foreground)]">-</span>;
  }
}

export default VehicleRow;
