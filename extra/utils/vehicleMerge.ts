/**
 * Vehicle Merge Logic
 *
 * Detects and merges duplicate vehicles that have different chassis number
 * representations but are actually the same physical vehicle.
 *
 * Matching: chassisKey (last 5 digits) + lotNumber + auction + companyId
 *
 * Merge rules:
 * - Charges: invoice always wins. CSV only fills nulls.
 * - chassisNumber: longer one wins (full VIN > truncated).
 * - Other fields: fill nulls from new data (don't overwrite existing).
 *
 * Follows vehicleDomain.ts pattern: accepts prisma as parameter,
 * minimal interface for type safety across src/ and extra/.
 */

// ── Minimal Prisma interface ──

interface MergePrisma {
  vehicle: {
    findMany: (args: any) => Promise<any[]>;
    update: (args: any) => Promise<any>;
    delete: (args: any) => Promise<any>;
  };
  vehicleDocument: {
    updateMany: (args: any) => Promise<{ count: number }>;
  };
  vehiclePayments: {
    updateMany: (args: any) => Promise<{ count: number }>;
  };
}

// ── Constants ──

const CHARGE_COLUMNS = [
  "bidAmount", "auctionFee", "insuranceFee", "recyclingFee",
  "transportFee", "otherFees", "taxSum", "totalCost",
] as const;

/** Non-charge, non-system fields that can be filled from the merge source. */
const FILLABLE_FIELDS = [
  "name", "remarks", "auctionDate", "session", "transportCompany",
  "deliverTo", "numberPlate", "titleTransferDeadline", "containerNumber",
  "etd", "documentStatus", "memo", "customerId", "brandId",
  "length", "width", "height", "m3",
] as const;

// ── Types ──

export interface MergeResult {
  survivorId: number;
  absorbedId: number;
  chassisNumberUsed: string;
  fieldsChanged: Record<string, { old: any; new: any }>;
  chargeSource: "invoice" | "csv";
  relocationCounts: { documents: number; payments: number };
}

// ── Functions ──

/**
 * Extract the merge key from a chassis number.
 * Returns the last 5 digits (numeric only), or null if fewer than 5 digits exist.
 *
 * Examples:
 *   "ZRR80W-0273419" → "73419"
 *   "WBA6A02050DZ11421" → "11421"
 *   "089391" → "89391"
 */
export function extractChassisKey(chassisNumber: string): string | null {
  const digits = chassisNumber.replace(/[^0-9]/g, "");
  if (digits.length < 5) return null;
  return digits.slice(-5);
}

/**
 * Find an existing vehicle that matches by chassisKey + lotNumber + auction.
 *
 * Returns the matching vehicle record, or null if no match.
 *
 * Safety rules:
 * - lotNumber must be non-null on the incoming side (skip if null)
 * - auction must be non-null on the incoming side (skip if null)
 * - Only matches vehicles where lotNumber and auction are also non-null
 * - excludeId prevents self-matching
 */
