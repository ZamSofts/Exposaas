export default function VehicleLogisticsTab({
  auctionDate, setAuctionDate,
  sessionField, setSessionField,
  transportCompany, setTransportCompany,
  deliverTo, setDeliverTo,
  numberPlate, setNumberPlate,
  titleTransferDeadline, setTitleTransferDeadline,
  containerNumber, setContainerNumber,
  etd, setEtd,
  documentStatus, setDocumentStatus,
  memo, setMemo,
}) {
  return (
    <div>
      <h3 className="text-xl font-semibold text-[var(--foreground)] mb-6">Logistics & Metadata</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="input-label">Auction Date</label>
          <input type="date" value={auctionDate} onChange={e => setAuctionDate(e.target.value)} className="input-style" placeholder="e.g., 2025/06/09" />
        </div>
        <div>
          <label className="input-label">Session</label>
          <input type="text" value={sessionField} onChange={e => setSessionField(e.target.value)} className="input-style" placeholder="e.g., 885" />
        </div>
        <div>
          <label className="input-label">Transportation Company</label>
          <input type="text" value={transportCompany} onChange={e => setTransportCompany(e.target.value)} className="input-style" placeholder="Enter transport company..." />
        </div>
        <div>
          <label className="input-label">Deliver To</label>
          <input type="text" value={deliverTo} onChange={e => setDeliverTo(e.target.value)} className="input-style" placeholder="Delivery destination..." />
        </div>
        <div>
          <label className="input-label">Number Plate</label>
          <input type="text" value={numberPlate} onChange={e => setNumberPlate(e.target.value)} className="input-style" placeholder="Vehicle plate number..." />
        </div>
        <div>
          <label className="input-label">Title Transfer Deadline</label>
          <input type="date" value={titleTransferDeadline} onChange={e => setTitleTransferDeadline(e.target.value)} className="input-style" />
        </div>
        <div>
          <label className="input-label">Container Number</label>
          <input type="text" value={containerNumber} onChange={e => setContainerNumber(e.target.value)} className="input-style" placeholder="Shipping container #..." />
        </div>
        <div>
          <label className="input-label">ETD (Estimated Departure)</label>
          <input type="text" value={etd} onChange={e => setEtd(e.target.value)} className="input-style" placeholder="e.g., Feb 2025" />
        </div>
        <div>
          <label className="input-label">Document Status</label>
          <input type="text" value={documentStatus} onChange={e => setDocumentStatus(e.target.value)} className="input-style" placeholder="e.g., Received, Pending..." />
        </div>
        <div>
          <label className="input-label">Memo</label>
          <input type="text" value={memo} onChange={e => setMemo(e.target.value)} className="input-style" placeholder="Notes..." />
        </div>
      </div>
    </div>
  );
}
