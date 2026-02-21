# Audit Trail (証跡基盤) Implementation Plan

## Overview
Add audit trail infrastructure to track WHO did WHAT, WHEN, and WHY for all vehicle-related operations.

---

## Phase 1: Schema Changes (prisma/schema.prisma)

### 1a. New `VehicleAuditLog` model
```prisma
model VehicleAuditLog {
  id        Int      @id @default(autoincrement())
  vehicleId Int
  action    String   // "create" | "update" | "delete" | "link_document" | "payment_create" | "payment_update" | "payment_delete"
  actor     String   // "user" | "ai" | "system" | "csv_import"
  actorId   String?  // User.id (string because NextAuth stores it as string)
  field     String?  // Field name changed (for "update" action)
  oldValue  String?  // Previous value (stringified)
  newValue  String?  // New value (stringified)
  source    String?  // "manual" | "invoiceJob:{id}" | "csv:{url}" | "ai_auto_link:{id}"
  metadata  Json?    // Additional context (batch info, etc.)
  createdAt DateTime @default(now())

  vehicle   Vehicle  @relation(fields: [vehicleId], references: [id], onDelete: Cascade)

  @@index([vehicleId])
  @@index([vehicleId, createdAt])
}
```

### 1b. Add fields to existing models

**Vehicle:**
- `createdById  String?` — who created this vehicle
- `updatedById  String?` — who last updated this vehicle
- Add relation: `auditLogs VehicleAuditLog[]`

**PaymentConfirmation:**
- `reviewedById  String?` — who reviewed/saved this extraction

### 1c. Run migration
```bash
npx prisma db push
npx prisma generate
```

---

## Phase 2: Shared Audit Utility (extra/utils/auditLog.mjs)

Create a single reusable function used by all API routes and workers:

```js
import { prisma } from "../PrismaClient/prismaClient.mjs";

/**
 * Log a vehicle audit event.
 * @param {Object} params
 * @param {number} params.vehicleId
 * @param {string} params.action - "create"|"update"|"delete"|"link_document"|"payment_create"|"payment_update"|"payment_delete"
 * @param {string} params.actor - "user"|"ai"|"system"|"csv_import"
 * @param {string|null} params.actorId - User ID (string)
 * @param {string|null} params.field - Field name (for updates)
 * @param {*} params.oldValue - Previous value
 * @param {*} params.newValue - New value
 * @param {string|null} params.source - "manual"|"invoiceJob:{id}"|"csv:{url}"|"ai_auto_link:{id}"
 * @param {Object|null} params.metadata - Extra context
 */
export async function logVehicleAudit({ vehicleId, action, actor, actorId, field, oldValue, newValue, source, metadata }) {
  try {
    await prisma.vehicleAuditLog.create({
      data: {
        vehicleId,
        action,
        actor,
        actorId: actorId || null,
        field: field || null,
        oldValue: oldValue != null ? String(oldValue) : null,
        newValue: newValue != null ? String(newValue) : null,
        source: source || null,
        metadata: metadata || undefined,
      },
    });
  } catch (err) {
    // Audit logging should never break the main operation
    console.error("[audit] Failed to log:", err?.message || err);
  }
}

/**
 * Log multiple field changes for a vehicle (batch).
 * Used when updating a vehicle via EditVehicle modal (many fields at once).
 */
export async function logVehicleFieldChanges({ vehicleId, actor, actorId, source, changes }) {
  try {
    const data = changes
      .filter(c => String(c.oldValue ?? "") !== String(c.newValue ?? ""))
      .map(c => ({
        vehicleId,
        action: "update",
        actor,
        actorId: actorId || null,
        field: c.field,
        oldValue: c.oldValue != null ? String(c.oldValue) : null,
        newValue: c.newValue != null ? String(c.newValue) : null,
        source: source || null,
      }));

    if (data.length > 0) {
      await prisma.vehicleAuditLog.createMany({ data });
    }
  } catch (err) {
    console.error("[audit] Failed to log batch:", err?.message || err);
  }
}
```

**Key design decisions:**
- Fire-and-forget: audit logs never fail the parent operation (try/catch)
- Workers use `prisma` from `extra/PrismaClient/prismaClient.mjs`
- API routes will import from `../../../extra/utils/auditLog.mjs` (same pattern as chargeMapping.mjs)

---

## Phase 3: API Route Modifications

### 3a. vehicleInlineUpdate.js (highest-value change)
- **Before** the `prisma.vehicle.update()` at line 177, we already have `vehicle` (old state) and `field`+`parsedValue` (new state)
- Log: `{ vehicleId: id, action: "update", actor: "user", actorId: session.id, field, oldValue: vehicle[field], newValue: parsedValue, source: "manual" }`
- Also set `updateData.updatedById = session.id`

### 3b. vehicle.js
- **PUT (create):** After `prisma.vehicle.create()`, log `{ action: "create", actor: "user", source: "manual" }`. Set `createdById: session.id` in create data.
- **POST (update):** Before update, fetch current vehicle. Compare changed fields, log batch via `logVehicleFieldChanges`. Set `updatedById: session.id`.
- **DELETE:** Before delete, fetch full vehicle data. Log `{ action: "delete", actor: "user", metadata: { snapshot: vehicleData } }`.

### 3c. createVehiclesFromInvoice.js
- After each `prisma.vehicle.upsert()`, log:
  - If created: `{ action: "create", actor: "user", source: "invoiceJob:{invoiceJobId}" }`
  - If updated: `{ action: "update", actor: "user", source: "invoiceJob:{invoiceJobId}" }`
