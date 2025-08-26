import multer from "multer";
import csv from "csv-parser";
import fs from "fs";
import { prisma } from "@/lib/useful";

// --- Multer setup ---
const upload = multer({
  dest: "uploads/",
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "text/csv" || file.mimetype === "application/vnd.ms-excel") {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed!"), false);
    }
  },
});

// --- Helper to use multer in Next.js ---
function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, result => {
      if (result instanceof Error) return reject(result);
      return resolve(result);
    });
  });
}

// --- API Route ---
export default async function handler(req, res) {
  if (req.method == "POST") {
    try {
      // Run multer
      await runMiddleware(req, res, upload.single("file"));

      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "No CSV file uploaded" });
      }

      const results = [];

      fs.createReadStream(file.path)
        .pipe(
          csv({
            mapHeaders: ({ header }) => header.trim().toLowerCase().replace(/\s+/g, "_"),
            // "Lot Number" → "lot_number"
          })
        )
        .on("data", row => {
          results.push(row);
        })
        .on("end", async () => {
          try {
            for (const row of results) {
              const lotNumber = row["lot_number"] || null;
              const auction = row["auction"] || null;
              const chassisNumber = row["chassis_number"]?.trim() || null;
              const brandName = row["brand"]?.trim() || null;

              if (!chassisNumber) continue;

              // --- Find or create Brand ---
              if (brandName && brandName.trim() !== "") {
                var brand = await prisma.brand.findUnique({
                  where: { name: brandName },
                });
                if (!brand) {
                  brand = await prisma.brand.create({
                    data: { name: brandName },
                  });
                }
              }

              // --- Upsert Vehicle ---
              await prisma.vehicle.upsert({
                where: { chassisNumber }, // must be unique in schema
                update: {
                  lotNumber,
                  auction,
                  brandId: brand.id,
                  companyId: 1,
                  statusId: 1,
                },
                create: {
                  lotNumber,
                  auction,
                  chassisNumber,
                  brandId: brand.id,
                  companyId: 1,
                  statusId: 1,
                },
              });
            }

            res.status(200).json({
              message: "CSV imported successfully)",
              rows: results.length,
            });
          } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Database insert/update failed" });
          } finally {
            fs.unlinkSync(file.path); // cleanup
          }
        });
    } catch (err) {
      res.status(500).json({ error: err.message || "Something went wrong" });
    }
  }
}
// --- Disable bodyParser for file upload ---
export const config = {
  api: {
    bodyParser: false,
  },
};
