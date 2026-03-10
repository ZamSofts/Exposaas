# Current TODO

## DX Improvements (in progress)

- [x] B. Domain layer extraction — `vehicleDomain.mjs` (resolveBrands, resolveCustomers), `parseChargesFromArray` moved to chargeMapping.mjs
- [x] A. TypeScript migration Phase 1 — domain layer (4 files) + config (2 files) converted to .ts, tsconfig.json added
- [ ] A. TypeScript migration Phase 2 — API routes, workers, remaining utils
- [ ] C. Data fetching modernization — React Query introduction
- [ ] D. Component splitting — InvoiceDataViewer, EditVehicle, Sidebar
- [ ] E. AI pipeline improvements — Zod schemas, Structured Output

## User-Facing Features (pending design decisions)

- [ ] Payment deadline auto-calculation (USS → Next Monday, etc.)
- [ ] High-confidence review skip UI
- [ ] Document completion status dashboard
- [ ] Customer billing (CustomerCharge table)
