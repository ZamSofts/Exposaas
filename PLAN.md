# PLAN.md - Vehicle Charges Feature

> **Created:** 2026-02-03
> **Updated:** 2026-02-03
> **Status:** All core features complete. Vehicle Charges pipeline is fully operational.

---

## Feature Status

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | DB Schema | Done | Charge columns on Vehicle table |
| 2 | CSV Worker | Done | `vehicle.mjs` maps charge headers from CSV |
| 3 | PDF Splitter | Done | `pdfSplitter.mjs` splits pages, uploads to Azure |
| 4 | Gemini Worker | Done | Per-page processing via `invoicePage.mjs` with retry/backoff |
| 5 | Smart Matcher | Done | `createVehiclesFromInvoice.js` upserts vehicles with charges |
| 6 | Document Categorization | Dropped | No business need — users upload docs without categories |
| 7 | UI Table Updates | Done | `vehicle.jsx` shows all charge columns with currency formatting |
| 8 | Conflict Review UI | Deferred | Current behavior: silently overwrites charges on upsert. Revisit only if same vehicle appears in multiple invoices. |
| 9 | Multi-PDF Upload | Dropped | Sequential upload works. Batch upload is a nice-to-have, not a need. |
| 10 | Cleanup Old Columns | Dropped | No deprecated columns exist in schema. |

---

## Working Data Flow

```
User uploads PDF
       |
addInvoice.js -> Queue: gemini-extract
       |
invoice.mjs:
  1. Download PDF from Azure
  2. Split into pages (pdfSplitter.mjs)
  3. Upload each page to Azure (invoices/job_X/page_N.pdf)
  4. Create InvoiceJob per page (status: pending)
  5. Queue each page -> gemini-extract-page
       |
invoicePage.mjs (sequential, teamConcurrency: 1):
  1. Download single-page PDF from Azure
  2. Send to Gemini 2.5 Flash
  3. Retry with exponential backoff on 429
  4. Save result to InvoiceJob.Json = { items: [...] }
  5. Send notification on completion
       |
InvoiceJobs page -> Click "Review"
       |
InvoiceDataViewer -> Edit extracted data
       |
"Create Vehicles" button -> Modal preview
       |
createVehiclesFromInvoice.js:
  - Existing vehicle (same chassis) -> Update with charges
  - New vehicle -> Create with charges
  - Auto-calculates totalCost
  - Links via sourceInvoiceJobId
       |
Vehicle table shows all charges
```

---

## Key Files

### Workers (background processing)
| File | Purpose |
|------|---------|
| `extra/workers/invoice.mjs` | PDF split + queue pages |
| `extra/workers/invoicePage.mjs` | Per-page Gemini extraction |
| `extra/workers/geminiProcess.mjs` | Gemini API call + retry logic |
| `extra/workers/vehicle.mjs` | CSV upload processor |
| `extra/utils/pdfSplitter.mjs` | PDF split + Azure upload |

### API Routes
| File | Purpose |
|------|---------|
| `src/pages/api/addInvoice.js` | PDF upload entry point |
| `src/pages/api/InvoiceJobs.js` | Invoice jobs CRUD + retry |
| `src/pages/api/createVehiclesFromInvoice.js` | Invoice -> Vehicle creation |
| `src/pages/api/vehicle.js` | Vehicle CRUD |

### Frontend
| File | Purpose |
|------|---------|
| `src/pages/InvoiceJobs.jsx` | Invoice jobs list |
| `src/components/InvoiceDataViewer.jsx` | Review + edit + create vehicles modal |
| `src/pages/vehicle.jsx` | Vehicle table with charge columns |

### Schema
| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Vehicle charge columns, InvoiceJobs with page tracking |

---

## Charge Columns on Vehicle

```
bidAmount, bidTax, auctionFee, recyclingFee,
transportFee, otherFees, taxProration,
totalCost, sourceInvoiceJobId
```

All `Decimal(12,2)`, nullable. `totalCost` is auto-calculated sum on creation.

---

## Architecture Decisions

1. **Per-page processing** (not all-at-once): Each PDF page gets its own InvoiceJob row and Gemini call. Avoids accuracy loss on large PDFs.
2. **Azure URLs in queue** (not Base64): Page PDFs stored in Azure Blob, only URL strings pass through pg-boss. Keeps DB lightweight.
3. **Sequential Gemini calls** (teamConcurrency: 1): Avoids 429 rate limits. Retry with exponential backoff built in.
4. **Silent upsert on vehicle creation**: If chassis exists, charges are overwritten. No conflict UI — works for single-invoice-per-vehicle workflow.

---

## Next Steps

Decide what to build next. Options:

- [ ] Payment deadline tracking (auto-calculate due dates per auction rules)
- [ ] Customer billing (CustomerCharge — what customers pay, separate from acquisition costs)
- [ ] Reporting / dashboard (cost summaries, profit margins)
- [ ] Any other workflow from strategy.md
