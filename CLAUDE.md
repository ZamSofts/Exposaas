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
- `src/config/` - Shared constants (aiConstants.js)
- `src/components/` - React components (InvoiceDataViewer, SaveResultModal, etc.)
- `extra/workers/` - Background jobs (Gemini extraction, CSV import)
- `extra/ai/` - AI extraction pipeline (schema, promptBuilder, optimizer, few-shot)
- `extra/utils/` - Shared utilities (computeDiff, chargeMapping, promptEvaluator, fewShotExamples)
- `prisma/` - Database schema

## HOW: Working on This Project

**Development:**
```bash
npm run dev  # Starts Next.js + workers + WebSocket
```

**Database changes:**
```bash
npx prisma migrate dev --name <name>
npx prisma studio  # View data
```

**Testing AI extraction:**
1. Upload test PDF at `/InvoiceJobs`
2. Check extraction in Invoice Review page
3. Verify data structure matches schema

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

## Current Focus: Payment Deadline Tracking

**Why this feature:** After extracting invoice data and creating vehicles with charges, exporters need to know when each payment is due. Different auctions have different payment rules (e.g., "USS Gumma → Next Monday").

**Approach:** TBD — auto-calculate payment due dates based on auction-specific rules.

---

## Next: Unified Document Upload (PDF Auto-Classification)

**Why:** Currently only invoices can be uploaded. Exporters also handle 輸出抹消（export cancellation certs）, 車検証（inspection certs）, 一時抹消（temporary cancellation certs）. Instead of separate upload flows, one drop zone that auto-classifies.

**Architecture:**
```
PDF → Azure Blob → pg-boss job
  ↓
【Gemini #1 — Classification (light, page 1 only)】
  "What type of document is this?"
  → "invoice" | "export_cert" | "inspection_cert" | "temp_cancel" | "unknown"
  ↓
【Gemini #2 — Extraction (type-specific schema + prompt)】
  ├→ invoice         → existing pipeline (schema.mjs + promptBuilder.mjs)
  ├→ export_cert     → extract chassis_number + date → link to Vehicle + update status
  ├→ inspection_cert → extract vehicle info → link to Vehicle + store as VehicleDocument
  ├→ temp_cancel     → extract chassis_number + date → link to Vehicle + update status
  └→ unknown         → flag for user to classify manually
```

**Key design decisions:**
- Gemini #1 (classification) is cheap: 1 page, simple JSON response
- Gemini #2 (extraction) reuses existing `promptBuilder.mjs` — one schema per doc type
- Documents stored in `VehicleDocument` table (already exists: vehicleId + URL)
- Classification step added to `invoicePage.mjs` worker (or new worker)
- Each doc type gets its own schema in `extra/ai/` (e.g., `schemaExportCert.mjs`)

**Existing infrastructure that supports this:**
- `VehicleDocument` model (prisma) — vehicleId + Url
- Azure Blob upload (already in `addInvoice.js`)
- `schema.mjs` + `promptBuilder.mjs` pattern — just define new schemas per doc type
- `FilePreviewer` component — already renders PDFs

---

## ✅ Completed: Vehicle Charges

Charge columns added directly to Vehicle table (no separate table — matches Excel mental model).

- **DB:** `bidAmount`, `auctionFee`, `recyclingFee`, `transportFee`, `insuranceFee`, `otherFees`, `taxSum`, `totalCost`, `sourceInvoiceJobId` on Vehicle
- **API:** `src/pages/api/vehicle.js` — GET/PUT/POST include all charge fields, auto-calculates taxSum/totalCost
- **CSV:** `extra/workers/vehicle.mjs` — parses charge columns from CSV with alias support
- **UI:** `src/pages/vehicle.jsx` — wide table with all charge columns, currency formatting
- **Invoice → Vehicle:** `src/pages/api/createVehiclesFromInvoice.js` — creates/updates vehicles from reviewed invoice data
- **Charge mapping:** `extra/utils/chargeMapping.mjs` — shared constants (CHARGE_TYPE_MAP, TAX_RATE, tax-exempt logic)

---

## ✅ Completed: AI Learning Loop (HITL)

Gemini extraction accuracy improves over time through user corrections (DSPy-inspired).

**Pipeline:**
```
PDF → schema (rules) + prompt (instructions) + few-shot (examples)
    → promptBuilder (combines all) → Gemini → Extract
    → User Review → diff recorded → golden data marked
    → optimizer analyzes errors → generates better prompt → repeat
```

**Key files:**
| File | Role |
|------|------|
| `extra/ai/schema.mjs` | Field definitions & constraints (Signature) |
| `extra/ai/promptBuilder.mjs` | Combines schema + instructions + few-shot + output format into prompt |
| `extra/ai/optimizer.mjs` | Meta-prompting: Gemini rewrites extraction prompts based on error patterns |
| `extra/utils/fewShotExamples.mjs` | Selects best training examples (5-tier priority by auction + golden status) |
| `extra/utils/computeDiff.mjs` | Shared diff logic: `computeDetailedDiff()` for UI, `computeScoredDiff()` for evaluation |
| `extra/utils/promptEvaluator.mjs` | Evaluates prompt versions against golden dataset |
| `extra/utils/promptGenerator.mjs` | Generates prompt variations (emphasize_charges, strict_chassis, negative_examples, simplified) |
| `src/config/aiConstants.js` | Shared thresholds: HIGH=0.85, MID=0.60, MIN_RECORDS=5 |
| `src/components/SaveResultModal.jsx` | Post-save diff display + golden marking button |

**UI Pages:**
- `/InvoiceJobs` → Invoice Review (InvoiceDataViewer) — review AI extraction, edit, save, mark golden
- `/accuracy` — Accuracy dashboard with charts (by field, by auction, trends)
- `/prompts` — Prompt version management (create, activate, compare, optimize)
- `/evaluation` — Golden dataset management for A/B testing prompts

**Important patterns:**
- `promptBuilder` is NOT an LLM — just string concatenation of 4 sections
- Confidence colors: Green (≥85%), Amber (60-84%), Red (<60%) — defined in `aiConstants.js`
- All thresholds centralized in `src/config/aiConstants.js` — don't hardcode 0.85/0.6/etc.

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
- `PLAN_VEHICLE_CHARGES.md` - Vehicle charges implementation checklist (completed)
- `README.md` - Project setup & architecture details
- `extra/ai/schema.mjs` - Field extraction rules and constraints
- `extra/ai/promptBuilder.mjs` - How the extraction prompt is assembled
- `extra/ai/optimizer.mjs` - How prompt optimization works (DSPy-inspired meta-prompting)
