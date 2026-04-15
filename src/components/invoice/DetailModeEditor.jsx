import { Trash2 } from "lucide-react";
import { CONFIDENCE_COLORS, getConfidenceLevel, getAccuracyColor as getConfidenceColor, getConfidenceBorder } from "@/config/aiConstants";
import { AUCTION_VENUES } from "@/config/auctionVenues";

// "2025/05/23" or "2025-05-23" → "2025-05-23" (for type="date" input value)
function toDateInputValue(val) {
  if (!val) return "";
  return String(val).replace(/\//g, "-");
}

// "2025-05-23" → "2025/05/23" (preserve existing storage format)
function toSlashDate(val) {
  if (!val) return "";
  return String(val).replace(/-/g, "/");
}

export default function DetailModeEditor({
  editable,
  selectedChassis,
  handleSelectChassis,
  handleFieldChange,
  handleChargeChange,
  addCharge,
  removeCharge,
  saveCurrentPage,
  isLoading,
  selectedIndexInPage,
  goToPrevChassis,
  goToNextChassis,
}) {
  return (
    <>
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium text-[var(--foreground)]">Chassis Numbers</div>
          <div className="text-xs text-[var(--secondary-foreground)]">{editable.length} items</div>
        </div>
        <div className="flex gap-2 justify-between flex-wrap">
          {editable.length === 0 && (
            <div className="text-sm text-[var(--secondary-foreground)] bg-[var(--background)] p-3 rounded-lg border border-dashed border-[var(--border)] w-full text-center">
              No chassis found on this page
            </div>
          )}

          <div>
            {editable.map(item => {
              const isSelected = selectedChassis && selectedChassis.chassis_number === item.chassis_number;
              return (
                <button
                  key={item.chassis_number}
                  onClick={() => handleSelectChassis(item)}
                  className={`relative px-4 py-2 m-1 border rounded-lg text-xs font-medium transition-all duration-200 min-w-[120px] ${
                    isSelected
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)] shadow-md scale-105"
                      : "bg-[var(--background)] text-[var(--secondary-foreground)] border-[var(--border)] hover:bg-[var(--secondary)] hover:border-[var(--primary)]/30 hover:shadow-sm"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {item.confidence != null && (
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getConfidenceColor(item.confidence) }} />
                    )}
                    {item.chassis_number}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2 align-middle mt-2 justify-end w-full">
          <button onClick={goToPrevChassis} disabled={selectedIndexInPage <= 0} className="px-3 py-2 bg-[var(--surface)] border w-20 border-[var(--border)] rounded-md disabled:opacity-50">
            Previous
          </button>
          <button
            onClick={goToNextChassis}
            disabled={selectedIndexInPage < 0 || selectedIndexInPage >= editable.length - 1}
            className="px-3 w-20 py-2 bg-[var(--primary)] border border-[var(--border)] rounded-md disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {/* Editable table for selected chassis */}
      {selectedChassis ? (
        <div className="bg-[var(--background)] p-4 md:p-6 rounded border flex flex-col">
          <div className="flex items-center justify-between">
            <div className="font-medium flex items-center gap-2">
              {selectedChassis.chassis_number}
              {selectedChassis.confidence != null && (
                <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: CONFIDENCE_COLORS[getConfidenceLevel(selectedChassis.confidence)]?.bg, color: getConfidenceColor(selectedChassis.confidence) }}>
                  {Math.round(selectedChassis.confidence * 100)}%
                </span>
              )}
            </div>
            <div className="text-sm text-[var(--secondary-foreground)]">Edit charges</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <div>
              <label className="text-xs text-[var(--secondary-foreground)]">Chassis Number</label>
              <input
                value={selectedChassis.chassis_number || ""}
                onChange={e => handleFieldChange(selectedChassis.chassis_number, "chassis_number", e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-[var(--border)] rounded-md bg-[var(--surface)] text-[var(--foreground)]"
                style={getConfidenceBorder(selectedChassis.confidence)}
                title={selectedChassis.confidence != null ? `AI confidence: ${Math.round(selectedChassis.confidence * 100)}%` : undefined}
              />
            </div>
            <div>
              <label className="text-xs text-[var(--secondary-foreground)]">Brand</label>
              <input
                value={selectedChassis.brand || ""}
                onChange={e => handleFieldChange(selectedChassis.chassis_number, "brand", e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-[var(--border)] rounded-md bg-[var(--surface)] text-[var(--foreground)]"
                style={getConfidenceBorder(selectedChassis.confidence)}
                title={selectedChassis.confidence != null ? `AI confidence: ${Math.round(selectedChassis.confidence * 100)}%` : undefined}
              />
            </div>
            <div>
              <label className="text-xs text-[var(--secondary-foreground)]">Lot Number</label>
              <input
                value={selectedChassis.lot_number || ""}
                onChange={e => handleFieldChange(selectedChassis.chassis_number, "lot_number", e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-[var(--border)] rounded-md bg-[var(--surface)] text-[var(--foreground)]"
                style={getConfidenceBorder(selectedChassis.confidence)}
                title={selectedChassis.confidence != null ? `AI confidence: ${Math.round(selectedChassis.confidence * 100)}%` : undefined}
              />
            </div>
            <div>
              <label className="text-xs text-[var(--secondary-foreground)]">Auction</label>
              <input
                list="auction-venues-list"
                value={selectedChassis.auction || ""}
                onChange={e => handleFieldChange(selectedChassis.chassis_number, "auction", e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-[var(--border)] rounded-md bg-[var(--surface)] text-[var(--foreground)]"
                style={getConfidenceBorder(selectedChassis.confidence)}
                title={selectedChassis.confidence != null ? `AI confidence: ${Math.round(selectedChassis.confidence * 100)}%` : undefined}
                placeholder="会場名を選択または入力"
              />
              <datalist id="auction-venues-list">
                {AUCTION_VENUES.map(v => <option key={v} value={v} />)}
              </datalist>
            </div>
            <div>
              <label className="text-xs text-[var(--secondary-foreground)]">Auction Date</label>
              <input
                type="date"
                value={toDateInputValue(selectedChassis.auction_date)}
                onChange={e => handleFieldChange(selectedChassis.chassis_number, "auction_date", toSlashDate(e.target.value))}
                className="w-full mt-1 px-3 py-2 border border-[var(--border)] rounded-md bg-[var(--surface)] text-[var(--foreground)]"
                style={getConfidenceBorder(selectedChassis.confidence)}
                title={selectedChassis.confidence != null ? `AI confidence: ${Math.round(selectedChassis.confidence * 100)}%` : undefined}
              />
            </div>
          </div>

          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm mb-4 border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left py-3 px-2 font-semibold text-[var(--foreground)] bg-[var(--secondary)]/20">Charge Type</th>
                  <th className="text-left py-3 px-2 font-semibold text-[var(--foreground)] bg-[var(--secondary)]/20">Amount</th>
                  <th className="text-left py-3 px-2 font-semibold text-[var(--foreground)] bg-[var(--secondary)]/20 w-20">Action</th>
                </tr>
              </thead>
              <tbody>
                {(selectedChassis.charges || []).map((c, i) => (
                  <tr key={i} className="border-b border-[var(--border)]/50 hover:bg-[var(--secondary)]/10 transition-colors">
                    <td className="py-3 px-2">
                      <input
                        value={c.type || ""}
                        onChange={e => handleChargeChange(selectedChassis.chassis_number, i, "type", e.target.value)}
                        className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-[var(--surface)] text-[var(--foreground)]"
                        placeholder="Enter charge type"
                      />
                    </td>
                    <td className="py-3 px-2">
                      <input
                        value={c.amount ?? ""}
                        onChange={e => handleChargeChange(selectedChassis.chassis_number, i, "amount", e.target.value)}
                        className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-[var(--surface)] text-[var(--foreground)]"
                        style={getConfidenceBorder(c.confidence)}
                        placeholder="0.00"
                        title={c.confidence != null ? `AI confidence: ${Math.round(c.confidence * 100)}%` : undefined}
                      />
                    </td>
                    <td className="py-3 px-2">
                      <button onClick={() => removeCharge(selectedChassis.chassis_number, i)} className="text-xs text-red-600 hover:underline">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}

                {(!selectedChassis.charges || selectedChassis.charges.length === 0) && (
                  <tr>
                    <td colSpan="3" className="py-8 text-center text-[var(--secondary-foreground)]">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 bg-[var(--secondary)] rounded-full flex items-center justify-center">
                          <span className="text-xs">$</span>
                        </div>
                        <p>No charges found for this chassis</p>
                      </div>
                    </td>
                  </tr>
                )}

                <tr>
                  <td colSpan="3" className="py-3 px-2 text-right">
                    <button onClick={() => addCharge(selectedChassis.chassis_number)} className="px-3 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-md text-sm">
                      + Add Charge
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-2 p-3 md:p-4 bg-[var(--background)] rounded-lg border border-[var(--border)] sticky bottom-0 bg-opacity-90 backdrop-blur-sm">
            <div className="flex items-center justify-end">
              <button
                onClick={saveCurrentPage}
                disabled={isLoading || editable.length === 0}
                className={`px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-md transition-opacity duration-200 ${
                  isLoading ? "opacity-50 cursor-not-allowed" : ""
                } disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                {isLoading ? "Saving..." : "Save & Continue"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-sm text-[var(--secondary-foreground)]">Select a chassis to see and edit charges.</div>
      )}
    </>
  );
}