export async function findMergeCandidate(
  prisma: MergePrisma,
  params: {
    companyId: number;
    chassisNumber: string;
    lotNumber: string | null;
    auction: string | null;
    excludeId?: number;
  },
): Promise<any | null> {
  const { companyId, chassisNumber, lotNumber, auction, excludeId } = params;

  // Skip if lotNumber or auction is null (safe side)
  if (!lotNumber || !auction) return null;

  const chassisKey = extractChassisKey(chassisNumber);
  if (!chassisKey) return null;

  // Query candidates using the compound index (companyId, lotNumber, auction)
  const candidates = await prisma.vehicle.findMany({
    where: {
      companyId,
      lotNumber,
      auction,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });

  // Filter in-memory by chassisKey match
  for (const candidate of candidates) {
    const candidateKey = extractChassisKey(candidate.chassisNumber);
    if (candidateKey === chassisKey) {
      return candidate;
    }
  }

  return null;
}

/**
 * Merge incoming vehicle data into an existing vehicle record.
 *
 * The existing record is the "survivor" — it keeps its ID and relations.
 * If newData has an `id` (i.e. the absorbed vehicle already exists in DB),
 * its documents and payments are relocated and it is deleted.
 *
 * @param source - "invoice" or "csv": determines charge priority
 * @param newData - incoming vehicle data (may or may not have an `id`)
 * @param existing - the full DB record of the matching vehicle
 * @param actorId - who triggered the merge
 * @param mergeSource - audit trail source string (e.g. "invoiceJob:123")
 */
export async function mergeVehicles(
  prisma: MergePrisma,
  params: {
    source: "invoice" | "csv";
    newData: Record<string, any>;
    existing: Record<string, any>;
    actorId?: string | null;
    mergeSource?: string;
  },
): Promise<MergeResult> {
  const { source, newData, existing, actorId, mergeSource } = params;

  const survivorId: number = existing.id;
  const absorbedId: number = newData.id || 0;

  const updateData: Record<string, any> = {};
  const fieldsChanged: Record<string, { old: any; new: any }> = {};

  // ── Rule: chassisNumber — use the longer one ──
  const existingChassis: string = existing.chassisNumber;
  const newChassis: string | undefined = newData.chassisNumber;
  if (newChassis && newChassis.length > existingChassis.length) {
    updateData.chassisNumber = newChassis;
    fieldsChanged.chassisNumber = { old: existingChassis, new: newChassis };
  }

  // ── Rule: Charges — invoice always wins ──
  const chargeSource = source;
  if (source === "invoice") {
    // Invoice data overwrites charges
    for (const col of CHARGE_COLUMNS) {
      if (newData[col] !== undefined && newData[col] !== null) {
        if (String(existing[col] ?? "") !== String(newData[col])) {
          fieldsChanged[col] = { old: existing[col], new: newData[col] };
        }
        updateData[col] = newData[col];
      }
    }
  } else {
    // CSV: only fill null charge fields
    for (const col of CHARGE_COLUMNS) {
      if ((existing[col] === null || existing[col] === undefined) && newData[col] != null) {
        updateData[col] = newData[col];
        fieldsChanged[col] = { old: null, new: newData[col] };
      }
    }
  }

  // ── Rule: Other fields — fill nulls only (never overwrite) ──
  for (const field of FILLABLE_FIELDS) {
    const existingVal = existing[field];
    const newVal = newData[field];
    if ((existingVal === null || existingVal === undefined) && newVal != null) {
      updateData[field] = newVal;
      fieldsChanged[field] = { old: null, new: newVal };
    }
  }

  // Also carry over sourceInvoiceJobId if incoming is from invoice
  if (source === "invoice" && newData.sourceInvoiceJobId && !existing.sourceInvoiceJobId) {
    updateData.sourceInvoiceJobId = newData.sourceInvoiceJobId;
    fieldsChanged.sourceInvoiceJobId = { old: null, new: newData.sourceInvoiceJobId };
  }

  // ── Merge metadata ──
  updateData.mergedAt = new Date();
  updateData.mergedFromId = absorbedId || null;
  updateData.mergedFields = {
    chargeSource,
    fieldsChanged: Object.keys(fieldsChanged),
    absorbedChassisNumber: newData.chassisNumber || null,
    source: mergeSource || null,
  };
  updateData.updatedById = actorId ? parseInt(String(actorId), 10) || null : null;

  // ── Relocate related records if absorbed vehicle exists in DB ──
  let docCount = 0;
  let payCount = 0;

  if (absorbedId) {
    const [docResult, payResult] = await Promise.all([
      prisma.vehicleDocument.updateMany({
        where: { vehicleId: absorbedId },
        data: { vehicleId: survivorId },
      }),
      prisma.vehiclePayments.updateMany({
        where: { vehicleId: absorbedId },
        data: { vehicleId: survivorId },
      }),
    ]);
    docCount = docResult.count || 0;
    payCount = payResult.count || 0;

    // Delete absorbed vehicle (VehicleAuditLog entries survive via onDelete: SetNull)
    await prisma.vehicle.delete({ where: { id: absorbedId } });
  }

  // ── Update the survivor ──
  await prisma.vehicle.update({
    where: { id: survivorId },
    data: updateData,
  });

  return {
    survivorId,
    absorbedId,
    chassisNumberUsed: updateData.chassisNumber || existingChassis,
    fieldsChanged,
    chargeSource,
    relocationCounts: { documents: docCount, payments: payCount },
  };
}
