# Workers Context

## 6 Workers (started via `npm run dev`)

| Worker | Queue | Purpose |
|--------|-------|---------|
| `vehicle.mjs` | vehicle | CSV import: parse, batch-upsert (50/tx), brand/customer auto-create |
| `invoice.mjs` | gemini-extract | PDF split → enqueue per-page extraction jobs |
| `invoicePage.mjs` | gemini-extract-page | Per-page Gemini extraction |
| `classifyDocument.mjs` | classify-document | Classify document type (page 1 only) |
| `documentExtract.mjs` | extract-document | Type-specific extraction for certs |
| `emailIngestion.mjs` | email-poll | Poll Gmail every 5 min, download PDF attachments |

## Gotchas

- **Dead Letter Queues:** Every queue has a companion `__dlq` queue (e.g., `vehicle__dlq`). Failed jobs go there instead of expiring. Check DLQ when debugging missing jobs.
- **Audit logging is fire-and-forget:** Always wrap in try/catch. Never let audit failures break the main job. Use `auditLog.mjs` with `prisma` as parameter.
- **Domain functions:** Use `vehicleDomain.mjs` for brand/customer find-or-create (P2002 race condition safe). Don't inline this logic.
- **Charge parsing:** Use `chargeMapping.mjs` for all charge/tax calculations. Don't duplicate.
- **Workers use their own Prisma instance** (imported from `extra/queues/pgBoss.mjs`), not the API's `@/lib/useful` import.
- **Temp blob cleanup:** Workers should clean up temporary Azure Blob files after processing.

## Job Lifecycle

```
Job created (status: pending)
  → Worker picks up (status: processing)
  → Success (status: completed) or Failure (→ DLQ, status: failed)
```

`InvoiceJobs.status` is a `JobStatus` enum with 6 values: pending, processing, completed, failed, empty, needs_classification. Don't use arbitrary strings.

## Adding a New Worker

1. Create `extra/workers/myWorker.mjs`
2. Add queue setup in `extra/queues/`
3. Add to `concurrently` command in `package.json` scripts
4. Ensure `ensureQueue()` creates companion DLQ
