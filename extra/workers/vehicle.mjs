import { initQueue } from "../queues/vehicle.mjs";
import { prisma } from "../PrismaClient/prismaClient.mjs";
import { downloadFile, deleteFile } from "../../src/lib/blob.mjs";
import csv from "csv-parser";
import NotificationService from "../services/notificationService.mjs";
import { parseChargeFieldsFromFlat, parseMetadataFromCSV } from "../utils/chargeMapping.mjs";

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
        if (userId && companyId) {
          try {
            await NotificationService.createAndSend({
              userId,
              companyId,
              title: "Vehicle CSV Processing Failed",
              message: `Missing filePath in job data: ${err.message}`,
              category: "error",
              metadata: { documentUrl: filePath || 'Unknown', error: err.message }
            });
          } catch (notifyErr) {
            console.error("❌ Failed to send failure notification:", notifyErr);
          }
        }
       
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
              // --- Pre-load brands & customers to avoid N+1 per row ---
              const allBrands = await prisma.brand.findMany({ select: { id: true, name: true } });
              const brandMap = new Map(allBrands.map(b => [b.name, b.id]));
              if (!brandMap.has("-")) {
                const created = await prisma.brand.create({ data: { name: "-" } });
                brandMap.set("-", created.id);
              }

              // Collect unique brand names and customer names from CSV
              const newBrandNames = new Set();
              const customerNames = new Set();
              for (const row of results) {
                const bn = row["brand"]?.trim();
                if (bn && bn !== "" && !brandMap.has(bn)) newBrandNames.add(bn);
                const cn = row["customer"]?.trim();
                if (cn) customerNames.add(cn);
              }

              // Batch create missing brands (with race condition protection)
              for (const name of newBrandNames) {
                try {
                  const created = await prisma.brand.create({ data: { name } });
                  brandMap.set(name, created.id);
                } catch (e) {
                  if (e.code === "P2002") {
                    // Brand was created by concurrent upload, fetch it
                    const existing = await prisma.brand.findUnique({ where: { name } });
                    if (existing) brandMap.set(name, existing.id);
                  } else {
                    throw e;
                  }
                }
              }

              // Batch load customers (scoped to company)
              const customerMap = new Map();
              let newCustomerCount = 0;
              if (customerNames.size > 0) {
                const existingCustomers = await prisma.customer.findMany({
                  where: {
                    companyId: Number(companyId),
                    name: { in: [...customerNames], mode: "insensitive" },
                  },
                  select: { id: true, name: true },
                });
                for (const c of existingCustomers) customerMap.set(c.name.toLowerCase(), c.id);

                // Auto-create missing customers (with race condition protection)
                for (const name of customerNames) {
                  if (!customerMap.has(name.toLowerCase())) {
                    try {
                      const created = await prisma.customer.create({
                        data: {
                          name,
                          companyId: Number(companyId),
                          uniqueId: `CSV-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                        },
                      });
                      customerMap.set(name.toLowerCase(), created.id);
                      newCustomerCount++;
                    } catch (e) {
                      if (e.code === "P2002") {
                        // Customer was created by concurrent upload, fetch it
                        const existing = await prisma.customer.findFirst({
                          where: { companyId: Number(companyId), name: { equals: name, mode: "insensitive" } },
                          select: { id: true },
                        });
                        if (existing) customerMap.set(name.toLowerCase(), existing.id);
                      } else {
                        throw e;
                      }
                    }
                  }
                }
              }

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
                        ...(customerId ? { customerId } : {}),
                        ...charges,
                        ...metadata,
                      },
                    })
                  );
                }

                if (ops.length > 0) {
                  await prisma.$transaction(ops);
                  count += ops.length;
                }
              }
              if (userId && companyId) {
                try {
                  await NotificationService.createAndSend({
                    userId,
                    companyId,
                    title: "Vehicle CSV Processed Successfully",
                    message: `Processed ${count} vehicle(s) from the uploaded CSV.${newCustomerCount > 0 ? ` ${newCustomerCount} new customer(s) created.` : ''}`,
                    category: "success",
                    actions: [
                      { label: "View Vehicles", url: "/vehicle" }
                    ],
                    metadata: { processed: count, documentUrl: filePath }
                  });
                } catch (notifyErr) {
                  console.error("❌ Failed to send success notification:", notifyErr);
                }
              } else {
                console.warn("⚠️ No userId or companyId provided, cannot send notification");
              }

              resolve({ processed: count });
            } catch (error) {
              console.log({ error: "Database insert/update failed" });
              if (userId && companyId) {
                try {
                  await NotificationService.createAndSend({
                    userId,
                    companyId,
                    title: "Vehicle CSV Processing Failed",
                    message: `Failed to process vehicle CSV: ${error && error.message ? error.message : String(error)}`,
                    category: "error",
                    metadata: { documentUrl: filePath, error: error && error.message ? error.message : String(error) }
                  });
                } catch (notifyErr) {
                  console.error("❌ Failed to send failure notification:", notifyErr);
                }
              }

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
