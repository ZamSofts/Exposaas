import { Worker } from "bullmq";
import { connection } from "../queues/vehicle.js"; // reuse your redis config
import { prisma } from "./prismaClient.js";
import fs from "fs";
import csv from "csv-parser";

const worker = new Worker(
  "vehicle",
  async job => {
    const { filePath, companyId } = job.data;

    const results = [];
    let count = 0;

    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(
          csv({
            mapHeaders: ({ header }) => header.trim().toLowerCase().replace(/\s+/g, "_"),
            // "Lot Number" → "lot_number"
          })
        )
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
          } catch (error) {
            console.error(error);
            console.log({ error: "Database insert/update failed" });
          } finally {
            fs.unlinkSync(filePath); // cleanup
          }
          resolve({ processed: count });
        })
        .on("error", reject);
    });
  },
  { connection }
);

worker.on("completed", job => {
  console.log(`Job ${job.id} completed ✅`, job.returnvalue);
});

worker.on("failed", (job, err) => {
  console.error(`Job ${job.id} failed:`, err);
});
