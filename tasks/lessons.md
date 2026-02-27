# Lessons Learned

## 2026-02-27: Domain Layer Extraction

### Lesson: Don't over-abstract
- Vehicle upsert logic looks similar across `createVehiclesFromInvoice.js` and `vehicle.mjs`, but the differences (batching, metadata fields, auctionDate handling) make a shared abstraction more complex than the originals.
- Only extract what is **genuinely identical**. Brand/customer find-or-create was truly duplicated. Vehicle upsert was not.

### Lesson: paymentConfirmation.js is fundamentally different
- It uses find-then-create (never updates), charges go to VehiclePayments table (not Vehicle columns), and has no tax calculation.
- Don't force unification with the upsert-based flows in createVehiclesFromInvoice and vehicle.mjs.

### Lesson: Check for missing race condition protection
- `paymentConfirmation.js` brand creation lacked P2002 catch — a real bug found during the extraction. Always check if concurrent-safe patterns are consistently applied.

## 2026-02-27: TypeScript Migration Phase 1

### Lesson: Node 24 has native .ts support — tsx is unnecessary
- Node.js v24 can import `.ts` files directly from `.mjs` files without any loader or transpiler.
- `tsx` (TypeScript Execute) actually **conflicted** with Node 24's native handling when used with `-r dotenv/config`.
- **Rule: Check Node.js version before adding tsx/ts-node.** Node 22.6+ has `--experimental-strip-types`, Node 24+ has it enabled by default.

### Lesson: .mjs files need explicit .ts extensions in imports
- `.mjs` files enforce strict ESM resolution — extensionless imports like `from "../utils/auditLog"` don't resolve to `.ts` files.
- `.js` files in Next.js API routes go through webpack, which resolves extensionless → `.ts` automatically.
- **Rule: In `.mjs` worker files, always use explicit `.ts` extension** (e.g., `from "../utils/auditLog.ts"`). In `.js` API routes, extensionless is fine.

### Lesson: Use structural typing (interfaces) instead of importing PrismaClient in shared utils
- `extra/utils/` files can't easily import from `src/generated/prisma/` (path mismatch between API routes and workers).
- Solution: Define minimal interfaces (`AuditPrisma`, `BrandPrisma`) that describe only the methods needed.
- This is more flexible (works with any object matching the shape) and avoids import path headaches.

### Lesson: MODULE_TYPELESS_PACKAGE_JSON warning is harmless
- Node 24 warns when a `.ts` file has no `"type": "module"` in its nearest package.json.
- Adding `"type": "module"` to root package.json would fix it but could break other things.
- The warning doesn't affect functionality — ignore it for now.

---

### Lesson: DX improvements vs user-facing features
- User pointed out that all proposed architectural changes (TypeScript, domain layer, React Query, App Router, component splitting) change zero user experience.
- **Rule: Always state whether a proposed change affects users or only developers.** Prioritize user-facing work unless explicitly told to focus on DX.
