import { vehicle } from "@extra/queues/vehicle";

import { getSession, putFile } from "@/lib/useful"; // adjust path if needed
import multer from "multer";
import fs from "fs";
import path from "path";

export const config = {
  api: { bodyParser: false },
};


const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "text/csv" || file.mimetype === "application/vnd.ms-excel") {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed!"), false);
    }
  },
}).single("file");

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const session = await getSession(req, res);
  upload(req, res, async function (err) {
    if (err) return res.status(500).json({ error: err.message });
    const { url } = await putFile(req.file, "csv/");
    // Add CSV processing job to the queue
    await vehicle.add("processCSV", {
      filePath: url,
      companyId: session?.companyId,
    });
  });

  res.status(200).json({ message: "CSV queued for processing" });
}
