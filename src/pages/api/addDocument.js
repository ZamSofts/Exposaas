/**
 * Unified Document Upload API
 *
 * Accepts PDF or CSV files from the /documents page.
 *   - PDF → dispatches to "classify-document" queue (auto-classifies invoice vs cert)
 *   - CSV → dispatches to "vehicle" queue (batch upsert with charge mapping)
 *
 * PUT /api/addDocument
 */

import { getSession, putFile } from "@/lib/useful";
import multer from "multer";

export const config = {
  api: { bodyParser: false },
};

const ALLOWED_MIME = [
  "application/pdf",
  "application/x-pdf",
  "text/csv",
  "application/vnd.ms-excel",
];

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF and CSV files are allowed!"), false);
    }
  },
}).single("file");

const parseFormData = (req) =>
  new Promise((resolve, reject) => {
    upload(req, {}, (err) => {
      if (err) reject(err);
      else {
        const files = req.files || (req.file ? { file: req.file } : null);
        resolve({ files, body: req.body || {} });
      }
    });
  });

export default async function handler(req, res) {
  if (!["PUT", "POST"].includes(req.method)) {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getSession(req, res);

  // Parse form data before try block
  const { files, body } = await parseFormData(req);
  req.files = files;
  req.body = body;

  try {
    if (!req.file) {
      if (req.files && req.files.file) {
        req.file = Array.isArray(req.files.file) ? req.files.file[0] : req.files.file;
      }
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const ext = req.file.originalname?.split(".").pop()?.toLowerCase();
    const isPdf = ["application/pdf", "application/x-pdf"].includes(req.file.mimetype) || ext === "pdf";
    const isCsv = ["text/csv", "application/vnd.ms-excel"].includes(req.file.mimetype) || ext === "csv";

    if (isPdf) {
      // PDF → classify-document queue (reuse existing boss singleton from pdfInvoice)
      const { initQueue } = await import("@extra/queues/pdfInvoice");
      const boss = await initQueue();
      try { await boss.createQueue("classify-document"); } catch (e) { /* already exists */ }

      const { url } = await putFile(req.file, "documents/");

      await boss.send("classify-document", {
        fileUrl: url,
        companyId: session?.companyId,
        userId: session?.id,
        userName: session?.name,
      });

      console.log("📋 Dispatched classify-document job for:", url);
      return res.status(200).json({
        message: "Document uploaded. Classifying and processing in the background.",
      });
    }

    if (isCsv) {
      // CSV → vehicle queue
      const { initQueue } = await import("@extra/queues/vehicle");
      const boss = await initQueue();

      const { url } = await putFile(req.file, "csv/");

      await boss.send("vehicle", {
        filePath: url,
        companyId: session?.companyId,
        userId: session?.id,
      });

      console.log("📋 Dispatched CSV vehicle job for:", url);
      return res.status(200).json({
        message: "CSV uploaded. Processing vehicles in the background.",
      });
    }

    return res.status(400).json({ error: "Unsupported file type. Use PDF or CSV." });
  } catch (err) {
    console.error("❌ addDocument error:", err);
    const status = err?.message?.includes("Only PDF") || err?.message?.includes("Only CSV") ? 400 : 500;
    return res.status(status).json({ error: err.message || String(err) });
  }
}
