/**
 * DSPy-style Signature: Explicit input/output type definitions for invoice extraction.
 *
 * These were previously implicit in the PROMPT constant of geminiProcess.mjs.
 * By making them explicit, the optimizer can understand WHAT should be extracted
 * and generate targeted prompt improvements.
 *
 * The constraints here encode the user's correction patterns:
 * - brand: "Carry Truck 4WD KU" → "Suzuki" (user wants manufacturer name only)
 * - auction: "HAA Kobe" → "HAA 神戸" (user wants Japanese notation)
 * - charges: insurance_fee 3080 → recycle_fee 3080 (type misclassification)
 */
export const EXTRACTION_SCHEMA = {
  task: "日本のオークション請求書PDFから車両情報と手数料を抽出する",
  taskDescription: "Extract vehicle data and charges from Japanese car auction invoice PDFs. Output must be accurate, consistent, and follow user-verified patterns.",

  inputs: {
    pdf_page: {
      type: "base64_pdf",
      desc: "オークション請求書の1ページ（PDF形式）",
    },
  },

  outputs: {
    chassis_number: {
      type: "string",
      desc: "車台番号。モデルコード＋シリアル番号の完全な形。",
      constraints: [
        "モデルコード（3-7文字）＋シリアル番号（5-8桁）の両方を含むこと",
        "車種名やグレード名を含めない",
        "例: DA63T 482049, ZVW51 6097706, WBAWA52020P301052",
        "BAD: DA63T（シリアル番号が欠落）",
      ],
    },
    brand: {
      type: "string",
      desc: "自動車メーカー名のみ。",
      constraints: [
        "メーカー名だけを返す（車種名・グレード名・型式を含めない）",
        "GOOD: Suzuki, Toyota, Honda, BMW, Nissan",
        "BAD: Carry Truck 4WD KU（これは車種名+グレード）",
        "BAD: SX4 1.5G（これは車種+グレード）",
        "BAD: Ignis S Selection（これは車種+グレード）",
      ],
    },
    auction: {
      type: "string",
      desc: "オークション会場名。ユーザーの修正パターンに従う表記。",
      constraints: [
        "ユーザーが修正したパターンに従う（Few-Shot例を参照）",
        "場所名を日本語で保持する場合あり",
        "例: HAA 神戸, USS東京, JU広島",
      ],
    },
    auction_date: {
      type: "string",
      desc: "オークション開催日",
      constraints: [
        "YYYY/MM/DD形式",
        "例: 2025/04/05",
      ],
    },
    lot_number: {
      type: "string",
      desc: "出品番号・ロット番号",
      constraints: [
        "数字のみ",
        "例: 7122, 60238",
      ],
    },
    confidence: {
      type: "float",
      desc: "抽出の信頼度スコア（0.0〜1.0）",
      constraints: [
        "1.0 = 完全にクリア、標準フォーマット",
        "0.7-0.9 = ほぼクリア、わずかな曖昧さ",
        "0.4-0.6 = 部分的に不明確",
        "0.4未満 = 非常に不確実",
      ],
    },
    charges: {
      type: "array",
      desc: "手数料・費用の一覧。各費目にtype, amount, confidenceを含む。",
      allowed_types: [
        "bid_amount",
        "auction_fee",
        "recycling_fee",
        "shipping_fee",
        "insurance_fee",
        "listing_fee",
        "storage_fee",
        "admin_fee",
        "other_fee",
        "discount",
      ],
      constraints: [
        "税額（bid_tax, auction_tax等）は抽出しない — システムが自動計算する",
        "金額はカンマなし整数",
        "金額が0または空欄の費目は省略する",
        "積み上げセル（上段=本体/下段=税）の場合、上段の値のみ抽出",
        "各chargeにconfidence (0.0-1.0) を付与",
      ],
    },
  },

  // JSON output format template — used to show Gemini the expected structure
  outputTemplate: {
    page_1: [
      {
        auction: "HAA 神戸",
        auction_date: "2025/04/05",
        chassis_number: "DA63T 482049",
        lot_number: "7122",
        brand: "Suzuki",
        confidence: 0.95,
        charges: [
          { type: "bid_amount", amount: 250000, confidence: 0.98 },
          { type: "auction_fee", amount: 15000, confidence: 0.90 },
          { type: "recycling_fee", amount: 13220, confidence: 0.92 },
        ],
      },
    ],
  },
};

/** Fields compared in diff computation and accuracy scoring.
 *  Auto-derived from EXTRACTION_SCHEMA.outputs, excluding meta-fields. */
export const COMPARED_FIELDS = Object.keys(EXTRACTION_SCHEMA.outputs)
  .filter(k => k !== "confidence" && k !== "charges");

/**
 * Converts the schema into a human-readable constraint section for prompts.
 * This is used both by promptBuilder and by the optimizer's meta-prompt.
 */
export function schemaToConstraintText(schema) {
  const lines = [];
  lines.push(`## フィールド定義と制約`);
  lines.push(``);

  for (const [key, field] of Object.entries(schema.outputs)) {
    lines.push(`### ${key} (${field.type})`);
    lines.push(`${field.desc}`);
    if (field.constraints) {
      for (const c of field.constraints) {
        lines.push(`  - ${c}`);
      }
    }
    if (field.allowed_types) {
      lines.push(`  許可値: ${field.allowed_types.join(", ")}`);
    }
    lines.push(``);
  }

  return lines.join("\n");
}
