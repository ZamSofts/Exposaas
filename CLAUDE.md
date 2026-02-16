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
- `extra/utils/` - Shared utilities (computeDiff, chargeMapping, pdfSplitter, fewShotExamples, promptEvaluator, promptGenerator)
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

**4. AI Learning Loop (DSPy-Inspired)**
User corrections → diff → accuracy dashboard → few-shot selection (5-tier priority) → prompt variation generation (4 strategies) → Gemini meta-prompting optimization → golden dataset evaluation → best prompt activation.
- AI: `optimizer.mjs`
- Utils: `fewShotExamples.mjs`, `computeDiff.mjs`, `promptEvaluator.mjs`, `promptGenerator.mjs`
- UI: `/accuracy`, `/prompts`, `/evaluation`
- Config: `aiConstants.js` (thresholds: HIGH=0.85, MID=0.60)

**5. Vehicle Management (Spreadsheet UI)**
31-column spreadsheet with inline editing (number, text, date, dropdown, combobox). Row virtualization (tanstack/react-virtual). Brand/Customer comboboxes support auto-creation. Full CRUD via modal (EditVehicle) or inline.
- UI: `vehicle.jsx`, `VehicleRow.jsx`, `EditVehicle.jsx` (5 tabs: Basic/Charges/Logistics/Documents/Payments)
- Config: `vehicleColumns.js` (31 columns, filter operators)
- API: `vehicle.js`, `vehicleInlineUpdate.js`, `vehicleSuggestions.js`

**6. Lark Base-Style Filtering**
Multi-condition filter panel with AND/OR conjunction. Operators vary by field type. Server-side `buildFilterWhere` converts filter JSON to Prisma where clauses.
- UI: `VehicleFilters.jsx`
- Config: `vehicleColumns.js` (FILTER_OPERATORS, FILTERABLE_COLUMNS)

**7. Vehicle Charges & Tax Calculation**
6 charge columns (bidAmount, auctionFee, insuranceFee, recyclingFee, transportFee, otherFees). Tax = 10% on all except recyclingFee (tax-exempt). Shared calculation across inline update, vehicle creation, and CSV import.
- Utils: `chargeMapping.mjs` (CHARGE_TYPE_MAP, TAX_RATE, calculateTaxAndTotal)

**8. CSV Vehicle Import**
Upload CSV via `addDocument` API → pg-boss "vehicle" queue. csv-parser, batch-upsert (50/tx), brand/customer auto-create with race condition protection.
- Worker: `vehicle.mjs`
- Utils: `chargeMapping.mjs` (METADATA_CSV_MAP, parseChargeFieldsFromFlat, parseMetadataFromCSV)

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

---

## Current Focus: Payment Deadline Tracking

**Why this feature:** After extracting invoice data and creating vehicles with charges, exporters need to know when each payment is due. Different auctions have different payment rules (e.g., "USS Gumma → Next Monday").

**Approach:** TBD — auto-calculate payment due dates based on auction-specific rules.

---

## Important Patterns

- **Upload flow:** All uploads go through `addDocument.js` → classification → type-specific extraction
- **Inline editing:** Users edit vehicles directly in the spreadsheet (vehicleInlineUpdate API). EditVehicle modal is mainly for new creation and document attachment
- **promptBuilder** is NOT an LLM — just string concatenation of 4 sections
- **Confidence colors:** Green (≥85%), Amber (60-84%), Red (<60%) — defined in `aiConstants.js`
- **All thresholds** centralized in `src/config/aiConstants.js` — don't hardcode 0.85/0.6/etc.
- **Costing sheet vs customer billing:** Vehicle table = acquisition costs (office use). Customer billing = separate, currently managed in Excel by staff (future feature)
- **Certs don't create vehicles:** Only invoices create vehicles. Certs (車検証/一時抹消/輸出抹消) only link to existing vehicles. Accuracy is already good (government-standard format), no HITL needed for certs.

---

## FAQ

**Q: What about CustomerCharge table for billing?**
A: Future phase. VehicleCharge = acquisition costs (what you paid). CustomerCharge = customer billing (what they pay). Different use cases.

**Q: What's the next workflow after invoice extraction?**
A: Payment deadline tracking. Auto-calculate payment due dates based on auction rules (e.g., "USS Gumma → Next Monday").

**Q: Why not have separate upload pages for each document type?**
A: Unified drop zone is simpler for users. Gemini classifies the PDF type automatically (invoice vs export cert vs inspection cert), then routes to the correct extraction pipeline. Two Gemini calls: #1 classification (cheap), #2 extraction (type-specific).

**Q: How does the AI Learning Loop improve over time?**
A: Users review extractions → corrections saved as diff → golden records marked → optimizer uses Gemini to rewrite prompts based on error patterns → new prompt version activated → better extraction next time.

---

## Progressive Disclosure

**Read these when working on specific areas:**
- `docs/CASE_STUDIES.md` - Product strategy case studies (Toma, Abridge) — read when making product/feature decisions
- `README.md` - Project setup & architecture details
- `extra/ai/schema.mjs` - Field extraction rules and constraints
- `extra/ai/promptBuilder.mjs` - How the extraction prompt is assembled
- `extra/ai/optimizer.mjs` - How prompt optimization works (DSPy-inspired meta-prompting)
