import { CustomSelect } from "@/hooks/wrapper";

export default function VehicleBasicTab({
  name, setName,
  brandId, setBrandId, brand,
  chassisNumber, setChassisNumber,
  customerId, setCustomerId, customers,
  lotNumber, setLotNumber,
  auction, setAuction,
  remarks, setRemarks,
}) {
  return (
    <div>
      <h3 className="text-xl font-semibold text-[var(--foreground)] mb-6">Basic Information</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="input-label">Vehicle Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} className="input-style" placeholder="Enter vehicle name..." />
        </div>
        <div>
          <label className="input-label">Brand *</label>
          <CustomSelect data={brand} selectedId={brandId} setSelectedId={setBrandId} />
        </div>
        <div>
          <label className="input-label">Chassis Number *</label>
          <input type="text" value={chassisNumber} onChange={e => setChassisNumber(e.target.value)} className="input-style" placeholder="Enter chassis number..." />
        </div>
        <div>
          <label className="input-label">Customer</label>
          <CustomSelect data={customers} selectedId={customerId} setSelectedId={setCustomerId} placeholder="Select customer" />
        </div>
        <div>
          <label className="input-label">Lot Number</label>
          <input type="text" value={lotNumber} onChange={e => setLotNumber(e.target.value)} className="input-style" placeholder="Enter lot number..." />
        </div>
        <div>
          <label className="input-label">Auction</label>
          <input type="text" value={auction} onChange={e => setAuction(e.target.value)} className="input-style" placeholder="Enter auction..." />
        </div>
        <div className="col-span-1 md:col-span-3">
          <label className="input-label">Remarks</label>
          <textarea value={remarks} onChange={e => setRemarks(e.target.value)} className="input-style" placeholder="Enter remarks..." rows={3} />
        </div>
      </div>
    </div>
  );
}
