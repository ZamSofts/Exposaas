# Exposaas Context

**Production:** https://exposaas.dndsol.co
**GitHub:** https://github.com/ZamSofts/Exposaas

## WHY: AI-Native Architecture

**Problem:** Japanese car exporters manually copy data from auction invoices (PDFs) into Excel. Time-consuming, error-prone.

**How it works:**
- **Gmail auto-ingestion** → system polls Gmail every 5 min, downloads PDF invoices automatically (including USS decryption)
- **AI classifies & extracts** → Gemini identifies document type, then extracts structured vehicle data
- **Human verifies** → confidence-colored review UI for corrections
- **AI learns** → corrections become training data, accuracy improves over time

**Why AI-Native (not traditional SaaS):**
- Invoices are **unstructured** (PDFs, not forms) → Need AI extraction
- **Event-driven** (async processing) → Users don't wait for Gemini
- **Human-in-the-loop** → AI isn't 100% accurate, needs verification
- **Learning system** → Feedback improves extraction over time

**Why this matters for you:**
- The primary flow is **automated ingestion from Gmail**, not manual upload (manual upload exists as fallback)
- Don't expect synchronous responses - use job queues (pg-boss)
- Always include verification UI - never auto-save AI outputs without review

## Strict Rules

- **NO TypeScript** — This project uses JavaScript only. Never create `.ts` files (except test files under `__tests__/`). Never convert `.js` files to `.ts`.
- **Do NOT modify the Dockerfile** — The production Dockerfile is maintained by the engineer. Do not change it.
- **Never push directly to `main`** — Always work on the `shahmir` branch. The engineer reviews and merges PRs to `main`. Push to `main` triggers production deployment.

## Tech Stack & Map

**Stack:** Next.js 15, Prisma (PostgreSQL), pg-boss, Azure Blob, Gemini AI

**Key Directories:**
- `src/pages/` - Next.js pages & API routes
- `src/config/` - Shared constants (aiConstants.js, vehicleColumns.js)
- `src/components/` - React components
- `src/hooks/` - Custom hooks (useAuth, useTheme, useFileUpload)
- `src/lib/` - Server utilities (useful.js, blob.mjs, auth.js)
- `extra/workers/` - Background jobs (6 workers) — see `extra/workers/CLAUDE.md`
- `extra/ai/` - AI extraction pipeline — see `extra/ai/CLAUDE.md`
- `extra/utils/` - Shared utilities (vehicleDomain, chargeMapping, auditLog, etc.)
- `extra/queues/` - pg-boss queue initializers
- `prisma/` - Database schema

## Development

```bash
npm run dev           # Starts Next.js + 6 workers
npm run test          # Run all tests (Vitest, 104 tests)
npm run test:watch    # Watch mode
npm run build         # Production build
```

```bash
npx prisma db push    # Sync schema to DB (dev)
npx prisma generate   # Regenerate Prisma client
npx prisma studio     # View data
```

**Bash Guidelines:**
- DO NOT pipe output through `head`, `tail`, `less`, or `more` — causes buffering issues
- Use command-specific flags instead (e.g., `git log -n 10` not `git log | head -10`)

---

## Core Principles

- **Simple first:** Keep changes minimal. Affect as little code as possible.
- **No shortcuts:** Find root causes. Avoid temporary fixes. Maintain senior engineer standards.
- **Minimize impact:** Only change what's necessary. Don't introduce new bugs.

## Workflow

1. **Plan mode first** — 3+ steps or architecture tasks always start in Plan mode
2. **Use subagents** — Keep main context clean; delegate research to subagents
3. **Self-improvement** — Record lessons in `tasks/lessons.md` after corrections
4. **Verify before done** — Prove it works. Run tests, check logs. Ask: "Would a staff engineer approve this?"
5. **Pursue elegance** — Stop and ask "Is there a more elegant way?" before hacking
6. **Autonomous bug fixing** — See a bug? Fix it. Don't wait for hand-holding.

## Task Management

1. Write plan in `tasks/todo.md` with checkable items
2. Confirm plan before starting implementation
3. Track progress as items are completed
4. Document results and lessons learned

---

## Further Reading

- `docs/ARCHITECTURE.md` — Full feature list (19 features), tech stack details
- `docs/STATUS.md` — Current metrics, changelog, known issues, roadmap
- `docs/PATTERNS.md` — Important patterns, FAQ, conventions, deep dive references
- `extra/ai/CLAUDE.md` — AI pipeline gotchas, extraction flow, learning loop
- `extra/workers/CLAUDE.md` — Worker patterns, queues, DLQ, job lifecycle
