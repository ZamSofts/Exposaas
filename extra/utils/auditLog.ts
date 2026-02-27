/**
 * Vehicle Audit Log Utility
 *
 * Shared by API routes and workers to record WHO did WHAT, WHEN, and WHY
 * for all vehicle-related operations.
 *
 * All logging is fire-and-forget — failures are caught and logged,
 * never breaking the parent operation.
 */

// Use a minimal interface instead of importing PrismaClient directly.
// This avoids import path issues between src/ and extra/ while keeping type safety.
interface AuditPrisma {
  vehicleAuditLog: {
    create: (args: { data: Record<string, any> }) => Promise<any>;
    createMany: (args: { data: Record<string, any>[] }) => Promise<any>;
  };
}

export interface VehicleAuditParams {
  vehicleId: number;
  action: "create" | "update" | "delete" | "link_document" | "payment_create" | "payment_update" | "payment_delete";
  actor: "user" | "ai" | "system" | "csv_import";
  actorId?: string | null;
  field?: string | null;
  oldValue?: any;
  newValue?: any;
  source?: string | null;
  metadata?: Record<string, any> | null;
}

export interface FieldChange {
  field: string;
  oldValue: any;
  newValue: any;
}

export interface VehicleFieldChangesParams {
  vehicleId: number;
  actor: string;
  actorId?: string | null;
  source?: string | null;
  changes: FieldChange[];
}

/**
 * Log a single vehicle audit event.
 */
export async function logVehicleAudit(
  prisma: AuditPrisma,
  { vehicleId, action, actor, actorId, field, oldValue, newValue, source, metadata }: VehicleAuditParams,
): Promise<void> {
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
  } catch (err: any) {
    console.error("[audit] Failed to log:", err?.message || err);
  }
}

/**
 * Log multiple field changes for a vehicle in one batch.
 * Filters out unchanged fields automatically.
 */
export async function logVehicleFieldChanges(
  prisma: AuditPrisma,
  { vehicleId, actor, actorId, source, changes }: VehicleFieldChangesParams,
): Promise<void> {
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
  } catch (err: any) {
    console.error("[audit] Failed to log batch:", err?.message || err);
  }
}
