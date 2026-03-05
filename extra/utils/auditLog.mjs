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
 */
export async function logVehicleAudit(
  prisma,
  { vehicleId, action, actor, actorId, field, oldValue, newValue, source, metadata },
) {
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
 */
export async function logVehicleFieldChanges(
  prisma,
  { vehicleId, actor, actorId, source, changes },
) {
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
