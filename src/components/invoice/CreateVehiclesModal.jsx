import { Car, Check, AlertTriangle } from "lucide-react";

export default function CreateVehiclesModal({
  vehiclesToCreate,
  createVehiclesLoading,
  onCreateVehicles,
  onSkip,
  calculateVehicleTotalCost,
  formatCurrency,
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-[var(--primary)]/10 rounded-lg">
            <Car className="w-6 h-6 text-[var(--primary)]" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-[var(--foreground)]">Create Vehicles from Invoice</h3>
            <p className="text-sm text-[var(--secondary-foreground)]">
              {vehiclesToCreate.length} vehicle{vehiclesToCreate.length !== 1 ? "s" : ""} found in this invoice
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-auto mb-4 border border-[var(--border)] rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-[var(--secondary)] sticky top-0">
              <tr>
                <th className="text-left py-3 px-4 font-semibold text-[var(--foreground)]">Chassis Number</th>
                <th className="text-left py-3 px-4 font-semibold text-[var(--foreground)]">Brand</th>
                <th className="text-left py-3 px-4 font-semibold text-[var(--foreground)]">Auction</th>
                <th className="text-left py-3 px-4 font-semibold text-[var(--foreground)]">Auction Date</th>
                <th className="text-left py-3 px-4 font-semibold text-[var(--foreground)]">Lot #</th>
                <th className="text-right py-3 px-4 font-semibold text-[var(--foreground)]">Total Cost</th>
              </tr>
            </thead>
            <tbody>
              {vehiclesToCreate.map((v, idx) => (
                <tr key={idx} className="border-t border-[var(--border)] hover:bg-[var(--secondary)]/30">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Car className="w-4 h-4 text-[var(--primary)]" />
                      <span className="font-medium text-[var(--foreground)]">{v.chassis_number}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-[var(--foreground)]">{v.brand || "-"}</td>
                  <td className="py-3 px-4 text-[var(--foreground)]">{v.auction || "-"}</td>
                  <td className="py-3 px-4 text-[var(--foreground)]">{v.auction_date || "-"}</td>
                  <td className="py-3 px-4 text-[var(--foreground)]">{v.lot_number || "-"}</td>
                  <td className="py-3 px-4 text-right font-bold text-[var(--primary)]">{formatCurrency(calculateVehicleTotalCost(v.charges))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mb-4 p-3 bg-[var(--primary)]/10 rounded-lg border border-[var(--primary)]/20 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-[var(--primary)] flex-shrink-0 mt-0.5" />
          <div className="text-sm text-[var(--foreground)]">
            <p className="font-medium">What will happen:</p>
            <ul className="mt-1 space-y-1 text-[var(--secondary-foreground)]">
              <li>* New vehicles will be created with charges from this invoice</li>
              <li>* Existing vehicles (same chassis) will be updated with new charge data</li>
              <li>* Invoice PDF will be linked to each vehicle</li>
            </ul>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onSkip}
            disabled={createVehiclesLoading}
            className="px-4 py-2 bg-[var(--secondary)] hover:bg-[var(--border)] text-[var(--secondary-foreground)] rounded-lg font-medium transition-all duration-200"
          >
            Skip
          </button>
          <button
            onClick={onCreateVehicles}
            disabled={createVehiclesLoading || vehiclesToCreate.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg font-medium transition-all duration-200 disabled:opacity-50"
          >
            {createVehiclesLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Creating...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Create {vehiclesToCreate.length} Vehicle{vehiclesToCreate.length !== 1 ? "s" : ""}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
