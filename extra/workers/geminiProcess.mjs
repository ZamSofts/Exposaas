import fs from "fs";
import path from "path";
import https from "https";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { deleteFile } from "../../src/lib/blob.mjs";
import NotificationService from "../services/notificationService.mjs";

const generation_config = {
    "temperature": 0,
    "top_p": 0,
    "top_k": 1,
    "candidate_count": 1
}
const PROMPT =`
You must respond deterministically and identically for identical inputs. 
Do not use creativity, paraphrasing, or alternate phrasing.

You are an expert at parsing invoices from PDFs, supporting both Japanese and English languages, and adaptable to any invoice type (e.g., automotive auctions, retail, services, utilities). Analyze this PDF document and extract line items (e.g., products, services, vehicles) with their associated charges, plus global metadata focused on the customer perspective (e.g., what the buyer needs to know about purchases, costs, and payments). Automatically detect the primary language of the document (Japanese or English) and adapt your parsing accordingly—use Japanese terms for JP docs (prioritize keywords like '請求書', '落札料', 'リサイクル預託金', '自賠責相当額', '出品料', '成約料') and English equivalents for EN docs, but always map to the standardized English charge types and output in clear English. Focus on unique, non-duplicative key elements from the customer's view—ignore headers, footers, subtotals, or redundant totals unless they tie directly to items, vehicles, costs, or payment status. For automotive auctions (detect via terms like '計算書', '落札', 'オークション'), extract per vehicle (rows/entries) and customer-relevant globals (totals, purchase summary). STRICTLY AVOID extracting or including: company names (e.g., '有限会社 ワールドオートトレーディング'), internal codes (e.g., '0011028'), addresses, phone/fax/tel numbers, bank details (e.g., bank_name, branch_name, account_type, account_number, account_holder), detailed internal balances (e.g., previous_balance, this_transaction_payment_amount, current_balance_payment_amount, settled_amount, taxable_amount_10_percent, consumption_tax_10_percent, total_price_excluding_tax, total_consumption_tax), or any non-customer-facing metadata. Skip all such details entirely—no inclusion in output.

CRITICAL INSTRUCTIONS:
Language Detection:
- Scan the document for keywords: If terms like '請求書', '消費税', 'オークション', '落札価格', '自賠責相当額', '出品料', '成約料' dominate, treat as Japanese. If 'Invoice', 'VAT', 'Tax', or 'Total' dominate, treat as English. Handle mixed-language docs by prioritizing context (e.g., fee labels). For other languages, fall back to English patterns but note 'detected_language' as 'Other'.
- For non-Latin scripts, transliterate or recognize patterns (e.g., ¥ for JPY, $ for USD, € for EUR).

Item Identification:
- Carefully examine rows/fields labeled 'Item No.', 'Description', 'Product', 'Service', 'Chassis No.', 'VIN', '車台番号', '内容' (model), '出品No' (auction/listing number), or similar in each table/section.
- Identifiers may be codes like DD51T-127679 (normalize hyphens/spaces), SKUs, serial numbers, or descriptions (e.g., 'HIACE VAN DX' or 'Honda Fit GP5'). For auctions: Extract auction date (開催日), year (年式), customer (客), vehicle price (車両代). Use the most unique identifier available; if none, use a descriptive summary.
- Scan all tables, text areas, and footers thoroughly; no item should be missed. Ignore non-line-item entries (e.g., headers, subtotals). For auctions: Count purchases (e.g., '落札 2台').

Global Metadata Extraction (Customer-Focused; Essential for Auctions):
- Document Summary: Date/time (e.g., '2025/06/09 – 17:28:45'), page number, invoice type (e.g., 'Proper Invoice (適格請求書)'), registration number (e.g., 'T3010001057135')—only if relevant to billing clarity.
- Auction Name: Extract auction house name in both Japanese and English (e.g., {"ja": "HAA", "en": "HAA Auction"}) from logos, headers, or text (e.g., 'Tokyo Auto Auction' → {"ja": "東京オートオークション", "en": "Tokyo Auto Auction"}).
- Financial Globals: Previous balance (前回繰越金額, empty=0), this transaction total (今回御取引金額) with breakdown (claim amount, tax, other charges), total due (今回御取引合計), paid amount (精算済額), remaining balance (残高)—highlight if fully paid (0 JPY). Do not include detailed sub-breakdowns like taxable_amount_10_percent or consumption_tax_10_percent.
- Customer Perspective: Purchases count, total cost, paid status, simplified summary (e.g., 'Two Honda Fit GP5 vehicles purchased for 358,620 JPY total, paid in full. Includes bids, fees, insurance, and recycling.').

Charge Type Recognition:
Extract fees and map them to these standardized types with amounts. Recognize variations in both languages and invoice types, including automotive auction specifics:
- Base Price/Subtotal/Bid: '入札金額/落札価格/車両本体価格/商品価格/Vehicle Winning Bid Amount/車両代' or 'Unit Price/Subtotal/Item Price/Service Fee/Hammer Price/Bid Amount' → 'bid_amount' or 'subtotal'
- Auction/Commission/Transaction Fee: 'オークション手数料/手数料/落札料/成約料' or 'Auction Fee/Commission/Buyer's Premium/Processing Fee/Contract Fee/Transaction Fee' → 'auction_fee' or 'commission_fee'
- Listing Fee: '出品料' or 'Listing Fee' → 'listing_fee'
- Tax (incl. VAT/Sales/Consumption): '税金/消費税' or 'Tax/VAT/Sales Tax/Consumption Tax' → 'tax' (usually % of subtotal; if specified, note subtype like 'bid_tax')
- Shipping/Transport: '輸送費/送料/陸送費' or 'Shipping/Delivery/Freight/Transport' → 'shipping_fee'
- Storage/Warehouse: '保管料' or 'Storage Fee/Warehouse Charge' → 'storage_fee'
- Documentation/Admin: '書類代/管理手数料' or 'Documentation Fee/Admin Fee/Paperwork/Handling' → 'admin_fee'
- Insurance: '自賠責相当額/Mandatory insurance equivalent' or 'Insurance Fee' → 'insurance_fee'
- Recycling/Deposit: 'リサイクル預託金/Recycling deposit fee' or 'Deposit/Recycling Fee' → 'recycling_fee'
- Discount/Adjustment: '割引' or 'Discount/Adjustment/Credit' → 'discount' (negative amounts if applicable)
- Other/Misc: 'その他/雑費' or 'Other/Miscellaneous/Additional/Utility' → 'other_fee'
- Ignore grand totals, payments, or non-item-specific fees unless tied to a line item. Handle blank fees by skipping them (e.g., listing_fee=0 → omit).
- Always convert amounts to integers: Remove commas, currency symbols (¥, $, €, etc.), spaces, or decimals (round if needed). Handle stacked/multi-line cells or formats like '250,000 / 25,000': Top/main value (before /) → primary fee; Bottom/sub (after /) → tax or secondary (e.g., 'subtotal_tax'). Detect quantities if present and multiply if needed (e.g., unit price * qty = subtotal).

# ====== EXTRACTION RULES — DO NOT IGNORE ======
• Capture every numeric value exactly as it appears. Never drop numbers.
• Map values to:
    vehicle_price / bid_amount
    auction_fee
    recycling_fee
    tax
    shipping_fee
    insurance_fee
    other_fee
• If multiple distinct values appear under a category → store them as an array.
  Example: "vehicle_price": [124000, 12400]
• If only one value appears → store as a single integer.
• Always extract both primary and secondary stacked table values
  (top + bottom) and classify where possible.
• Never infer or delete low-value numbers (e.g., 1,380, 12,400).
  Keep ALL amounts.
• Preserve invoice totals exactly.
• You MUST ALWAYS extract the following fee fields, even if they are missing → return null:
• bid_amount, bid_tax, auction_fee, auction_tax.

• These fee fields are MANDATORY and must appear in the final JSON every time, without exception.
•Strictly extract every actual value for bid_amount, bid_tax, auction_fee, auction_tax, insurance_fee, insurance_tax, and recycling_fee from all pages, rows, and columns of the PDF, and never return null—only include real extracted values.
• JSON must remain complete, structured, and valid. Do not include raw_values or uncategorized arrays—focus only on mapped charges.
# ====== END EXTRACTION ======


Table/Structure Analysis:
- Identify invoice sections: Each row/entry usually represents one item/line. Look for tables with columns like Item#, Description, Qty, Price, Fees, or auction-specific (開催日, 年式, 内容, 出品No, 客, 車両代, リサイクル料, 請求, 落札料).
- Handle varied formats: Tabular (e.g., USS/TAA JP auctions, Manheim EN), free-form text (e.g., service invoices), or scanned/handwritten. Use OCR for small/unclear text.
- Parse stacked amounts in cells: Extract all numbers, map top to main fee, bottom to tax/related.
- Match charges precisely to the item in the same row/section. If ambiguous, infer from proximity/context. No duplicates: Report vehicle price once per item.

Data Matching:
When providing the result matching the JSON object name, dynamically look for suitable alternative wording.
- For each item, collect only its associated charges. Flag unmatched charges as 'unassigned' under a dummy item if needed, but prioritize line-item links. For auctions: Group vehicles into an array with shared fields (auction date, year, model, customer).
-STRICT: Output ONLY in the exact required JSON structure and keys. Do not add extra fields, explanations, summaries, text, or formatting. Return ONLY the specified JSON format, nothing else.

REQUIRED OUTPUT FORMAT:

-Strictly return only Auction_name and Model translated into English from Japanese;
-If any category (e.g., bid_amount) returns two numeric values, assign the first as the base category (bid_amount) and automatically assign the second as its tax category (bid_tax).
-Return ONLY a valid JSON object, page-wise for the PDF:
-Return only page_1/page_2 fields listed (Auction_name,Chassis_number, lot_number, Model, auction_date, year, quantity, charges[]); ignore all unrelated data.
{
  "page_1": [
        "auction":"HAA Auction (English translated)",
        "chassis_number": "GP5 3066124" or "DA63T 248426" or "ZVW41-3012214" or "DD51T     12679" or "A200A   0005848" or "A201A              0017671" or "PC30MR-1" or "10710" or "PC30MR-1       10710" or "T-10A" or"T-10A       240-01",
        "lot_number": "7122" or "60238",
        "brand": "Toyota" or "Hiace(English translated)" or "BMW(Any brand)" or "Corolla(or car name)",
        "charges": [
        { "type": "bid_amount", "amount": 250000 },
        { "type": "bid_tax", "amount": 25000 },
        { "type": "auction_fee", "amount": 15000 },
        { "type": "auction_tax", "amount": 1500 },
        { "type": "insurance_fee", "amount": 23000 },
        { "type": "insurance_tax", "amount": 2300 },
        { "type": "recycling_fee", "amount": 13220 }
      ]
    }
  ],

  "page_2": [
    ...
  ]
}
DO NOT IGNORE ANY OF THESE CONSIDER EVERY SINGLE LINE:
CRITICAL PRIORITY: Search the entire PDF, across all pages, all sections, and all text (not only tables or rows), and extract the exact Lot Number / Block–Lot Number exactly as printed using OCR. This field must always be found.
-strictly for brand always give the whole name of the brand(eg., Toyota corolla ,BMW M5,Nissan patrol etc)
-strictly ignore all Management Number / Reference ID (eg.,25102369 or 35506349)
-Always ignore any numbers realted to (auction/event/session) (eg.,284 or 995 or 201) 
-Strictly look for dates and any format any do not read any type of date or extra numbers(eg., 10/25 or 9/23 or 1/10/2023)
-Strictly include every charges object, always include all mandatory charge types: bid_amount, bid_tax, auction_fee, auction_tax, insurance_fee, insurance_tax, and recycling_fee in the JSON output.(Must find realted ammounts eg.,"bid_tax": "ammount":1500)
-Ignore any grid lines, table borders, or visual artifacts—extract only actual text and numeric values from the document.
-Always extract and include every value required in the JSON output schema without omission.
-Always output all numeric values as positive integers unless the charge type is ‘discount’ or ‘credit’.” (eg.,“-25000”), remove the minus sign unless the field explicitly represents a deduction (e.g., “discount” or “credit”)
-Strictly Do NOT include quantity,auction_date,year, IGNORE THESE COMPLETELY
-Very strictly Do NOT include any field whose value is zero or null—omit the field entirely from the output.
-If no items found, return {"detected_language": "Unknown", "invoice_type": "N/A", "pages": {}} with empty arrays; empty optional sections if not applicable.
-Focus on line-item data; ignore headers/footers unless they contain per-item info.
-Pay special attention to multi-row headers, merged cells, rotated text, or multi-page items.
-Do not include grand totals or unrelated fees.
-Ensure no item-charge pair is missed.
-Analyze systematically: Extract all combinations.
-Return a COMPLETE, VALID JSON object. No trailing commas; end with '}'.
`


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

export async function processInvoiceWithGemini(filePath) {
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
    ]
  );

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
    console.log("🔍  JSON from response...", text);

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
    // console.log("🚀 Gemini invoice processing completed successfully.",parsed);
    return parsed;

  } catch (error) {
    console.error("❌ Error in processInvoiceWithGemini:", error?.message || error);
    return {error: "Error processing invoice", details: error?.message || String(error)};
  }
  finally {
    if (localFilePath && fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
      console.log("🗑️ Temporary file removed:", localFilePath);
    }
  }
}
