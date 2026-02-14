import { schemaToConstraintText } from "./schema.mjs";

/**
 * Build a complete extraction prompt from schema + few-shot examples + instructions.
 *
 * This replaces the hardcoded PROMPT constant approach.
 * The prompt is composed of 4 sections:
 *   1. Instructions (from active PromptVersion or default)
 *   2. Field definitions (from schema — explicit constraints)
 *   3. Few-shot examples (from verified corrections)
 *   4. Output format (from schema template)
 *
 * The optimizer (Step B) rewrites ONLY the instructions section.
 * The schema and few-shot sections are always data-driven.
 *
 * @param {object} params
 * @param {object} params.schema - EXTRACTION_SCHEMA from schema.mjs
 * @param {Array}  params.fewShotExamples - Verified examples [{page_1: [...]}]
 * @param {string} [params.instructions] - Custom instructions (from PromptVersion)
 * @returns {string} Complete prompt text
 */
export function buildPrompt({ schema, fewShotExamples = [], instructions = null }) {
  const sections = [];

  // Section 1: Task instructions
  // If no custom instructions, use schema task description
  const instructionText = instructions || buildDefaultInstructions(schema);
  sections.push(instructionText);

  // Section 2: Field definitions from schema (explicit constraints)
  sections.push(schemaToConstraintText(schema));

  // Section 3: Few-shot examples (verified correct extractions)
  if (fewShotExamples.length > 0) {
    sections.push(buildFewShotSection(fewShotExamples));
  }

  // Section 4: Output format
  sections.push(buildOutputFormatSection(schema));

  return sections.join("\n\n");
}

/**
 * Build default instructions when no PromptVersion is active.
 * This contains the core extraction logic without field-specific constraints
 * (those come from the schema section).
 */
export function buildDefaultInstructions(schema) {
  return `You are an expert at parsing invoices from PDFs, supporting both Japanese and English languages.
Analyze this PDF document and extract vehicle line items with their associated charges.

CRITICAL INSTRUCTIONS:

Language Detection:
- Scan for keywords: '請求書', '消費税', 'オークション', '落札価格' → Japanese
- If 'Invoice', 'VAT', 'Tax' dominate → English

Item Identification:
- Look for rows labeled 'Chassis No.', 'VIN', '車台番号', '出品No'
- Each row represents one vehicle with its charges

Chassis Number Extraction:
- In Japanese auction invoices, each vehicle cell often has TWO LINES:
    Line 1: Vehicle description in Japanese → IGNORE
    Line 2: Chassis code and serial → THIS is the chassis_number
- Extract the COMPLETE second line (model code AND serial number)

Charge Extraction:
- Map fees to standardized types (see Field Definitions below)
- DO NOT extract tax amounts — taxes are auto-calculated by the system
- Convert amounts to integers (remove commas, currency symbols)
- For stacked cells (base + tax), extract ONLY the top/base value

Data Matching:
- For each vehicle, collect ONLY its associated charges from the same row/section
- Do NOT include quantity or year fields — IGNORE THESE COMPLETELY
- DO include auction_date (format: "YYYY/MM/DD")
- Handle stacked/multi-line cells: extract top/base value only, skip tax values
- Detect quantities if present and multiply if needed (unit price × qty = subtotal)

Global Rules:
- NEVER include company names, addresses, phone numbers, bank details
- NEVER include tax breakdowns (taxable amounts, consumption tax)
- Do NOT include grand totals, payments, or non-item-specific fees
- Return ONLY valid JSON matching the output format below
- Ensure no trailing commas; end with '}'
- STRICT: Output ONLY the JSON structure. No extra fields, explanations, or text.`;
}

/**
 * Build the few-shot examples section.
 * Uses verified correction data from PaymentConfirmation.
 */
function buildFewShotSection(examples) {
  if (!examples || examples.length === 0) return "";

  const lines = [
    `## 検証済みの正解例（${examples.length}件）`,
    `以下は実際にユーザーが確認・修正した正しい抽出結果です。`,
    `フィールド名、charge type、表記パターンを参考にしてください。`,
    ``,
  ];

  for (let i = 0; i < examples.length; i++) {
    const ex = examples[i];
    lines.push(`--- 正解例 ${i + 1} ---`);
    lines.push(JSON.stringify(ex, null, 2));
    lines.push(`--- End 正解例 ${i + 1} ---`);
    lines.push(``);
  }

  return lines.join("\n");
}

/**
 * Build output format section from schema template.
 */
function buildOutputFormatSection(schema) {
  const lines = [
    `## 出力形式`,
    `以下のJSON形式で返してください。page_1, page_2 のキーでページごとに配列を返す:`,
    ``,
    "```json",
    JSON.stringify(schema.outputTemplate, null, 2),
    "```",
    ``,
    `注意:`,
    `- 値がnullのフィールドは出力に含めない（confidenceは必ず含める）`,
    `- アイテムが見つからない場合は空配列 {"page_1": []} を返す`,
    `- 必ず完全で有効なJSON形式で返すこと（trailing commaなし、}で終わる）`,
    `- JSON以外のテキスト・説明・コメントは一切含めない`,
    `- quantity, yearフィールドは含めない — 完全に無視すること`,
  ];

  return lines.join("\n");
}
