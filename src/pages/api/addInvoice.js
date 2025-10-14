import {getSession, putFile } from "@/lib/useful"; // adjust path if needed
import { initQueue } from "@extra/queues/pdfInvoice";

import multer from "multer";

export const config = {
  api: { bodyParser: false },
};

const upload = multer({
  storage: multer.memoryStorage(),
  // Accept common PDF mimetypes; remove incorrect 'document/pdf'
  fileFilter: (req, file, cb) => {
    const ok = ["application/pdf", "application/x-pdf"].includes(file.mimetype);
    if (ok) cb(null, true);
    else cb(new Error("Only PDF files are allowed!"), false);
  },
}).single("file");

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Wrap upload in a Promise so we can await it and only send response after processing.
  try {
    await new Promise((resolve, reject) => {
      upload(req, res, err => {
        if (err) return reject(err);
        resolve();
      });
    });

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const boss = await initQueue();

    const { url } = await putFile(req.file, "invoices/");

    await boss.send("gemini-extract", { fileUrl: url, companyId: session?.companyId });
    console.log("Dispatched gemini-extract job to queue");

    const data = {
      page_1: [
        {
          chassis_number: "DA64W-135499",
          charges: [
            { type: "bid_amount", amount: 122000 },
            { type: "auction_fee_tax", amount: 1500 },
          ],
        },
        {
          chassis_number: "DA64W-135500",
          charges: [
            { type: "bid_amount", amount: 130000 },
            { type: "auction_fee_tax", amount: 1600 },
          ],
        },
      ],
      page_2: [
        {
          chassis_number: "DA64W-135501",
          charges: [
            { type: "bid_amount", amount: 125000 },
            { type: "auction_fee_tax", amount: 1550 },
          ],
        },
      ],
    };

    return res.status(200).json({ message: "Invoice uploaded successfully. We’re analyzing it,you’ll be notified when it’s ready.", data });
  } catch (err) {
    const status = err && err.message && err.message.includes("Only PDF") ? 400 : 500;
    return res.status(status).json({ error: err.message || String(err) });
  }
}
