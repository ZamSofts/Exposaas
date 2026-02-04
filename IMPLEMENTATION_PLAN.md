# Exposaas - Implementation Reference

> **Updated:** 2026-02-03
> **Status:** Vehicle Charges pipeline complete. See PLAN.md for feature status.

---

## Project Overview

**Exposaas** = AI-Native SaaS for Japanese car exporters.

Auction invoices (PDFs) -> Gemini AI extracts vehicle + charge data -> User reviews -> Vehicles created with costs.

### Tech Stack
- **Frontend/Backend**: Next.js 15 (Pages Router)
- **Database**: PostgreSQL (Prisma ORM)
- **Queue**: pg-boss (PostgreSQL-based)
- **Storage**: Azure Blob Storage
- **AI**: Google Gemini 2.5 Flash

---

## Current Architecture

### Process Flow
```
PDF Upload (addInvoice.js)
  -> invoice.mjs splits PDF into pages (pdf-lib)
  -> Each page uploaded to Azure Blob
  -> Each page queued as gemini-extract-page job

invoicePage.mjs processes pages sequentially:
  -> Download page from Azure
  -> Send to Gemini with extraction prompt
  -> Retry on 429 with exponential backoff
  -> Save extracted vehicles to InvoiceJob.Json

User reviews in InvoiceDataViewer:
  -> Edit charges, chassis numbers, brands
  -> "Create Vehicles" button -> upsert to Vehicle table
```

### Workers (run via concurrently in npm run dev)
| Worker | Queue | Purpose |
|--------|-------|---------|
| invoice.mjs | gemini-extract | Split PDF, create page jobs |
| invoicePage.mjs | gemini-extract-page | Process single page with Gemini |
| vehicle.mjs | vehicle | CSV upload processing |
| ws.mjs | send-notification | WebSocket notifications |

### Key Design Decisions
1. **Per-page processing**: Avoids Gemini accuracy loss on large PDFs
2. **Azure URLs in queue**: Only URL strings in pg-boss, not Base64 data
3. **Sequential Gemini calls**: teamConcurrency: 1 to avoid rate limits
4. **Silent upsert**: Existing vehicles get charges overwritten (no conflict UI)

---

## Development Commands

```bash
npm run dev          # Next.js + all workers + WebSocket
npx prisma db push   # Sync schema to DB (dev)
npx prisma studio    # GUI data viewer
```

---

## Key Files

See PLAN.md for complete file reference.

---

## Historical Notes

- PDF Splitter was initially reverted due to nested JSON bug, then reimplemented correctly
- Original approach sent full PDF to Gemini in one call, caused accuracy loss on 10+ page invoices
- invoiceAggregator.mjs (from original plan) was never needed — each page stores results independently
