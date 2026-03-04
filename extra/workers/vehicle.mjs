import { initQueue } from "../queues/vehicle.mjs";
import { prisma } from "../PrismaClient/prismaClient.mjs";
import { downloadFile, deleteFile } from "../../src/lib/blob.mjs";
import csv from "csv-parser";
import { parseChargeFieldsFromFlat, parseMetadataFromCSV } from "../utils/chargeMapping.ts";
import { resolveBrands, resolveCustomers } from "../utils/vehicleDomain.ts";
import { logVehicleAudit } from "../utils/auditLog.ts";
import { findMergeCandidate, mergeVehicles } from "../utils/vehicleMerge.ts";

let boss;

(async () => {
  try {
    boss = await initQueue();

    // surface any connection-level errors
    if (boss && typeof boss.on === "function") {
      boss.on("error", err => console.error("[pg-boss] error:", err));
    }

    await boss.work("vehicle", async([job]) => {
      const { filePath, companyId,userId } = job.data || {};

      if (!filePath) {
        const err = new Error("Missing filePath in job data");
        console.error("❌", err.message, "job=", job && job.id);
        throw err;
      }

      let count = 0;
      const stream = await downloadFile(filePath);
      const parser = csv({
        mapHeaders: ({ header }) => header.trim().toLowerCase().replace(/\s+/g, "_"),
      });

      try {
        // Step 1: Collect all CSV rows via stream
        const results = await new Promise((resolve, reject) => {
          const rows = [];
          stream
            .pipe(parser)
            .on("data", data => rows.push(data))
            .on("end", () => resolve(rows))
            .on("error", reject);
        });

        // Step 2: Resolve brands & customers (shared domain logic)
        const { brandMap } = await resolveBrands(prisma, results.map(r => r["brand"]));
        const customerMap = await resolveCustomers(prisma, Number(companyId), results.map(r => r["customer"]), "CSV");

        // Step 3: Process rows in batches of 50
        const BATCH_SIZE = 50;
        for (let i = 0; i < results.length; i += BATCH_SIZE) {
          const batch = results.slice(i, i + BATCH_SIZE);
          const ops = [];

          for (const row of batch) {
            const lotNumber = row["lot_number"] || null;
            const auction = row["auction"] || null;
            const rawChassis = row["chassis_number"]?.trim() || null;
            const chassisNumber = rawChassis ? rawChassis.replace(/\s+/g, "-") : null;
            const brandName = row["brand"]?.trim() || null;

            if (!chassisNumber) continue;

            const brandId = (brandName && brandMap.get(brandName)) || brandMap.get("-");
            const charges = parseChargeFieldsFromFlat(row);
            const metadata = parseMetadataFromCSV(row);

            const customerName = row["customer"]?.trim() || null;
            const customerId = customerName ? (customerMap.get(customerName.toLowerCase()) || null) : null;

            // ── Merge detection: check if a different vehicle matches by chassisKey+lot+auction ──
            const mergeCandidate = await findMergeCandidate(prisma, {
              companyId: Number(companyId),
              chassisNumber,
              lotNumber,
              auction,
            });

            if (mergeCandidate && mergeCandidate.chassisNumber !== chassisNumber) {
              try {
                const mergeResult = await mergeVehicles(prisma, {
                  source: "csv",
                  newData: {
                    chassisNumber,
                    lotNumber,
                    auction,
                    brandId,
                    customerId: customerId || null,
                    ...charges,
                    ...metadata,
                  },
                  existing: mergeCandidate,
                  actorId: userId ? String(userId) : null,
                  mergeSource: `csv:${filePath}`,
                });

                logVehicleAudit(prisma, {
                  vehicleId: mergeResult.survivorId,
                  action: "merge",
                  actor: "csv_import",
                  actorId: userId ? String(userId) : null,
                  source: `csv:${filePath}`,
                  metadata: {
                    absorbedId: mergeResult.absorbedId,
                    absorbedChassis: mergeCandidate.chassisNumber,
                    chargeSource: mergeResult.chargeSource,
                    fieldsChanged: mergeResult.fieldsChanged,
                    relocationCounts: mergeResult.relocationCounts,
                  },
                });

                count++;
                continue; // Skip adding to upsert batch
              } catch (mergeErr) {
                console.error(`[vehicle] Merge failed for ${chassisNumber}, falling back to upsert:`, mergeErr);
                // Fall through to normal upsert
              }
            }

            ops.push(
              prisma.vehicle.upsert({
                where: {
                  companyId_chassisNumber: {
                    companyId: Number(companyId),
                    chassisNumber,
                  },
                },
                update: {
                  lotNumber,
                  auction,
                  brandId,
                  companyId,
                  updatedById: userId ? parseInt(userId, 10) || null : null,
                  customerId: customerId || null,
                  ...charges,
                  ...metadata,
                },
                create: {
                  lotNumber,
                  auction,
                  chassisNumber,
                  brandId,
                  companyId,
                  createdById: userId ? parseInt(userId, 10) || null : null,
                  ...(customerId ? { customerId } : {}),
                  ...charges,
                  ...metadata,
                },
              })
            );
          }

          if (ops.length > 0) {
            const batchResults = await prisma.$transaction(ops);
            count += ops.length;

            // Audit trail — log each upserted vehicle (fire-and-forget)
            for (const v of batchResults) {
              const wasCreated = v.createdAt?.getTime() === v.updatedAt?.getTime();
              logVehicleAudit(prisma, {
                vehicleId: v.id,
                action: wasCreated ? "create" : "update",
                actor: "csv_import",
                actorId: userId ? String(userId) : null,
                source: `csv:${filePath}`,
              });
            }
          }
        }

        return { processed: count };
      } finally {
        // Cleanup: always delete blob and destroy streams
        try {
          await deleteFile(filePath);
        } catch (deleteError) {
          console.warn("Failed to delete blob:", deleteError.message);
        }
        if (stream && typeof stream.destroy === "function") stream.destroy();
        if (parser && typeof parser.destroy === "function") parser.destroy();
      }
    });

  } catch (err) {
    console.error("[worker] failed to start:", err && err.message ? err.message : err);
    process.exit(1);
  }
})();

// Graceful shutdown handling
process.on("SIGTERM", async () => {
  console.log("🛑 [vehicle] SIGTERM received, shutting down gracefully...");
  try {
    if (boss && typeof boss.stop === "function") {
      await boss.stop();
      console.log("✅ [vehicle] pg-boss stopped");
    }
    await prisma.$disconnect();
  } catch (error) {
    console.error("❌ [vehicle] Error during shutdown:", error && error.message ? error.message : error);
  } finally {
    process.exit(0);
  }
});

process.on("SIGINT", async () => {
  console.log("🛑 [vehicle] SIGINT received, shutting down gracefully...");
  try {
    if (boss && typeof boss.stop === "function") {
      await boss.stop();
      console.log("✅ [vehicle] pg-boss stopped");
    }
    await prisma.$disconnect();
  } catch (error) {
    console.error("❌ [vehicle] Error during shutdown:", error && error.message ? error.message : error);
  } finally {
    process.exit(0);
  }
});

console.log("🚀 Vehicle worker started and listening...");
