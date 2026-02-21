# Exposaas Context

## WHY: AI-Native Architecture

**Problem:** Japanese car exporters manually copy data from auction invoices (PDFs) into Excel. Time-consuming, error-prone.

**Why AI-Native (not traditional SaaS):**
- Invoices are **unstructured** (PDFs, not forms) → Need AI extraction
- **Event-driven** (async processing) → Users don't wait for Gemini
- **Human-in-the-loop** → AI isn't 100% accurate, needs verification
- **Learning system** → Feedback improves extraction over time

**Why this matters for you:**
- Don't build CRUD forms for invoice data - users upload PDFs
- Don't expect synchronous responses - use job queues (pg-boss)
- Always include verification UI - never auto-save AI outputs without review

## WHAT: Tech Stack

**Stack:** Next.js 15, Prisma (PostgreSQL), pg-boss, Azure Blob, Gemini AI

**Why these choices:**
- **Next.js** - Full-stack (API + UI in one repo)
- **Prisma** - Type-safe DB, easy migrations
- **pg-boss** - PostgreSQL-based queue (no Redis needed)
- **Multi-tenant** - One codebase serves many companies (companyId isolation)

**Key Directories:**
- `src/pages/` - Next.js pages & API routes
- `src/config/` - Shared constants (aiConstants.js, vehicleColumns.js)
- `src/components/` - React components (InvoiceDataViewer, DocumentViewer, EditVehicle, etc.)
- `src/hooks/` - Custom hooks (useAuth, useTheme, useFileUpload, wrapper.js barrel)
- `src/lib/` - Server utilities (useful.js, blob.mjs, auth.js, db.js)
- `extra/workers/` - Background jobs (5 workers: vehicle, invoice, invoicePage, classifyDocument, documentExtract)
- `extra/ai/` - AI extraction pipeline (schema, promptBuilder, optimizer, classificationSchema, documentSchemas)
- `extra/utils/` - Shared utilities (computeDiff, chargeMapping, pdfSplitter, fewShotExamples, promptEvaluator, promptGenerator, auditLog)
- `extra/queues/` - pg-boss queue initializers (pgBoss, pdfInvoice, vehicle)
- `prisma/` - Database schema

## HOW: Working on This Project

**Development:**
```bash
npm run dev  # Starts Next.js + 5 workers (vehicle, invoice, invoicePage, classifyDocument, documentExtract)
```

**Database changes:**
```bash
npx prisma db push         # Sync schema to DB (dev)
npx prisma generate        # Regenerate Prisma client
npx prisma studio          # View data
```

**Testing AI extraction:**
1. Upload test PDF at `/documents`
2. Check classification + extraction in Documents page
3. For invoices: review in InvoiceDataViewer, create vehicles
4. For certs: review in DocumentViewer, link to vehicles

**Bash Guidelines:**
- Avoid commands that cause output buffering issues
- DO NOT pipe output through `head`, `tail`, `less`, or `more` when monitoring or checking command output
- DO NOT use `| head -n X` or `| tail -n X` to truncate output - these cause buffering problems
- Instead, let commands complete fully, or use `--max-lines` flags if the command supports them
- For log monitoring, prefer reading files directly rather than piping through filters
- Run commands directly without pipes when possible
- If you need to limit output, use command-specific flags (e.g., `git log -n 10` instead of `git log | head -10`)
- Avoid chained pipes that can cause output to buffer indefinitely

---

## Full Feature List (19 features)

### Core Business Features

**1. AI Invoice Extraction Pipeline (Gemini)**
PDF → page split → per-page Gemini 2.5 Flash extraction. Dynamic prompt (schema constraints + PromptVersion instructions + few-shot examples). Rate limit retry with exponential backoff.
- Workers: `invoice.mjs` → `invoicePage.mjs` → `geminiProcess.mjs`
- AI: `schema.mjs`, `promptBuilder.mjs`
- Queue: `pdfInvoice.mjs` → "gemini-extract" → "gemini-extract-page"

**2. Unified Document Classification & Extraction**
Two-stage pipeline: Classification (page 1 only, cheap) → type-specific extraction. 5 types: invoice, export_cert, inspection_cert, temp_cancel, unknown. Auto-links to vehicles by chassis number.
- Workers: `classifyDocument.mjs`, `documentExtract.mjs`
- AI: `classificationSchema.mjs`, `documentSchemas.mjs`
- UI: `documents.jsx` (upload), `DocumentViewer.jsx` (cert review + vehicle linking)
- API: `addDocument.js` (unified upload), `linkDocumentToVehicle.js`

