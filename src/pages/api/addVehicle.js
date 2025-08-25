import multer from "multer";
import csv from "csv-parser";
import fs from "fs";

// --- Multer setup ---
const upload = multer({
  dest: "uploads/",
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === "text/csv" ||
      file.mimetype === "application/vnd.ms-excel"
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed!"), false);
    }
  },
});

// --- Helper to use multer in Next.js ---
function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) return reject(result);
      return resolve(result);
    });
  });
}

// --- API Route ---
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Run multer
    await runMiddleware(req, res, upload.single("file"));

    const file = req.file; // multer adds `file` to req
    if (!file) {
      return res.status(400).json({ error: "No CSV file uploaded" });
    }

    const results = [];

    fs.createReadStream(file.path)
      .pipe(csv())
      .on("data", (row) => {
        results.push(row);
      })
      .on("end", () => {
        fs.unlinkSync(file.path); // remove temp file
        res.status(200).json({
          message: "CSV parsed successfully 🚀",
          rows: results.length,
          data: results, // ⚠️ remove in production if CSV is large
        });
      });
  } catch (err) {
    res.status(500).json({ error: err.message || "Something went wrong" });
  }
}

// --- Disable bodyParser for file upload ---
export const config = {
  api: {
    bodyParser: false,
  },
};
