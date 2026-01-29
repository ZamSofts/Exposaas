# Plan: Vehicle Charges Feature

## What We're Building

**Goal:** Store vehicle acquisition costs (bid, fees, taxes) so users can see total cost per vehicle.

**Two ways data enters:**
1. **PDF Invoice** → AI extracts → Review → Save → Vehicles created with charges
2. **CSV Upload** → Parse columns → Vehicles created/updated with charges

---

## Approach: Add Charge Columns to Vehicle Table

**Why columns (not separate table):**
- Simpler (no new tables, no joins needed)
- Faster queries (direct column access)
- Matches Excel mental model (users scroll left-right)
- All auctions use same ~10 fee types
- CSV import maps directly to columns

**New columns on Vehicle:**
| Column | Type | CSV Header | Description |
|--------|------|------------|-------------|
| bidAmount | Decimal | `bid_amount` | Vehicle winning bid |
| bidTax | Decimal | `bid_tax` | Tax on bid |
| auctionFee | Decimal | `auction_fee` | Auction commission |
| auctionTax | Decimal | `auction_tax` | Tax on auction fee |
| insuranceFee | Decimal | `insurance_fee` | Mandatory insurance (自賠責) |
| insuranceTax | Decimal | `insurance_tax` | Tax on insurance |
| recyclingFee | Decimal | `recycling_fee` | Recycling deposit |
| transportFee | Decimal | `transport_fee` | Transport/delivery |
| otherFees | Decimal | `other_fees` | Misc charges |
| totalCost | Decimal | (calculated) | Sum of all charges |
| sourceInvoiceJobId | Int? | - | Links to original invoice (audit trail) |

---

## Implementation Steps

### Phase 1: Database ✅ DONE
- [x] Add charge columns to Vehicle model in `prisma/schema.prisma`
- [x] Add relation to InvoiceJobs for sourceInvoiceJobId
- [x] Run migration: `npx prisma migrate dev --name add-vehicle-charges`
- [ ] **TEST:** Open Prisma Studio (`npx prisma studio`), verify columns exist on Vehicle table

### Phase 2: API - Vehicle Endpoints ✅ DONE
- [x] Update GET `/api/vehicle` to include charge columns in response
- [x] Update PUT `/api/vehicle` to accept charge fields when creating
- [x] Update POST `/api/vehicle` to accept charge fields when updating
- [x] Add totalCost calculation helper (sum all charge fields)
- [ ] **TEST:** API returns charge fields in response

### Phase 3: CSV Worker Update ✅ DONE
- [x] Update `extra/workers/vehicle.mjs` to parse charge columns
- [x] Map CSV headers: `bid_amount` → `bidAmount`, etc.
- [x] Calculate totalCost on import
- [ ] **TEST:** Upload CSV with charge columns, verify data saved

### Phase 4: Frontend - Vehicle Page ✅ DONE (Updated to Option A - Full Wide Table)
- [x] Add ALL charge columns to vehicle table (like Airtable/Nocodb reference)
- [x] Columns: Chassis, Brand, Auction, Lot#, Invoice, Bid, Bid Tax, Auction Fee, Auction Tax, Insurance, Ins. Tax, Recycling, Transport, Other, Total Cost, Status
- [x] Invoice column shows PDF icon linking to source document
- [x] Format amounts with ¥ symbol
- [x] Compact padding for wide table
- [ ] **TEST:** See all charges in vehicle list, scroll horizontally

### Phase 5: Frontend - Invoice Integration ✅ DONE
- [x] Create POST `/api/createVehiclesFromInvoice` - bulk create from invoice data
- [x] Add modal to InvoiceDataViewer after "Save"
- [x] Modal shows: "Create X vehicles from this invoice?"
- [x] User reviews chassis + charges before confirming
- [x] Handle duplicate chassis (updates existing vehicle with new charges)
- [x] Sets `sourceInvoiceJobId` to link vehicle back to invoice PDF
- [ ] **TEST:** Full flow - Upload PDF → Review → Save → Create Vehicles → See in table with PDF icon

### Phase 6: Edit Vehicle ✅ DONE
- [x] Add charge fields to EditVehicle.jsx (new Charges tab)
- [x] User can manually edit charges
- [x] Auto-calculate totalCost when charges change
- [ ] **TEST:** Create/edit vehicle with charges, verify saved correctly

---