**3. Invoice Review (Human-in-the-Loop)**
Split PDF viewer + extracted data table. Summary/detail review modes. Confidence colors (green ≥85%, amber ≥60%, red <60%). Save with diff recording. Create vehicles from reviewed data. Mark records as golden.
- UI: `InvoiceDataViewer.jsx`, `SaveResultModal.jsx`, `InvoiceJobs.jsx`
- API: `paymentConfirmation.js`, `createVehiclesFromInvoice.js`

**4. AI Learning Loop (Staged Optimization)**
Extraction accuracy improves automatically as users review invoices. Three-stage approach:

**Stage 1 — Few-Shot Driven:** User corrections → diff → golden records → few-shot selection feeds correct examples into next extraction. More golden data = better few-shot = better accuracy. No optimizer needed.
- Utils: `fewShotExamples.mjs` (tier-based fallback preserved), `computeDiff.mjs`

**Stage 2 — Embedding Few-Shot (Current ✅):** Few-shot examples selected by Gemini Embedding API cosine similarity instead of auction-name matching. Golden records auto-embedded on toggle. SaveResultModal prompts users to add to training data after every review (both exact_match and corrected).
- Utils: `embedding.mjs` (Gemini gemini-embedding-001, cosine similarity, backfill), `fewShotExamples.mjs` (embedding-first, tier fallback)
- UI: `SaveResultModal.jsx` (soft HITL golden prompt on every save)

