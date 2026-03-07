# Architecture & Features

**Stack:** Next.js 15, Prisma (PostgreSQL), pg-boss, Azure Blob, Gemini AI

**Why these choices:**
- **Next.js** - Full-stack (API + UI in one repo)
- **Prisma** - Type-safe DB, easy migrations
- **pg-boss** - PostgreSQL-based queue (no Redis needed)
- **Multi-tenant** - One codebase serves many companies (companyId isolation)

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
Split PDF viewer + extracted data table. Summary/detail review modes. Confidence colors (green >=85%, amber >=60%, red <60%). Save with diff recording. Create vehicles from reviewed data. Mark records as golden.
- UI: `InvoiceDataViewer.jsx`, `SaveResultModal.jsx`, `InvoiceJobs.jsx`
- API: `paymentConfirmation.js`, `createVehiclesFromInvoice.js`

**4. AI Learning Loop (Staged Optimization)**
Extraction accuracy improves automatically as users review invoices. Three-stage approach:

**Stage 1 -- Few-Shot Driven:** User corrections → diff → golden records → few-shot selection feeds correct examples into next extraction. More golden data = better few-shot = better accuracy. No optimizer needed.
- Utils: `fewShotExamples.mjs` (tier-based fallback preserved), `computeDiff.mjs`

**Stage 2 -- Embedding Few-Shot (Current):** Few-shot examples selected by Gemini Embedding API cosine similarity instead of auction-name matching. Golden records auto-embedded on toggle. SaveResultModal prompts users to add to training data after every review (both exact_match and corrected).
- Utils: `embedding.mjs` (Gemini gemini-embedding-001, cosine similarity, backfill), `fewShotExamples.mjs` (embedding-first, tier fallback)
- UI: `SaveResultModal.jsx` (soft HITL golden prompt on every save)

**Stage 3 -- DSPy MIPROv2 (Future, 100+ golden records):** Introduce Python sidecar running DSPy's MIPROv2 optimizer. Simultaneously optimizes few-shot selection + instruction text via Bayesian optimization. Only worthwhile with 100+ golden records.
- Reference: [DSPy](https://dspy.ai/), MIPROv2 optimizer

**Existing infrastructure (usable across all stages):**
- AI: `optimizer.mjs` (OPRO-style meta-prompting, available but expensive -- 99+ Gemini calls per run)
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
- Utils: `chargeMapping.mjs` (CHARGE_TYPE_MAP, parseChargesFromArray, calculateTaxAndTotal)

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
16 seeded permissions (CRUD x 4 entities). Roles can be global or company-scoped. PermissionSelector with grouped checkboxes.
- UI: `user.jsx`, `role.jsx` | API: `user.js`, `role.js`, `permission.js`

**13. Customer Management**
Company-scoped CRUD. Optional user account creation (username/password).
- UI: `customer.jsx` | API: `customer.js`

### Infrastructure

**14. File Storage (Azure Blob)** -- `blob.mjs`: putFile, putMultipleFiles, downloadFile, deleteFile
**15. Background Job Queue (pg-boss)** -- 5 queues + Dead Letter Queues: vehicle, gemini-extract, gemini-extract-page, classify-document, extract-document
**16. Theme System** -- Dark/light toggle, localStorage persistence, CSS variables
**17. Reusable UI Components** -- DataTable (virtualized), EditableCell, FilePreviewer, ConfirmModal, Toast, Skeleton, StatusBadge, etc. Barrel export via `wrapper.js`
**18. Deployment** -- Dockerfile (Node 22 Alpine), Docker Compose, concurrently with 5 workers + auto-restart

### Audit & Accountability

**19. Vehicle Audit Trail**
Records WHO did WHAT, WHEN, and WHY for all vehicle operations. VehicleAuditLog table with nullable vehicleId (survives vehicle deletion via `onDelete: SetNull`). Covers: inline edits, CRUD, invoice-to-vehicle creation, CSV import, AI auto-link, payments, document linking. Fire-and-forget logging (never breaks parent operations). Timeline UI in EditVehicle → History tab.
- DB: `VehicleAuditLog` model, `createdById`/`updatedById` on Vehicle, `reviewedById` on PaymentConfirmation
- Utils: `auditLog.mjs` (logVehicleAudit, logVehicleFieldChanges)
- UI: `VehicleHistory.jsx` (timeline view in EditVehicle History tab)
- API: `vehicleAuditLog.js` (GET with actor→username resolution, Japanese labels)
- Instrumented: `vehicleInlineUpdate.js`, `vehicle.js`, `createVehiclesFromInvoice.js`, `paymentConfirmation.js`, `vehiclePayments.js`, `linkDocumentToVehicle.js`, `vehicle.mjs` (CSV), `documentExtract.mjs` (AI)
