import React from "react";
import { ChevronDown, ChevronRight, PenLine, Check } from "lucide-react";
import { ACCURACY_THRESHOLDS, getConfidenceLevel, getAccuracyColor as getConfidenceColor } from "@/config/aiConstants";

export default function SummaryModeTable({
  editable,
  expandedRows,
  toggleRowExpand,
  switchToDetailForChassis,
  calculateVehicleTotalCost,
  formatCurrency,
  saveCurrentPage,
  isLoading,
}) {
  return (
    <div>
      <div className="border border-[var(--border)] rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--secondary)] sticky top-0">
            <tr>
              <th className="w-8 py-3 px-2"></th>
              <th className="text-left py-3 px-3 font-semibold text-[var(--foreground)]">Chassis</th>
              <th className="text-left py-3 px-3 font-semibold text-[var(--foreground)]">Brand</th>
              <th className="text-left py-3 px-3 font-semibold text-[var(--foreground)]">Lot</th>
              <th className="text-left py-3 px-3 font-semibold text-[var(--foreground)]">Date</th>
              <th className="text-right py-3 px-3 font-semibold text-[var(--foreground)]">Total</th>
              <th className="w-16 py-3 px-2"></th>
            </tr>
          </thead>
          <tbody>
            {editable.map((item, idx) => {
              const isExpanded = expandedRows.has(idx);
              const total = calculateVehicleTotalCost(item.charges);
              const isLowConf = item.confidence != null && item.confidence < ACCURACY_THRESHOLDS.MID;
              return (
                <React.Fragment key={item.chassis_number || idx}>
                  <tr
                    className={`border-t border-[var(--border)] cursor-pointer transition-colors ${
                      isLowConf ? "bg-amber-50/50 dark:bg-amber-900/10" : "hover:bg-[var(--secondary)]/30"
                    }`}
                    onClick={() => toggleRowExpand(idx)}
                  >
                    <td className="py-3 px-2 text-center">
                      {isExpanded ? <ChevronDown size={14} className="text-[var(--secondary-foreground)]" /> : <ChevronRight size={14} className="text-[var(--secondary-foreground)]" />}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        {item.confidence != null && (
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getConfidenceColor(item.confidence) }} />
                        )}
                        <span className="font-medium text-[var(--foreground)]">{item.chassis_number}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-[var(--foreground)]">{item.brand || "-"}</td>
                    <td className="py-3 px-3 text-[var(--foreground)]">{item.lot_number || "-"}</td>
                    <td className="py-3 px-3 text-[var(--foreground)]">{item.auction_date || "-"}</td>
                    <td className="py-3 px-3 text-right font-bold text-[var(--primary)]">{formatCurrency(total)}</td>
                    <td className="py-3 px-2">
                      <button
                        onClick={e => { e.stopPropagation(); switchToDetailForChassis(item); }}
                        className="px-2 py-1 text-xs text-[var(--primary)] hover:bg-[var(--primary)]/10 rounded transition-colors"
                        title="Edit this vehicle in detail view"
                      >
                        <PenLine size={14} />
                      </button>
                    </td>
                  </tr>
                  {/* Expanded charge breakdown */}
                  {isExpanded && (
                    <tr>
                      <td colSpan="7" className="px-6 py-3 bg-[var(--background)]/50">
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                          {(item.charges || []).filter(c => c.amount != null && c.amount !== "" && c.amount !== "0").map((c, ci) => (
                            <div key={ci} className="flex items-center justify-between py-1 border-b border-[var(--border)]/30">
                              <span className="text-[var(--secondary-foreground)]">{c.type || "Unknown"}</span>
                              <span className="font-medium text-[var(--foreground)] flex items-center gap-1">
                                {formatCurrency(c.amount)}
                                {c.confidence != null && (
                                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: getConfidenceColor(c.confidence) }} />
                                )}
                              </span>
                            </div>
                          ))}
                          {(!item.charges || item.charges.length === 0) && (
                            <span className="text-[var(--muted-foreground)] col-span-2">No charges</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary mode footer */}
      <div className="mt-4 p-3 md:p-4 bg-[var(--background)] rounded-lg border border-[var(--border)] sticky bottom-0 bg-opacity-90 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="text-sm text-[var(--secondary-foreground)]">
            {editable.length} vehicle{editable.length !== 1 ? "s" : ""} •
            Total: <span className="font-bold text-[var(--foreground)]">{formatCurrency(editable.reduce((sum, v) => sum + calculateVehicleTotalCost(v.charges), 0))}</span>
          </div>
          <button
            onClick={saveCurrentPage}
            disabled={isLoading || editable.length === 0}
            className={`flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-md transition-opacity duration-200 ${
              isLoading ? "opacity-50 cursor-not-allowed" : ""
            } disabled:opacity-60 disabled:cursor-not-allowed`}
          >
            <Check size={16} />
            {isLoading ? "Saving..." : "Confirm All"}
          </button>
        </div>
      </div>
    </div>
  );
}
