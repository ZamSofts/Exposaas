<<<<<<<< HEAD:src/workers/vehicle.mjs
import { Worker, Queue } from "bullmq";
import { connection } from "../queues/vehicle.mjs"; // reuse your redis config
import { prisma } from "./prismaClient.mjs";
import { downloadFile, deleteFile } from "../lib/blob.mjs";
import fs from "fs";
import csv from "csv-parser";
========

const { Worker, Queue } = require("bullmq");
const { connection } = require("../queues/vehicle.js"); // reuse your redis config
const { prisma } = require("../PrismaClient/prismaClient.js");
const fs = require("fs");
const csv = require("csv-parser");
>>>>>>>> documents:extra/workers/vehicle.js

// Create queue instance for cleanup
const vehicleQueue = new Queue("vehicle", { connection });

// Auto-cleanup function
async function cleanupOldJobs() {
  try {
    const completed = await vehicleQueue.getCompleted();
    if (completed.length > 10) {
      const toRemove = completed.slice(0, -10); // Keep last 10
      for (const job of toRemove) {
        await job.remove();
      }
      console.log(`🧹 Cleaned up ${toRemove.length} old jobs`);
    }
  } catch (error) {
    console.error("Cleanup error:", error.message);
  }
}

const worker = new Worker(
  "vehicle",
  async job => {
    console.log("Vehicle Job Started");
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
  console.log(`Job ${job.id} completed ✅`, job.returnvalue);
  // Cleanup old jobs every 5th completion
  if (job.id % 5 === 0) {
    await cleanupOldJobs();
  }
});

worker.on("failed", (job, err) => {
  console.error(`Job ${job.id} failed:`, err);
});

// Graceful shutdown handling
process.on("SIGTERM", async () => {
  console.log("🛑 SIGTERM received, shutting down gracefully...");
  await worker.close();
  await connection.disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("🛑 SIGINT received, shutting down gracefully...");
  await worker.close();
  await connection.disconnect();
  process.exit(0);
});

console.log("🚀 Vehicle worker started and listening...");
