# Patterns & Conventions

## Important Patterns

- **Upload flow:** All uploads go through `addDocument.js` → classification → type-specific extraction
- **Inline editing:** Users edit vehicles directly in the spreadsheet (vehicleInlineUpdate API). EditVehicle modal is mainly for new creation and document attachment
- **promptBuilder** is NOT an LLM -- just string concatenation of 4 sections
- **Confidence colors:** Green (>=85%), Amber (60-84%), Red (<60%) -- defined in `aiConstants.js`
- **All thresholds** centralized in `src/config/aiConstants.js` -- don't hardcode 0.85/0.6/etc.
- **Costing sheet vs customer billing:** Vehicle table = acquisition costs (office use). Customer billing = separate, currently managed in Excel by staff (future feature)
- **Certs don't create vehicles:** Only invoices create vehicles. Certs only link to existing vehicles. No HITL needed for certs (government-standard format).

## Data Patterns

- **Audit logging is fire-and-forget:** All audit calls wrapped in try/catch, never break parent operations. `auditLog.mjs` takes `prisma` as parameter (works with both API and worker Prisma instances). Audit logs survive vehicle deletion (vehicleId set to null, snapshot in metadata).
- **Domain layer (`vehicleDomain.mjs`):** Brand find-or-create (`resolveBrands`) and customer find-or-create (`resolveCustomers`) are shared domain functions. All consumers use these instead of inline implementations. Both accept `prisma` as parameter and include P2002 race condition protection.
- **Charge parsing is centralized in `chargeMapping.mjs`:** `parseChargesFromArray` (AI extraction → DB columns), `parseChargeFieldsFromFlat` (CSV/form → DB columns), `calculateTaxAndTotal` (inline edit recalculation). Don't duplicate charge/tax logic elsewhere.
- **InvoiceJobs.status is an enum (`JobStatus`):** 6 values -- pending, processing, completed, failed, empty, needs_classification. Don't use arbitrary strings.
- **createdById/updatedById are `Int?`:** Match `User.id` (integer). Use `parseInt(session.id, 10) || null` at write points. `VehicleAuditLog.actorId` is intentionally `String?` (stores "ai", "system", etc.).
- **Dead Letter Queues:** Every pg-boss queue has a companion `__dlq` queue. Failed jobs are routed there instead of expiring -- check DLQ when debugging missing jobs.
- **Multi-file upload:** `useFileUpload({ multiple: true })` supports parallel upload with `Promise.allSettled`. Partial failures still trigger `onSuccess` for files that succeeded.

---

## FAQ

**Q: What about CustomerCharge table for billing?**
A: Future phase. VehicleCharge = acquisition costs (what you paid). CustomerCharge = customer billing (what they pay). Different use cases.

**Q: What's the next workflow after invoice extraction?**
A: Golden data accumulation → auctionHouse cleanup → payment deadline tracking. See `docs/STATUS.md` for roadmap.

**Q: Why not have separate upload pages for each document type?**
A: Unified drop zone is simpler for users. Gemini classifies the PDF type automatically, then routes to the correct extraction pipeline. Two Gemini calls: #1 classification (cheap), #2 extraction (type-specific).

**Q: How does the AI Learning Loop improve over time?**
A: Three stages. Stage 1: Users review → corrections → golden records → few-shot examples. Stage 2 (current): Embedding-based few-shot selection. Stage 3 (100+ golden): DSPy MIPROv2. See `docs/ARCHITECTURE.md` for details.

**Q: Why not use DSPy now?**
A: DSPy is Python-only, and MIPROv2 requires hundreds of Gemini API calls per optimization run. With 33 golden records, embedding few-shot selection gives better ROI.

**Q: What about the existing optimizer.mjs?**
A: It implements OPRO-style meta-prompting. Available but expensive (99+ API calls per run). Kept for future use, not the primary optimization strategy.

---

## Deep Dive References

Read these when working on specific areas:
- `docs/CASE_STUDIES.md` - Product strategy case studies (Toma, Abridge)
- `docs/ONBOARDING_STRATEGY.md` - Client onboarding workflow
- `README.md` - Project setup & architecture details
- `extra/ai/schema.mjs` - Field extraction rules and constraints
- `extra/ai/promptBuilder.mjs` - How the extraction prompt is assembled
- `extra/utils/fewShotExamples.mjs` - How few-shot examples are selected
- `extra/utils/embedding.mjs` - Gemini Embedding API utilities
- `extra/ai/optimizer.mjs` - OPRO-style meta-prompting
- `extra/utils/computeDiff.mjs` - Diff computation for user corrections
- `extra/utils/auditLog.mjs` - Shared audit logging
- `extra/utils/vehicleDomain.mjs` - Shared domain functions (resolveBrands, resolveCustomers)
