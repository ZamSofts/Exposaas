import fs from "fs";
import path from "path";
import https from "https";
import { GoogleGenerativeAI } from "@google/generative-ai";

const PROMPT = `
You are an expert at parsing Japanese automotive auction invoices. Analyze this PDF document and extract chassis numbers (VINs) with their associated charges.

CRITICAL INSTRUCTIONS:

Chassis Number Detection:

Carefully examine the chassis number row in each table.

Chassis numbers may appear like DD51T 127679; normalize them to DD51T-127679.

Also detect standard 17-character VINs like 1HGBH41JXMN109186.

Scan all tables and text areas thoroughly; no chassis number should be missed.

Charge Type Recognition:
Extract the following Japanese fee types with their amounts:

オークション手数料/オークション料金 → "auction_fee"
入札金額/落札価格/車両本体価格 → "bid_amount"
税金/消費税 → "tax" (usually 10% of other amounts)
輸送費/陸送費 → "transportation_fee"
保管料 → "storage_fee"
書類代/手数料 → "documentation_fee"
その他 → "other_fee"

Table Structure Analysis:

Each row usually represents one vehicle/chassis.
Columns contain different charge types.
Stacked amounts in a single cell must be fully parsed:
Top value → main fee (e.g., "bid_amount" or "auction_fee")
Bottom value → tax/secondary fee (e.g., "bid_tax" or "auction_fee_tax")

If a cell contains multiple numbers (even if written as text or stacked vertically), extract all of them, map the top value to the main fee type and the bottom to its tax or related fee.

Always convert to integers and remove commas, yen symbols (¥), or spaces.

Data Matching:

Match each chassis number with charges from the same table row.

Be precise about which charges belong to which chassis.

REQUIRED OUTPUT FORMAT:

Return ONLY a valid JSON object like page wise for PDF:

{
  "page_1": [
    {
      "chassis_number": "DA64W-135499",
      "charges": [
        {"type": "bid_amount", "amount": 122000},
        {"type": "auction_fee_tax", "amount": 1500}
      ]
    }
  ],
  "page_2": [
    {
      "chassis_number": "DA64W-135501",
      "charges": [
        {"type": "bid_amount", "amount": 125000},
        {"type": "auction_fee_tax", "amount": 1550}
      ]
    }
  ]
}

IMPORTANT NOTES:

If no chassis numbers are found, return [].
Focus on table data where chassis numbers and amounts appear.
Use OCR to read all text, including small or unclear text.
Pay special attention to multi-row table headers and stacked cells.
Do not include the total amount column.
Look for patterns like USS auction formats.
Ensure no payment type is missed for any chassis.
Analyze the entire document systematically and extract all chassis-charge combinations.

Return a COMPLETE, VALID JSON object. Do not cut off or leave trailing commas.
Ensure the last character is '}' or ']'.
`;


async function downloadFile(url) {
  return new Promise((resolve, reject) => {
    try {
      const chunks = [];
      https.get(url, response => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download file: ${response.statusCode}`));
          return;
        }
        response.on("data", c => chunks.push(c));
        response.on("end", () => resolve(Buffer.concat(chunks)));
        response.on("error", err => reject(err));
      }).on("error", err => reject(err));
    } catch (err) {
      reject(err);
    }
  });
}

export async function processInvoiceWithGemini(filePath, invoiceType) {
  let localFilePath = null;
  let downloadedBuffer = null;

  try {
    console.log("🚀 Starting Gemini invoice processing for:", filePath);
    
    console.log("📥 Downloading from Azure Blob or reading local file...");

    const isUrl = /^https?:\/\//i.test(filePath);
    if (isUrl) {
      downloadedBuffer = await downloadFile(filePath);
      console.log("✅ Downloaded into memory. Size:", `${(downloadedBuffer.length / (1024 * 1024)).toFixed(2)} MB`);
      if (downloadedBuffer.length / (1024 * 1024) > 20) {
        console.warn("⚠️  Warning: File size is large (>20MB). Processing may take longer or fail.");
      }
    } else {
      // local file path
      localFilePath = filePath;
      if (!fs.existsSync(localFilePath)) throw new Error(`Local file not found: ${localFilePath}`);
      const stats = fs.statSync(localFilePath);
      const fileSizeMb = stats.size / (1024 * 1024);
      console.log(`📄 File size: ${fileSizeMb.toFixed(2)} MB`);
      if (fileSizeMb > 20) {
        console.warn("⚠️  Warning: File size is large (>20MB). Processing may take longer or fail.");
      }
    }

    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Missing GEMINI_API_KEY in environment");
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    if (!model) throw new Error("Unable to acquire Gemini model from client");

    let pdfBytes;
    if (downloadedBuffer) {
      pdfBytes = downloadedBuffer;
    } else {
      pdfBytes = fs.readFileSync(localFilePath);
    }
    const base64Data = pdfBytes.toString("base64");

    console.log("📤 Sending PDF to Gemini...");

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: "application/pdf",
          data: base64Data,
        },
      },
      PROMPT,
    ]);

    let text = "";
    try {
      if (result?.response?.text) {
        text = (await result.response.text()).trim();
      } else if (result?.output?.[0]?.content) {
        const out = result.output[0];
        text = typeof out.content === "string" ? out.content.trim() : out.content[0]?.text?.trim();
      } else if (result?.outputs?.[0]) {
        const out0 = result.outputs[0];
        text = out0.text?.trim() || out0.content?.[0]?.text?.trim() || "";
      } else {
        text = String(result).slice(0, 10000);
      }
    } catch (err) {
      console.warn("⚠️ Could not extract text via primary responders:", err?.message);
      text = String(result || "").slice(0, 10000);
    }

    console.log(`📥 Gemini response received (${text.length} chars)`);

    let cleanText = text
      .replace(/^```json/i, "")
      .replace(/```$/i, "")
      .trim();

    let parsed = null;
    try {
      parsed = JSON.parse(cleanText);
      console.log("✅ JSON parsed successfully");
    } catch (e) {
      console.warn("❌ JSON parse failed:", e.message);
      const re = /({[\s\S]*}|\[[\s\S]*\])/m;
      const m = re.exec(cleanText);
      if (m) {
        try {
          parsed = JSON.parse(m[0]);
          console.log("✅ Manually extracted JSON from response");
        } catch (e2) {
          console.warn("❌ Manual JSON extraction failed:", e2.message);
        }
      }
    }

    if (!parsed) {
      console.error("❌ Could not parse JSON from Gemini response. Preview:\n", cleanText.slice(0, 1000));
      return {};
    }
    return parsed;
  } catch (error) {
    console.error("❌ Error in processInvoiceWithGemini:", error?.message || error);
    return {};
  }
  finally {
    if (localFilePath && fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
      console.log("🗑️ Temporary file removed:", localFilePath);
    }
  }
}
