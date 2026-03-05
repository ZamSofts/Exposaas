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
 */

// ── Constants ──

const CHARGE_COLUMNS = [
  "bidAmount", "auctionFee", "insuranceFee", "recyclingFee",
  "transportFee", "otherFees", "taxSum", "totalCost",
];

/** Non-charge, non-system fields that can be filled from the merge source. */
const FILLABLE_FIELDS = [
  "name", "remarks", "auctionDate", "session", "transportCompany",
  "deliverTo", "numberPlate", "titleTransferDeadline", "containerNumber",
  "etd", "documentStatus", "memo", "customerId", "brandId",
  "length", "width", "height", "m3",
];

// ── Functions ──

/**
 * Extract the merge key from a chassis number.
 * Returns the last 5 digits (numeric only), or null if fewer than 5 digits exist.
 */
export function extractChassisKey(chassisNumber) {
  const digits = chassisNumber.replace(/[^0-9]/g, "");
  if (digits.length < 5) return null;
  return digits.slice(-5);
}

/**
 * Find an existing vehicle that matches by chassisKey + lotNumber + auction.
 */
export async function findMergeCandidate(prisma, params) {
  const { companyId, chassisNumber, lotNumber, auction, excludeId } = params;

  if (!lotNumber || !auction) return null;

  const chassisKey = extractChassisKey(chassisNumber);
  if (!chassisKey) return null;

  const candidates = await prisma.vehicle.findMany({
    where: {
      companyId,
      lotNumber,
      auction,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });

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
 */
export async function mergeVehicles(prisma, params) {
  const { source, newData, existing, actorId, mergeSource } = params;

  const survivorId = existing.id;
  const absorbedId = newData.id || 0;

  const updateData = {};
  const fieldsChanged = {};

  // ── Rule: chassisNumber — use the longer one ──
  const existingChassis = existing.chassisNumber;
  const newChassis = newData.chassisNumber;
  if (newChassis && newChassis.length > existingChassis.length) {
    updateData.chassisNumber = newChassis;
    fieldsChanged.chassisNumber = { old: existingChassis, new: newChassis };
  }

  // ── Rule: Charges — invoice always wins ──
  const chargeSource = source;
  if (source === "invoice") {
    for (const col of CHARGE_COLUMNS) {
      if (newData[col] !== undefined && newData[col] !== null) {
        if (String(existing[col] ?? "") !== String(newData[col])) {
          fieldsChanged[col] = { old: existing[col], new: newData[col] };
        }
        updateData[col] = newData[col];
      }
    }
  } else {
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
