/**
 * Vehicle Audit Log Utility
 *
 * Shared by API routes and workers to record WHO did WHAT, WHEN, and WHY
 * for all vehicle-related operations.
 *
 * All logging is fire-and-forget — failures are caught and logged,
 * never breaking the parent operation.
 */

/**
 * Log a single vehicle audit event.
 *
 * @param {import("@prisma/client").PrismaClient} prisma - Prisma client instance
 * @param {Object} params
 * @param {number} params.vehicleId
 * @param {string} params.action - "create"|"update"|"delete"|"link_document"|"payment_create"|"payment_update"|"payment_delete"
 * @param {string} params.actor - "user"|"ai"|"system"|"csv_import"
 * @param {string|null} [params.actorId] - User ID (string)
 * @param {string|null} [params.field] - Field name (for updates)
 * @param {*} [params.oldValue] - Previous value
 * @param {*} [params.newValue] - New value
 * @param {string|null} [params.source] - "manual"|"invoiceJob:{id}"|"csv:{url}"|"ai_auto_link:{id}"
 * @param {Object|null} [params.metadata] - Extra context
 */
export async function logVehicleAudit(prisma, { vehicleId, action, actor, actorId, field, oldValue, newValue, source, metadata }) {
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
    console.error("[audit] Failed to log:", err?.message || err);
  }
}

/**
 * Log multiple field changes for a vehicle in one batch.
 * Filters out unchanged fields automatically.
 *
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {Object} params
 * @param {number} params.vehicleId
 * @param {string} params.actor
 * @param {string|null} [params.actorId]
 * @param {string|null} [params.source]
 * @param {Array<{field: string, oldValue: *, newValue: *}>} params.changes
 */
export async function logVehicleFieldChanges(prisma, { vehicleId, actor, actorId, source, changes }) {
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
