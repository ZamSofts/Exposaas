import { Worker, Queue } from "bullmq";
import { connection } from "../queues/vehicle.mjs"; // reuse your redis config
import { prisma } from "../PrismaClient/prismaClient.mjs";
import { downloadFile, deleteFile } from "../../src/lib/blob.mjs";
import csv from "csv-parser";

// Create queue instance for cleanup with error handling
let vehicleQueue;
try {
  if (!connection) {
    throw new Error("Redis connection not available from vehicle queue");
  }

  vehicleQueue = new Queue("vehicle", { connection });
  console.log("✅ Vehicle queue instance created successfully");
} catch (error) {
  console.error("❌ Failed to create vehicle queue instance:", error.message);
  console.warn("⚠️ Queue cleanup functionality will be disabled");
}

// Auto-cleanup function with enhanced error handling
async function cleanupOldJobs() {
  if (!vehicleQueue) {
    console.warn("⚠️ Cannot cleanup jobs: vehicle queue not available");
    return;
  }

  try {
    console.log("🧹 Starting job cleanup...");
    const completed = await vehicleQueue.getCompleted();
    if (completed.length > 10) {
      const toRemove = completed.slice(0, -10); // Keep last 10
      for (const job of toRemove) {
        try {
          await job.remove();
        } catch (jobError) {
          console.error(`❌ Failed to remove job ${job.id}:`, jobError.message);
        }
      }
      console.log(`✅ Cleaned up ${toRemove.length} old jobs`);
    } else {
      console.log("📝 No old jobs to cleanup");
    }
  } catch (error) {
    console.error("❌ Cleanup error:", error.message);
    if (error.message.includes("Connection is closed")) {
      console.error("🔌 Redis connection lost during cleanup");
    }
  }
}

const worker = new Worker(
  "vehicle",
  async job => {
    console.log("🚗 Vehicle Job Started");

    // Check Redis connection with retry logic
    let connectionAttempts = 0;
    const maxAttempts = 5;

    while (connectionAttempts < maxAttempts) {
      try {
        if (connection && connection.status === "ready") {
          break; // Connection is good, proceed with job
        }

        // Try to reconnect
        await connection.ping();
        console.log(`✅ Redis connection restored on attempt ${connectionAttempts + 1}`);
        break;
      } catch (error) {
        connectionAttempts++;
        console.error(`❌ Redis connection attempt ${connectionAttempts}/${maxAttempts} failed:`, error.message);

        if (connectionAttempts >= maxAttempts) {
          console.error("� Max connection attempts reached. Deleting job to prevent infinite retries.");
          throw new Error(`Redis connection failed after ${maxAttempts} attempts. Job will be deleted.`);
        }

        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * connectionAttempts));
      }
    }

    const { filePath, companyId } = job.data;
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
                  update: {}, // nothing to update
                  create: { name: brandName },
                });
              }
              let brandId = brand?.id ?? 1;
              await prisma.vehicle.upsert({
                where: { chassisNumber },
                update: {
                  lotNumber,
                  auction,
                  brandId,
                  companyId,
                  statusId: 1,
                },
                create: {
                  lotNumber,
                  auction,
                  chassisNumber,
                  brandId,
                  companyId,
                  statusId: 1,
                },
              });
              count++;
            }

            console.log("CSV Processed: ", count, "for company: ", companyId);
            resolve({ processed: count });
          } catch (error) {
            console.error(error);
            console.log({ error: "Database insert/update failed" });
            reject(error);
          } finally {
            // Clean up Azure blob and memory
            try {
              await deleteFile(filePath);
              console.log("Deleted blob:", filePath);
            } catch (deleteError) {
              console.warn("Failed to delete blob:", deleteError.message);
            }

            // Clear the results array to free memory
            results.length = 0;

            // Destroy streams to prevent memory leaks
            if (stream && typeof stream.destroy === "function") {
              stream.destroy();
            }
            if (parser && typeof parser.destroy === "function") {
              parser.destroy();
            }
          }
        })
        .on("error", error => {
          // Clean up on stream error
          deleteFile(filePath).catch(deleteError => {
            console.warn("Failed to delete blob on error:", deleteError.message);
          });

          // Clear memory and destroy streams
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
  },
  { connection, type: "module" }
);

worker.on("completed", async job => {
  console.log(`✅ Job ${job.id} completed`, job.returnvalue);
  // Cleanup old jobs every 5th completion
  if (job.id % 5 === 0) {
    await cleanupOldJobs();
  }
});

worker.on("failed", (job, err) => {
  console.error(`❌ Job ${job.id} failed:`, err.message);
  if (err.message.includes("Redis connection failed after")) {
    console.log(`🗑️ Job ${job.id} deleted due to persistent Redis connection issues`);
  }
});

worker.on("error", error => {
  console.error("❌ Worker error:", error.message);
  if (error.message.includes("Connection is closed")) {
    console.error("🔌 Redis connection lost, but worker will continue trying");
  }
});

console.log("✅ Vehicle worker created and listening for jobs...");

// Graceful shutdown handling
process.on("SIGTERM", async () => {
  console.log("🛑 SIGTERM received, shutting down gracefully...");
  try {
    if (worker) {
      await worker.close();
      console.log("✅ Worker closed");
    }
    if (connection && connection.status !== "end") {
      await connection.disconnect();
      console.log("✅ Redis connection closed");
    }
  } catch (error) {
    console.error("❌ Error during shutdown:", error.message);
  } finally {
    process.exit(0);
  }
});

process.on("SIGINT", async () => {
  console.log("🛑 SIGINT received, shutting down gracefully...");
  try {
    if (worker) {
      await worker.close();
      console.log("✅ Worker closed");
    }
    if (connection && connection.status !== "end") {
      await connection.disconnect();
      console.log("✅ Redis connection closed");
    }
  } catch (error) {
    console.error("❌ Error during shutdown:", error.message);
  } finally {
    process.exit(0);
  }
});

console.log("🚀 Vehicle worker started and listening...");