## Files to Modify

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add charge columns to Vehicle model |
| `src/pages/api/vehicle.js` | Include charges in GET/PUT/POST |
| `src/pages/api/createVehiclesFromInvoice.js` | NEW - bulk create from invoice |
| `extra/workers/vehicle.mjs` | Parse charge columns from CSV |
| `src/pages/vehicle.jsx` | Add charge columns to table |
| `src/components/EditVehicle.jsx` | Add charge fields section |
| `src/components/InvoiceDataViewer.jsx` | Add modal after save |

---

## CSV Format (After Implementation)

**Example CSV with charges:**
```csv
chassis_number,brand,auction,lot_number,bid_amount,bid_tax,auction_fee,auction_tax,insurance_fee,recycling_fee
GP5-30661,Honda,HAA,7122,500000,50000,30000,3000,23000,13000
DA63T-248,Suzuki,USS,60238,350000,35000,25000,2500,23000,10000
```

**Existing CSVs still work** - charge columns are optional, will be null if missing.

---

## UI Preview

**Vehicle List (Option A - Full Wide Table with horizontal scroll):**
```
| ID  | Chassis       | Brand  | Auction | Lot# | Invoice | Bid      | Bid Tax | Auction Fee | Auction Tax | Insurance | Ins. Tax | Recycling | Transport | Other | Total     | Status   | Registered |
|-----|---------------|--------|---------|------|---------|----------|---------|-------------|-------------|-----------|----------|-----------|-----------|-------|-----------|----------|------------|
| 001 | GP5-30661     | Honda  | HAA     | 7122 | [PDF]   | ¥500,000 | ¥50,000 | ¥30,000     | ¥3,000      | ¥23,000   | -        | ¥13,000   | -         | -     | ¥619,000  | In Stock | 2026-01-29 |
| 002 | DA63T-248     | Suzuki | USS     | 6023 | [PDF]   | ¥350,000 | ¥35,000 | ¥25,000     | ¥2,500      | ¥23,000   | -        | ¥10,000   | -         | -     | ¥445,500  | In Stock | 2026-01-29 |
```

**Note:** Horizontal scroll enabled. Invoice column shows PDF icon linking to source document.

---

## Data Flow Diagram

```
                    ┌─────────────────┐
                    │   PDF Invoice   │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Gemini AI      │
                    │  (extracts data)│
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Invoice Review  │
                    │ (user verifies) │
                    └────────┬────────┘
                             │
          ┌──────────────────┴──────────────────┐
          │                                      │
          ▼                                      ▼
┌─────────────────┐                    ┌─────────────────┐
│  CSV Upload     │                    │ "Create         │
│  (direct import)│                    │  Vehicles"      │
└────────┬────────┘                    │  Modal          │
         │                             └────────┬────────┘
         │                                      │
         └──────────────────┬───────────────────┘
                            │
                            ▼
                   ┌─────────────────┐
                   │    Vehicle      │
                   │    Table        │
                   │ (with charges)  │
                   └─────────────────┘
```

---

## Session Log

### Session 1 - 2026-01-23
- Created original plan with separate VehicleCharge table

### Session 2 - 2026-01-29
- Reviewed codebase for spaghetti risk
- Decided: Columns approach is simpler & better for this use case
- Updated plan to Option B (columns on Vehicle table)
- Renamed file from `VEHICLE_CHARGES_PROGRESS.md` to `PLAN_VEHICLE_CHARGES.md`
- Reviewed existing CSV upload system (`extra/workers/vehicle.mjs`)
- Added Phase 3: CSV Worker Update to support charge columns
- **UI Decision:** Changed from "3 columns + Charges tab" to **Option A: Full Wide Table**
  - Shows ALL 9 charge columns inline (like user's Airtable/Nocodb reference)
  - Added Invoice PDF column with clickable icon
  - Matches Excel mental model - no clicks needed to see charges
  - Keep Charges tab in EditVehicle for focused editing

---

## Notes

- Existing vehicles will show empty charges (null) - that's fine
- Existing CSVs without charge columns still work (backward compatible)
- PaymentConfirmation table unchanged (keeps working as backup/audit)
- If rare auction has unusual fee → put in `otherFees`
- `totalCost` calculated on save (sum of all charge fields)
- Column names in DB use camelCase (`bidAmount`), CSV uses snake_case (`bid_amount`)
