// Format currency for display
const formatCurrencyDisplay = value => {
  if (value === null || value === undefined || value === "") return "";
  const num = parseFloat(value);
  if (isNaN(num)) return "";
  return `¥${num.toLocaleString()}`;
};

export default function VehicleChargesTab({
  bidAmount, setBidAmount,
  auctionFee, setAuctionFee,
  insuranceFee, setInsuranceFee,
  recyclingFee, setRecyclingFee,
  transportFee, setTransportFee,
  otherFees, setOtherFees,
  calculateTaxSum,
  calculateTotalCost,
}) {
  return (
    <div>
      <h3 className="text-xl font-semibold text-[var(--foreground)] mb-6">Acquisition Charges</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="input-label">Bid Amount</label>
          <input type="number" value={bidAmount} onChange={e => setBidAmount(e.target.value)} className="input-style" placeholder="0" />
        </div>
        <div>
          <label className="input-label">Auction Fee</label>
          <input type="number" value={auctionFee} onChange={e => setAuctionFee(e.target.value)} className="input-style" placeholder="0" />
        </div>
        <div>
          <label className="input-label">Insurance Fee</label>
          <input type="number" value={insuranceFee} onChange={e => setInsuranceFee(e.target.value)} className="input-style" placeholder="0" />
        </div>
        <div>
          <label className="input-label">Recycling Fee</label>
          <input type="number" value={recyclingFee} onChange={e => setRecyclingFee(e.target.value)} className="input-style" placeholder="0" />
        </div>
        <div>
          <label className="input-label">Transport Fee</label>
          <input type="number" value={transportFee} onChange={e => setTransportFee(e.target.value)} className="input-style" placeholder="0" />
        </div>
        <div>
          <label className="input-label">Other Fees</label>
          <input type="number" value={otherFees} onChange={e => setOtherFees(e.target.value)} className="input-style" placeholder="0" />
        </div>
      </div>

      {/* Total Cost & Tax Sum Display */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-[var(--primary)]/10 rounded-lg border border-[var(--primary)]/20">
          <div className="flex items-center justify-between">
            <span className="text-lg font-medium text-[var(--foreground)]">Total Acquisition Cost</span>
            <span className="text-2xl font-bold text-[var(--primary)]">{formatCurrencyDisplay(calculateTotalCost())}</span>
          </div>
        </div>
        <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
          <div className="flex items-center justify-between">
            <span className="text-lg font-medium text-[var(--foreground)]">Tax Sum</span>
            <span className="text-2xl font-bold text-yellow-600">{formatCurrencyDisplay(calculateTaxSum())}</span>
          </div>
        </div>
      </div>

      <p className="text-xs text-[var(--secondary-foreground)] mt-4">
        These charges represent the acquisition costs for this vehicle. Total cost and tax sum are calculated automatically.
      </p>
    </div>
  );
}
