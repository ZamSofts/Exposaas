import { vehicle } from "@/queues/vehicle";
import { getSession } from "@/lib/useful"; // adjust path if needed

import multer from "multer";

export const config = {
  api: { bodyParser: false },
};

const upload = multer({
  dest: "/tmp",
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
    // Add CSV processing job to the queue
    await vehicle.add("processCSV", {
      filePath: req.file.path,
      companyId: session?.companyId,
    });
  });

  res.status(200).json({ message: "CSV queued for processing" });
}
