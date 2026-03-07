# Current Status & Roadmap

## Metrics (updated: 2026-03-06)

| Metric | Value |
|--------|-------|
| PaymentConfirmation records | 74 |
| Golden records | 33 (across 22 auctions) |
| PromptVersion | v1.0 (schema_default, score: unscored) |
| auctionHouse null records | 24 (need review) |
| Test suite | 104 tests across 5 suites (Vitest) |
| DX audit issues fixed | 44/48 (92%) |

---

## Priority Queue

1. ~~**Embedding Few-Shot Selection**~~ Done -- Gemini Embedding API cosine similarity + auto-embed on golden toggle + Soft HITL prompt in SaveResultModal
2. ~~**Vehicle Audit Trail**~~ Done -- VehicleAuditLog table, 8 instrumented endpoints/workers, History tab UI, fire-and-forget logging
3. **Golden data accumulation** -- Target: 3+ per major auction house, continue reviewing invoices (SaveResultModal now prompts after every save)
4. **auctionHouse null cleanup** -- Review 24 records, assign auction names
5. **Payment Deadline Tracking** -- Auto-calculate due dates based on auction-specific rules (e.g., "USS → Next Monday")
6. **Customer Billing (future)** -- CustomerCharge table, separate from VehicleCharge acquisition costs

---

## Known Data Issues

- auctionHouse null: 24 records missing auction name -- limits few-shot matching
- Auction name variants: e.g. "ARAI" / "ARAI AUCTIONS" may be the same
- chassis_number diff was previously suppressed by normalization (fixed: `computeDiff.mjs` now preserves format differences like hyphens)

---

## Recent Changes

### 2026-03-06
- CI/CD: GitHub Actions pipeline (lint, test, build on shahmir push; auto-deploy on main merge)
- Converted all TypeScript files back to JavaScript (production Docker uses Node 22, can't run .ts)
- Added strict rules to CLAUDE.md: no TypeScript, no Dockerfile modifications, never push to main

### 2026-03-05
- Test infrastructure: Vitest with 104 tests across 5 suites (chargeMapping, computeDiff, embedding, invoiceJobUtils, vehicleFilters)
- Dead Letter Queue: pg-boss `ensureQueue()` creates companion `__dlq` queues
- Status enum: `InvoiceJobs.status` migrated from `String` to `JobStatus` enum
- Multi-file upload: `useFileUpload` hook + `FileUploadModal` support multiple file selection
- Audit FK: `Vehicle.createdById/updatedById`, `PaymentConfirmation.reviewedById` changed from `String?` to `Int?`
- Security: login rate limiting, security headers, env validation at startup
- Performance: N+1 fix in evaluationDataset, recharts tree-shaking, vehicle bulk fetch limit 5000→500

### 2026-02-27
- Domain layer extraction: `vehicleDomain.mjs` with `resolveBrands` and `resolveCustomers`
- Moved `parseChargesFromArray` into `chargeMapping.mjs` (was duplicated)
- Bug fix: `paymentConfirmation.js` brand creation P2002 race condition protection

### 2026-02-21
- Added Vehicle Audit Trail (feature #19): VehicleAuditLog model, 8 instrumented endpoints/workers
- Removed unused deps (`@cyntler/react-doc-viewer`, dead exports, unused functions)
