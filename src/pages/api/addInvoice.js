import { getSession, putFile } from "@/lib/useful"; // adjust path if needed
import { initQueue } from "@extra/queues/pdfInvoice";

import multer from "multer";

export const config = {
  api: { bodyParser: false },
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const ok = ["application/pdf", "application/x-pdf"].includes(file.mimetype);
    if (ok) cb(null, true);
    else cb(new Error("Only PDF files are allowed!"), false);
  },
}).single("file");

const parseFormData = req =>
  new Promise((resolve, reject) => {
    upload(req, {}, err => {
      if (err) {
        reject(err);
      } else {
        const files = req.files || (req.file ? { file: req.file } : null);
        resolve({ files, body: req.body || {} });
      }
    });
  });

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (["PUT", "POST"].includes(req.method)) {
      const { files, body } = await parseFormData(req);
      req.files = files;
      req.body = body;
  }
  try {
    if (req.method == "PUT") {
      const { invoiceType } = req.body;

      if (!req.file) {
        if (req.files && req.files.file) {
          req.file = Array.isArray(req.files.file) ? req.files.file[0] : req.files.file;
        }
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      // if (!invoiceType || typeof invoiceType !== "string" || invoiceType.trim() === "") {
      //   return res.status(400).json({ error: "Missing or invalid invoiceType" });
      // }

      const boss = await initQueue();
      const { url } = await putFile(req.file, "invoices/");

      await boss.send("gemini-extract", {
        fileUrl: url,
        companyId: session?.companyId,
        userId: session?.id,
        userName: session?.name,
        invoiceType: invoiceType,
      });
      console.log("Dispatched gemini-extract job to queue");

      return res.status(200).json({ message: "Invoice uploaded successfully. We’re analyzing it,you’ll be notified when it’s ready." });
    }
  } catch (err) {
    const status = err && err.message && err.message.includes("Only PDF") ? 400 : 500;
    return res.status(status).json({ error: err.message || String(err) });
  }
}