**Stage 3 — DSPy MIPROv2 (Future, 100+ golden records):** Introduce Python sidecar running DSPy's MIPROv2 optimizer. Simultaneously optimizes few-shot selection + instruction text via Bayesian optimization. Only worthwhile with 100+ golden records (currently 33).
- Reference: [DSPy](https://dspy.ai/), MIPROv2 optimizer

**Existing infrastructure (usable across all stages):**
- AI: `optimizer.mjs` (OPRO-style meta-prompting, available but expensive — 99+ Gemini calls per run)
- Utils: `computeDiff.mjs`, `promptEvaluator.mjs`, `promptGenerator.mjs`
- UI: `/accuracy`, `/prompts`, `/evaluation`
- Config: `aiConstants.js` (thresholds: HIGH=0.85, MID=0.60)

**5. Vehicle Management (Spreadsheet UI)**
31-column spreadsheet with inline editing (number, text, date, dropdown, combobox). Row virtualization (tanstack/react-virtual). Brand/Customer comboboxes support auto-creation. Full CRUD via modal (EditVehicle) or inline.
- UI: `vehicle.jsx`, `VehicleRow.jsx`, `EditVehicle.jsx` (6 tabs: Basic/Charges/Logistics/Documents/Payments/History)
- Config: `vehicleColumns.js` (31 columns, filter operators)
- API: `vehicle.js`, `vehicleInlineUpdate.js`, `vehicleSuggestions.js`

**6. Lark Base-Style Filtering**
Multi-condition filter panel with AND/OR conjunction. Operators vary by field type. Server-side `buildFilterWhere` converts filter JSON to Prisma where clauses.
- UI: `VehicleFilters.jsx`
- Config: `vehicleColumns.js` (FILTER_OPERATORS, FILTERABLE_COLUMNS)

**7. Vehicle Charges & Tax Calculation**
6 charge columns (bidAmount, auctionFee, insuranceFee, recyclingFee, transportFee, otherFees). Tax = 10% on all except recyclingFee (tax-exempt). Shared calculation across inline update, vehicle creation, and CSV import.
- Utils: `chargeMapping.mjs` (CHARGE_TYPE_MAP, calculateTaxAndTotal)

**8. CSV Vehicle Import**
Upload CSV via `addDocument` API → pg-boss "vehicle" queue. csv-parser, batch-upsert (50/tx), brand/customer auto-create with race condition protection.
- Worker: `vehicle.mjs`
- Utils: `chargeMapping.mjs` (parseChargeFieldsFromFlat, parseMetadataFromCSV)

**9. Vehicle Payments**
Per-vehicle payment CRUD with file attachment (PDF/JPG/PNG/DOC/DOCX, max 5MB). Accessible via EditVehicle → Payments tab.
- UI: `Payments.jsx` (inside EditVehicle)
- API: `vehiclePayments.js`

### Management Features

**10. Authentication & Authorization**
NextAuth credentials provider, JWT 30-day sessions. API middleware enforces per-endpoint permission checks. Sadmin bypass.
- Files: `auth.js`, `middleware.js`, `useAuth.js`, `index.jsx` (login → `/vehicle` redirect)

**11. Multi-Tenant Company Management**
Company CRUD (Sadmin only). All data scoped by companyId.
- UI: `company.jsx` | API: `company.js`

**12. User & Role Management (RBAC)**
16 seeded permissions (CRUD × 4 entities). Roles can be global or company-scoped. PermissionSelector with grouped checkboxes.
- UI: `user.jsx`, `role.jsx` | API: `user.js`, `role.js`, `permission.js`

**13. Customer Management**
Company-scoped CRUD. Optional user account creation (username/password).
- UI: `customer.jsx` | API: `customer.js`

### Infrastructure

**14. File Storage (Azure Blob)** — `blob.mjs`: putFile, putMultipleFiles, downloadFile, deleteFile
**15. Background Job Queue (pg-boss)** — 5 queues: vehicle, gemini-extract, gemini-extract-page, classify-document, extract-document
**16. Theme System** — Dark/light toggle, localStorage persistence, CSS variables
**17. Reusable UI Components** — DataTable (virtualized), EditableCell, FilePreviewer, ConfirmModal, Toast, Skeleton, StatusBadge, etc. Barrel export via `wrapper.js`
**18. Deployment** — Dockerfile (Node 22 Alpine), Docker Compose, concurrently with 5 workers + auto-restart

### Audit & Accountability

**19. Vehicle Audit Trail (証跡基盤)**
Records WHO did WHAT, WHEN, and WHY for all vehicle operations. VehicleAuditLog table with nullable vehicleId (survives vehicle deletion via `onDelete: SetNull`). Covers: inline edits, CRUD, invoice-to-vehicle creation, CSV import, AI auto-link, payments, document linking. Fire-and-forget logging (never breaks parent operations). Timeline UI in EditVehicle → History tab.
- DB: `VehicleAuditLog` model, `createdById`/`updatedById` on Vehicle, `reviewedById` on PaymentConfirmation
- Utils: `auditLog.mjs` (logVehicleAudit, logVehicleFieldChanges — accepts prisma as param, works in API + workers)
- UI: `VehicleHistory.jsx` (timeline view in EditVehicle History tab)
- API: `vehicleAuditLog.js` (GET with actor→username resolution, Japanese labels)
- Instrumented: `vehicleInlineUpdate.js`, `vehicle.js`, `createVehiclesFromInvoice.js`, `paymentConfirmation.js`, `vehiclePayments.js`, `linkDocumentToVehicle.js`, `vehicle.mjs` (CSV), `documentExtract.mjs` (AI)

---

## Current Status (updated: 2026-02-21)

| Metric | Value |
|--------|-------|
| PaymentConfirmation records | 74 |
| Golden records | 33 (across 22 auctions) |
| PromptVersion | v1.0 (schema_default, score: unscored) |
| auctionHouse null records | 24 (need review) |

**Recent additions (2026-02-21):**
- Added Vehicle Audit Trail (feature #19): VehicleAuditLog model, 8 instrumented endpoints/workers, VehicleHistory UI, vehicleAuditLog API
- Note: `npx prisma db push` needed to create VehicleAuditLog table + add createdById/updatedById/reviewedById columns

**Recent cleanup (2026-02-21):**
- Removed `@cyntler/react-doc-viewer` (unused npm dep, -62 packages)
- Removed dead exports from `wrapper.js` (`ReactSelect`, `invoiceTypesOptions`, `useTheme`/`Skeleton` re-exports)
- Removed unused functions: `getPageCount` (pdfSplitter), `DOC_TYPE_KEYS` (classificationSchema), `getBoss` (pgBoss), `getAccuracyLevel` (aiConstants)
- Removed dead re-exports from `useful.js` (`deleteFile`, `downloadFile` — consumers import directly from `blob.mjs`)
- Un-exported internal constants in `chargeMapping.mjs` (`ALL_CHARGE_COLUMNS`, `TAX_BASE_COLUMNS`, `TAX_RATE`, `METADATA_CSV_MAP`)

**Known data issues:**
- auctionHouse null: 24 records missing auction name — limits few-shot matching
- Auction name variants: e.g. "ARAI" / "ARAI AUCTIONS" / "アライオークションVT" may be the same
- chassis_number diff was previously suppressed by normalization (fixed: `computeDiff.mjs` now preserves format differences like hyphens)

---

## Priority Queue

1. ~~**Embedding Few-Shot Selection**~~ ✅ — Gemini Embedding API cosine similarity + auto-embed on golden toggle + Soft HITL prompt in SaveResultModal
2. ~~**Vehicle Audit Trail (証跡基盤)**~~ ✅ — VehicleAuditLog table, 8 instrumented endpoints/workers, History tab UI, fire-and-forget logging
3. **Golden data accumulation** — Target: 3+ per major auction house, continue reviewing invoices (SaveResultModal now prompts after every save)
4. **auctionHouse null cleanup** — Review 24 records, assign auction names
5. **Payment Deadline Tracking** — Auto-calculate due dates based on auction-specific rules (e.g., "USS → Next Monday")
6. **Customer Billing (future)** — CustomerCharge table, separate from VehicleCharge acquisition costs

---

## Important Patterns

- **Upload flow:** All uploads go through `addDocument.js` → classification → type-specific extraction
- **Inline editing:** Users edit vehicles directly in the spreadsheet (vehicleInlineUpdate API). EditVehicle modal is mainly for new creation and document attachment
- **promptBuilder** is NOT an LLM — just string concatenation of 4 sections
- **Confidence colors:** Green (≥85%), Amber (60-84%), Red (<60%) — defined in `aiConstants.js`
- **All thresholds** centralized in `src/config/aiConstants.js` — don't hardcode 0.85/0.6/etc.
- **Costing sheet vs customer billing:** Vehicle table = acquisition costs (office use). Customer billing = separate, currently managed in Excel by staff (future feature)
- **Certs don't create vehicles:** Only invoices create vehicles. Certs (車検証/一時抹消/輸出抹消) only link to existing vehicles. Accuracy is already good (government-standard format), no HITL needed for certs.
- **Audit logging is fire-and-forget:** All audit calls wrapped in try/catch, never break parent operations. `auditLog.mjs` takes `prisma` as parameter (works with both API and worker Prisma instances). Audit logs survive vehicle deletion (vehicleId set to null, snapshot in metadata).

---

## FAQ

**Q: What about CustomerCharge table for billing?**
A: Future phase. VehicleCharge = acquisition costs (what you paid). CustomerCharge = customer billing (what they pay). Different use cases.

**Q: What's the next workflow after invoice extraction?**
A: Embedding few-shot selection is done ✅. Next: golden data accumulation → auctionHouse cleanup → payment deadline tracking. See Priority Queue above.

**Q: Why not have separate upload pages for each document type?**
A: Unified drop zone is simpler for users. Gemini classifies the PDF type automatically (invoice vs export cert vs inspection cert), then routes to the correct extraction pipeline. Two Gemini calls: #1 classification (cheap), #2 extraction (type-specific).

**Q: How does the AI Learning Loop improve over time?**
A: Three stages. Stage 1: Users review → corrections saved as diff → golden records feed into few-shot examples → better extraction. Stage 2 (current ✅): Embedding-based few-shot selection — semantically similar golden records are picked as examples, so accuracy improves automatically as golden data grows. Stage 3 (100+ golden): DSPy MIPROv2 optimizes few-shot selection + instructions simultaneously via Bayesian optimization.

**Q: Why not use DSPy now?**
A: DSPy is Python-only, and MIPROv2 requires hundreds of Gemini API calls per optimization run. With 33 golden records, embedding few-shot selection gives better ROI. DSPy becomes worthwhile at 100+ golden records.

**Q: What about the existing optimizer.mjs?**
A: It implements OPRO-style meta-prompting (Gemini rewrites its own prompt). The approach is valid but expensive (99+ API calls per run) and optimizes instruction text rather than few-shot selection. Kept as infrastructure for future use, but not the primary optimization strategy.

---

## Progressive Disclosure

**Read these when working on specific areas:**
- `docs/CASE_STUDIES.md` - Product strategy case studies (Toma, Abridge) — read when making product/feature decisions
- `README.md` - Project setup & architecture details
- `extra/ai/schema.mjs` - Field extraction rules and constraints
- `extra/ai/promptBuilder.mjs` - How the extraction prompt is assembled (4 sections: instructions + schema + few-shot + output format)
- `extra/utils/fewShotExamples.mjs` - How few-shot examples are selected (embedding-first with tier-based fallback)
- `extra/utils/embedding.mjs` - Gemini Embedding API utilities (embedRecord, cosineSimilarity, backfillGoldenEmbeddings)
- `extra/ai/optimizer.mjs` - OPRO-style meta-prompting (available but expensive, not primary strategy)
- `extra/utils/computeDiff.mjs` - Diff computation for user corrections (chassis_number preserves format differences)
- `extra/utils/auditLog.mjs` - Shared audit logging (logVehicleAudit, logVehicleFieldChanges — fire-and-forget, prisma as param)
