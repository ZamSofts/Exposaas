import { initQueue } from "../queues/vehicle.mjs";
import { prisma } from "../PrismaClient/prismaClient.mjs";
import { downloadFile, deleteFile } from "../../src/lib/blob.mjs";
import csv from "csv-parser";
import NotificationService from "../services/notificationService.mjs";

// Map CSV headers (snake_case) to database columns (camelCase)
// Also handles Gemini output mapping (shipping_fee → transportFee)
const parseChargeFromCSV = (row) => {
  const charges = {};

  // CSV header → DB column mapping
  const mapping = {
    bid_amount: "bidAmount",
    bid_tax: "bidTax",
    auction_fee: "auctionFee",
    auction_tax: "auctionTax",
    insurance_fee: "insuranceFee",
    insurance_tax: "insuranceTax",
    recycling_fee: "recyclingFee",
    transport_fee: "transportFee",
    shipping_fee: "transportFee", // Gemini outputs shipping_fee, map to transportFee
    other_fees: "otherFees",
  };

  for (const [csvKey, dbKey] of Object.entries(mapping)) {
    const value = row[csvKey];
    if (value !== undefined && value !== null && value !== "") {
      const parsed = parseFloat(value);
      if (!isNaN(parsed)) {
        charges[dbKey] = parsed;
      }
    }
  }

  // Calculate totalCost if any charge field is present
  if (Object.keys(charges).length > 0) {
    charges.totalCost = Object.values(charges).reduce((sum, val) => sum + (val || 0), 0);
  }

  return charges;
};

let boss;

(async () => {
  try {
    boss = await initQueue();

    // surface any connection-level errors
    if (boss && typeof boss.on === "function") {
      boss.on("error", err => console.error("[pg-boss] error:", err));
    }

    console.log("[worker] registering handler for: vehicle");

    await boss.work("vehicle", async([job]) => {
      console.log("🚗 Vehicle Job Started", job && job.id);
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
              for (const row of results) {
                const lotNumber = row["lot_number"] || null;
                const auction = row["auction"] || null;
                const chassisNumber = row["chassis_number"]?.trim() || null;
                const brandName = row["brand"]?.trim() || null;

                if (!chassisNumber) continue;

                // --- Find or create Brand ---
                let brand = null;
                if (brandName && brandName.trim() !== "") {
                  brand = await prisma.brand.upsert({
                    where: { name: brandName },
                    update: {},
                    create: { name: brandName },
                  });
                }
                if (!brand) {
                  brand = await prisma.brand.findUnique({ where: { name: "-" } });
                }
                let brandId = brand?.id;

                // Parse charge fields from CSV row
                const charges = parseChargeFromCSV(row);

                await prisma.vehicle.upsert({
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
                    statusId: 1,
                    ...charges,
                  },
                  create: {
                    lotNumber,
                    auction,
                    chassisNumber,
                    brandId,
                    companyId,
                    statusId: 1,
                    ...charges,
                  },
                });
                count++;
              }

              console.log("CSV Processed: ", count, "for company: ", companyId);

              // Send success notification if userId/companyId provided
              if (userId && companyId) {
                try {
                  await NotificationService.createAndSend({
                    userId,
                    companyId,
                    title: "Vehicle CSV Processed Successfully",
                    message: `Processed ${count} vehicle(s) from the uploaded CSV.`,
                    category: "success",
                    actions: [
                      { label: "View Vehicles", url: "/vehicle" }
                    ],
                    metadata: { processed: count, documentUrl: filePath }
                  });
                  console.log("🔔 Success notification sent to user", userId);
                } catch (notifyErr) {
                  console.error("❌ Failed to send success notification:", notifyErr);
                }
              } else {
                console.warn("⚠️ No userId or companyId provided, cannot send notification");
              }

              resolve({ processed: count });
            } catch (error) {
              console.error(error);
              console.log({ error: "Database insert/update failed" });

              // Notify user of failure if possible
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
                  console.log("🔔 Failure notification sent to user", userId);
                } catch (notifyErr) {
                  console.error("❌ Failed to send failure notification:", notifyErr);
                }
              }

              reject(error);
            } finally {
              try {
                await deleteFile(filePath);
                console.log("Deleted blob:", filePath);
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

    console.log("✅ Vehicle worker created and listening for jobs...");
  } catch (err) {
    console.error("[worker] failed to start:", err && err.message ? err.message : err);
    process.exit(1);
  }
})();

// Graceful shutdown handling
process.on("SIGTERM", async () => {
  console.log("🛑 SIGTERM received, shutting down gracefully...");
  try {
    if (boss && typeof boss.stop === "function") {
      await boss.stop();
      console.log("✅ pg-boss stopped");
    }
  } catch (error) {
    console.error("❌ Error during shutdown:", error && error.message ? error.message : error);
  } finally {
    process.exit(0);
  }
});

process.on("SIGINT", async () => {
  console.log("🛑 SIGINT received, shutting down gracefully...");
  try {
    if (boss && typeof boss.stop === "function") {
      await boss.stop();
      console.log("✅ pg-boss stopped");
    }
  } catch (error) {
    console.error("❌ Error during shutdown:", error && error.message ? error.message : error);
  } finally {
    process.exit(0);
  }
});

console.log("🚀 Vehicle worker started and listening...");
