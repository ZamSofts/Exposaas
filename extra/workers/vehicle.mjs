import { initQueue } from "../queues/vehicle.mjs";
import { prisma } from "../PrismaClient/prismaClient.mjs";
import { downloadFile, deleteFile } from "../../src/lib/blob.mjs";
import csv from "csv-parser";
import { parseChargeFieldsFromFlat, parseMetadataFromCSV } from "../utils/chargeMapping.ts";
import { resolveBrands, resolveCustomers } from "../utils/vehicleDomain.ts";
import { logVehicleAudit } from "../utils/auditLog.ts";

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

      const results = [];
      let count = 0;

      return new Promise(async (resolve, reject) => {
        const stream = await downloadFile(filePath);
        const parser = csv({
          mapHeaders: ({ header }) => header.trim().toLowerCase().replace(/\s+/g, "_"),
        });

        stream
          .pipe(parser)
          .on("data", data => results.push(data))
          .on("end", async () => {
            try {
              // --- Resolve brands & customers (shared domain logic) ---
              const { brandMap } = await resolveBrands(prisma, results.map(r => r["brand"]));
              const customerMap = await resolveCustomers(prisma, Number(companyId), results.map(r => r["customer"]), "CSV");

              // --- Process rows in a transaction (batch of 50) ---
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
                        updatedById: userId ? String(userId) : null,
                        ...(customerId ? { customerId } : {}),
                        ...charges,
                        ...metadata,
                      },
                      create: {
                        lotNumber,
                        auction,
                        chassisNumber,
                        brandId,
                        companyId,
                        createdById: userId ? String(userId) : null,
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
              resolve({ processed: count });
            } catch (error) {
              console.log({ error: "Database insert/update failed" });
              reject(error);
            } finally {
              try {
                await deleteFile(filePath);
              } catch (deleteError) {
                console.warn("Failed to delete blob:", deleteError.message);
              }

              results.length = 0;

              if (stream && typeof stream.destroy === "function") {
                stream.destroy();
              }
              if (parser && typeof parser.destroy === "function") {
                parser.destroy();
              }
            }
          })
          .on("error", error => {
            deleteFile(filePath).catch(deleteError => {
              console.warn("Failed to delete blob on error:", deleteError.message);
            });

            results.length = 0;
            if (stream && typeof stream.destroy === "function") {
              stream.destroy();
            }
            if (parser && typeof parser.destroy === "function") {
              parser.destroy();
            }
            reject(error);
          });
      });
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
