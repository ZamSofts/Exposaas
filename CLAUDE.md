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
- `extra/workers/` - Background jobs (Gemini extraction)
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

## Current Focus: Vehicle Charges Feature

**Why this feature:** AI extracts charge data (bid amounts, fees, taxes) from invoices, but we're not storing it with vehicles yet.

**Approach: Add charge columns directly to Vehicle table**
- Simpler than separate table (no joins needed)
- Matches Excel mental model (wide table, scroll left-right)
- All auctions use same ~10 fee types
- CSV import maps directly to columns

**New columns:** `bidAmount`, `bidTax`, `auctionFee`, `recyclingFee`, `transportFee`, `otherFees`, `taxProration`, `totalCost`, `sourceInvoiceJobId`

**Data entry methods:**
1. PDF Invoice → AI extracts → Review → Save → Vehicles created with charges
2. CSV Upload → Parse columns → Vehicles created/updated with charges

**Files to modify:**
- `prisma/schema.prisma` - Add charge columns to Vehicle
- `src/pages/api/vehicle.js` - Include charges in GET/PUT/POST
- `extra/workers/vehicle.mjs` - Parse charge columns from CSV
- `src/pages/vehicle.jsx` - Display charge columns (wide table)
- `src/components/InvoiceDataViewer.jsx` - Add "Create Vehicles" modal

**Next step:** See `PLAN_VEHICLE_CHARGES.md` for implementation checklist

---

## FAQ

**Q: What about CustomerCharge table for billing?**  
A: Future phase. VehicleCharge = acquisition costs (what you paid). CustomerCharge = customer billing (what they pay). Different use cases.

**Q: What's the next workflow after invoice extraction?**  
A: Payment deadline tracking. Auto-calculate payment due dates based on auction rules (e.g., "USS Gumma → Next Monday"). See `strategy.md` for full roadmap.

---

## Progressive Disclosure

**Read these when working on specific areas:**
- `PLAN_VEHICLE_CHARGES.md` - Implementation checklist
- `README.md` - Project setup & architecture details
- `.gemini/antigravity/brain/.../implementation_plan.md` - Detailed technical specs
- `.gemini/antigravity/brain/.../strategy.md` - Business vision (10-200 workflows, market strategy)