- Set `createdById`/`updatedById` = session.id in upsert data.

### 3d. paymentConfirmation.js
- **PUT (save review):** Add `reviewedById: session.id` to `prisma.paymentConfirmation.create()` data at line 71.
- **PATCH (golden toggle):** Log nothing to VehicleAuditLog (PaymentConfirmation is not a vehicle). The `reviewedById` field covers the WHO for reviews.
- For auto-created vehicles in the PUT handler (line 162): log `{ action: "create", actor: "user", source: "invoiceJob:{invoiceJobId}" }`.

### 3e. vehiclePayments.js
- **PUT (create):** Log `{ vehicleId, action: "payment_create", actor: "user", source: "manual", metadata: { paymentId, name, amount } }`
- **POST (update):** Log `{ vehicleId, action: "payment_update", actor: "user", source: "manual", metadata: { paymentId, changes } }`
- **DELETE:** Log `{ vehicleId, action: "payment_delete", actor: "user", source: "manual", metadata: { paymentId, name, amount } }`

### 3f. linkDocumentToVehicle.js
- After creating VehicleDocument, log: `{ vehicleId, action: "link_document", actor: "user", source: "manual", metadata: { invoiceJobId, docType } }`

---

## Phase 4: Worker Modifications

### 4a. vehicle.mjs (CSV import worker)
- After each batch `prisma.vehicle.upsert()`, we don't have per-vehicle old/new diff easily (batch in $transaction). Instead, log one audit entry per upsert:
  - `{ action: "create" or "update", actor: "csv_import", actorId: userId, source: "csv:{filePath}" }`
- Set `createdById`/`updatedById` = userId in upsert data.
- Note: `userId` is already available in `job.data`.

### 4b. documentExtract.mjs (auto-link worker)
- After auto-creating VehicleDocument (line 113), log: `{ vehicleId, action: "link_document", actor: "ai", source: "ai_auto_link:{invoiceJobId}", metadata: { docType, chassisNumber } }`
- When updating size fields (line 146), log each changed field.

---

## Phase 5: Read API (GET /api/vehicleAuditLog)

New API endpoint: `src/pages/api/vehicleAuditLog.js`

```
GET /api/vehicleAuditLog?vehicleId=123&limit=50
```

- Requires session
- Validates vehicle belongs to user's company
- Returns audit logs ordered by `createdAt DESC`
- Resolves actorId → User.name for display
- Response: `{ logs: [...], total: number }`

---

## Phase 6: UI — VehicleHistory Component

### 6a. New component: `src/components/VehicleHistory.jsx`
- Fetches from `GET /api/vehicleAuditLog?vehicleId=xxx`
- Timeline view (latest first)
- Each entry shows:
  - Timestamp (relative: "2時間前" / absolute: "2/21 14:32")
  - Actor icon (👤 user / 🤖 AI / ⚙️ system / 📊 CSV)
  - Actor name (resolved from actorId)
  - Action description:
    - create: "車両を作成"
    - update: "{field}: {old} → {new}"
    - delete: "車両を削除"
    - link_document: "書類をリンク"
    - payment_*: "支払い{作成/更新/削除}"
  - Source badge (手入力 / 請求書 / CSV / AI自動)
- Currency formatting for charge fields (¥ prefix, comma-separated)

### 6b. EditVehicle.jsx changes
- Import `History` icon from lucide-react
- Add 6th tab button "History" (like Payments — disabled when !vehicleId)
- Add tab content: `{activeTab === "history" && vehicleId && <VehicleHistory vehicleId={vehicleId} />}`

---

## Phase 7: Verification & Documentation

### 7a. Build verification
```bash
npx prisma db push
npx prisma generate
npm run build
```

### 7b. CLAUDE.md updates
- Add feature #19: "Audit Trail (証跡基盤)"
- Update Priority Queue
- Add to Progressive Disclosure

---

## Implementation Order (file-by-file)

1. `prisma/schema.prisma` — Add VehicleAuditLog model + new fields
2. `npx prisma db push && npx prisma generate`
3. `extra/utils/auditLog.mjs` — Create shared utility
4. `src/pages/api/vehicleInlineUpdate.js` — Add audit logging
5. `src/pages/api/vehicle.js` — Add audit logging (create/update/delete)
6. `src/pages/api/createVehiclesFromInvoice.js` — Add audit logging
7. `src/pages/api/paymentConfirmation.js` — Add reviewedById + audit for auto-created vehicles
8. `src/pages/api/vehiclePayments.js` — Add audit logging
9. `src/pages/api/linkDocumentToVehicle.js` — Add audit logging
10. `extra/workers/vehicle.mjs` — Add audit logging (CSV import)
11. `extra/workers/documentExtract.mjs` — Add audit logging (auto-link)
12. `src/pages/api/vehicleAuditLog.js` — New read API
13. `src/components/VehicleHistory.jsx` — New UI component
14. `src/components/EditVehicle.jsx` — Add History tab
15. `npx prisma db push && npx prisma generate && npm run build`
16. `CLAUDE.md` — Update documentation

## Risk Notes
- All audit logging is wrapped in try/catch — a logging failure never breaks the parent operation
- Workers use `job.data.userId` which may be null for legacy jobs — handled gracefully
- `session.id` is a string in NextAuth (even though User.id is Int) — VehicleAuditLog.actorId is String to match
- No migration needed — `prisma db push` adds nullable columns without data loss
