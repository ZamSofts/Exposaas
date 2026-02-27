/**
 * One-time migration: merge existing duplicate vehicles.
 *
 * Finds groups of vehicles with same companyId + chassisKey (last 5 digits) + lotNumber + auction.
 * Within each group, keeps the vehicle with more data (preferring one with sourceInvoiceJobId).
 *
 * DRY RUN (default): shows what would be merged without making changes.
 * LIVE RUN: node -r dotenv/config extra/scripts/mergeExistingDuplicates.mjs --execute
 */
import { prisma } from "../PrismaClient/prismaClient.mjs";
import { extractChassisKey, mergeVehicles } from "../utils/vehicleMerge.ts";
import { logVehicleAudit } from "../utils/auditLog.ts";

const isDryRun = !process.argv.includes("--execute");

async function migrate() {
  console.log(isDryRun ? "=== DRY RUN ===" : "=== LIVE RUN ===");

  // Load all vehicles with lotNumber and auction non-null
  const vehicles = await prisma.vehicle.findMany({
    where: {
      lotNumber: { not: null },
      auction: { not: null },
    },
    orderBy: { id: "asc" },
  });

  console.log(`Loaded ${vehicles.length} vehicles with lotNumber + auction`);

  // Group by companyId + chassisKey + lotNumber + auction
  const groups = new Map();
  for (const v of vehicles) {
    const key = extractChassisKey(v.chassisNumber);
    if (!key) continue;
    const groupKey = `${v.companyId}:${key}:${v.lotNumber}:${v.auction}`;
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey).push(v);
  }

  // Filter to groups with 2+ members that have DIFFERENT chassis numbers (actual duplicates)
  const dupeGroups = [...groups.entries()].filter(([, g]) => {
    if (g.length < 2) return false;
    // At least two vehicles must have different chassis numbers
    const chassisSet = new Set(g.map(v => v.chassisNumber));
    return chassisSet.size > 1;
  });

  const totalDupes = dupeGroups.reduce((s, [, g]) => s + g.length, 0);
  console.log(`Found ${dupeGroups.length} duplicate groups (${totalDupes} total records)\n`);

  let mergedCount = 0;
  let errorCount = 0;

  for (const [groupKey, group] of dupeGroups) {
    // Determine survivor: prefer the one with sourceInvoiceJobId (invoice-created)
    // If both have or both lack it, prefer the one with more non-null fields
    group.sort((a, b) => {
      // Prefer invoice-sourced
      if (a.sourceInvoiceJobId && !b.sourceInvoiceJobId) return -1;
      if (!a.sourceInvoiceJobId && b.sourceInvoiceJobId) return 1;
      // Then prefer longer chassis number (full VIN)
      if (a.chassisNumber.length !== b.chassisNumber.length) {
        return b.chassisNumber.length - a.chassisNumber.length;
      }
      // Then prefer more non-null fields
      const countNonNull = (v) => Object.values(v).filter(x => x !== null && x !== undefined).length;
      return countNonNull(b) - countNonNull(a);
    });

    const survivor = group[0];
    const absorbed = group.slice(1);

    console.log(`Group: ${groupKey}`);
    console.log(`  Survivor: #${survivor.id} (${survivor.chassisNumber})${survivor.sourceInvoiceJobId ? " [invoice]" : ""}`);
    for (const a of absorbed) {
      console.log(`  Absorb:   #${a.id} (${a.chassisNumber})${a.sourceInvoiceJobId ? " [invoice]" : ""}`);
    }

    if (isDryRun) {
      console.log("");
      continue;
    }

    for (const absorbedVehicle of absorbed) {
      try {
        // Determine source: if survivor has invoiceJobId, treat absorbed as CSV and vice versa
        const source = survivor.sourceInvoiceJobId ? "csv" : "invoice";

        const result = await mergeVehicles(prisma, {
          source,
          newData: absorbedVehicle,
          existing: survivor,
          actorId: null,
          mergeSource: "migration:mergeExistingDuplicates",
        });

        logVehicleAudit(prisma, {
          vehicleId: result.survivorId,
          action: "merge",
          actor: "system",
          actorId: null,
          source: "migration:mergeExistingDuplicates",
          metadata: {
            absorbedId: absorbedVehicle.id,
            absorbedChassis: absorbedVehicle.chassisNumber,
            chargeSource: result.chargeSource,
            fieldsChanged: result.fieldsChanged,
            relocationCounts: result.relocationCounts,
          },
        });

        mergedCount++;
        console.log(`  Merged #${absorbedVehicle.id} -> #${survivor.id}`);
      } catch (err) {
        errorCount++;
        console.error(`  Failed to merge #${absorbedVehicle.id}:`, err.message);
      }
    }
    console.log("");
  }

  console.log(`Done. Merged: ${mergedCount}, Errors: ${errorCount}`);

  if (isDryRun && dupeGroups.length > 0) {
    console.log("\nThis was a DRY RUN. To execute, run:");
    console.log("  node -r dotenv/config extra/scripts/mergeExistingDuplicates.mjs --execute");
  }

  await prisma.$disconnect();
}

migrate().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
