/**
 * Document-specific extraction schemas for non-invoice documents.
 *
 * Each schema follows the same shape as EXTRACTION_SCHEMA in schema.mjs
 * but is tailored for the specific document type (export cert, inspection cert, etc.).
 *
 * These are used by the documentExtract worker to tell Gemini what to extract.
 */

// ─── Export Cancellation Certificate (輸出抹消) ─────────────────────
export const EXPORT_CERT_SCHEMA = {
  task: "輸出抹消仮登録証明書からデータを抽出する",
  taskDescription: "Extract data from Japanese Export Cancellation Certificate (輸出抹消仮登録証明書)",

  inputs: {
    pdf_page: {
      type: "base64_pdf",
      desc: "輸出抹消仮登録証明書（PDF）",
    },
  },

  outputs: {
    chassis_number: {
      type: "string",
      desc: "車台番号（完全な形）",
      constraints: [
        "モデルコード＋シリアル番号の完全な形",
        "ハイフンやスペースを含む場合はそのまま",
      ],
    },
    registration_number: {
      type: "string",
      desc: "登録番号（ナンバープレート）",
      constraints: [
        "例: 品川 300 あ 1234",
        "地名 + 分類番号 + ひらがな + 番号",
      ],
    },
    brand: {
      type: "string",
      desc: "車名（メーカー名）",
      constraints: [
        "メーカー名のみ（車種名を含めない）",
        "例: トヨタ, 日産, ホンダ, スズキ",
      ],
    },
    model_code: {
      type: "string",
      desc: "型式",
      constraints: [
        "例: DBA-ZVW51, 4BA-JF3",
      ],
    },
    first_registration_date: {
      type: "string",
      desc: "初度登録年月",
      constraints: [
        "YYYY/MM形式",
        "和暦の場合は西暦に変換",
      ],
    },
    vehicle_weight: {
      type: "string",
      desc: "車両重量（kg）",
      constraints: [
        "数値のみ（単位は含めない）",
        "例: 1050, 1320, 980",
      ],
    },
    length: {
      type: "string",
      desc: "長さ（cm）",
      constraints: [
        "数値のみ（単位は含めない）",
        "例: 439, 470, 362",
      ],
    },
    width: {
      type: "string",
      desc: "幅（cm）",
      constraints: [
        "数値のみ（単位は含めない）",
        "例: 169, 178, 147",
      ],
    },
    height: {
      type: "string",
      desc: "高さ（cm）",
      constraints: [
        "数値のみ（単位は含めない）",
        "例: 143, 150, 173",
      ],
    },
    m3: {
      type: "string",
      desc: "M3（長さ×幅×高さ÷1,000,000）",
      constraints: [
        "小数点以下2桁まで",
        "長さ(cm)×幅(cm)×高さ(cm)÷1,000,000で計算",
        "例: 10.63, 12.55, 7.73",
      ],
    },
    export_scheduled_date: {
      type: "string",
      desc: "輸出予定日",
      constraints: [
        "YYYY/MM/DD形式",
        "和暦の場合は西暦に変換",
      ],
    },
  },

  outputTemplate: {
    chassis_number: "ZVW51-6097706",
    registration_number: "品川 300 あ 1234",
    brand: "トヨタ",
    model_code: "DBA-ZVW51",
    first_registration_date: "2020/03",
    vehicle_weight: "1050",
    length: "439",
    width: "169",
    height: "143",
    m3: "10.63",
    export_scheduled_date: "2025/05/15",
  },
};

// ─── Vehicle Inspection Certificate (車検証) ────────────────────────
export const INSPECTION_CERT_SCHEMA = {
  task: "自動車検査証からデータを抽出する",
  taskDescription: "Extract data from Japanese Vehicle Inspection Certificate (自動車検査証)",

  inputs: {
    pdf_page: {
      type: "base64_pdf",
      desc: "自動車検査証（PDF）",
    },
  },

  outputs: {
    chassis_number: {
      type: "string",
      desc: "車台番号（完全な形）",
      constraints: [
        "モデルコード＋シリアル番号の完全な形",
      ],
    },
    brand: {
      type: "string",
      desc: "車名（メーカー名）",
      constraints: [
        "メーカー名のみ",
        "例: トヨタ, 日産, ホンダ, スズキ",
      ],
    },
    model: {
      type: "string",
      desc: "車種名・型式名",
      constraints: [
        "例: プリウス, N-BOX, フィット",
      ],
    },
    model_code: {
      type: "string",
      desc: "型式",
      constraints: [
        "例: DBA-ZVW51, 4BA-JF3",
      ],
    },
    registration_number: {
      type: "string",
      desc: "登録番号（ナンバープレート）",
      constraints: [
        "例: 品川 300 あ 1234",
      ],
    },
    first_registration_date: {
      type: "string",
      desc: "初度登録年月",
      constraints: [
        "YYYY/MM形式",
        "和暦の場合は西暦に変換",
      ],
    },
    expiry_date: {
      type: "string",
      desc: "有効期間の満了する日",
      constraints: [
        "YYYY/MM/DD形式",
        "和暦の場合は西暦に変換",
      ],
    },
    engine_displacement: {
      type: "string",
      desc: "総排気量又は定格出力（cc）",
      constraints: [
        "数値のみ（単位は含めない）",
        "例: 1500, 660, 2000",
      ],
    },
    length: {
      type: "string",
      desc: "長さ（cm）",
      constraints: [
        "数値のみ（単位は含めない）",
        "例: 439, 470, 362",
      ],
    },
    width: {
      type: "string",
      desc: "幅（cm）",
      constraints: [
        "数値のみ（単位は含めない）",
        "例: 169, 178, 147",
      ],
    },
    height: {
      type: "string",
      desc: "高さ（cm）",
      constraints: [
        "数値のみ（単位は含めない）",
        "例: 143, 150, 173",
      ],
    },
    m3: {
      type: "string",
      desc: "M3（長さ×幅×高さ÷1,000,000）",
      constraints: [
        "小数点以下2桁まで",
        "長さ(cm)×幅(cm)×高さ(cm)÷1,000,000で計算",
        "例: 10.63, 12.55, 7.73",
      ],
    },
  },

  outputTemplate: {
    chassis_number: "ZVW51-6097706",
    brand: "トヨタ",
    model: "プリウス",
    model_code: "DBA-ZVW51",
    registration_number: "品川 300 あ 1234",
    first_registration_date: "2020/03",
    expiry_date: "2025/03/15",
    engine_displacement: "1800",
    length: "439",
    width: "169",
    height: "143",
    m3: "10.63",
  },
};

// ─── Temporary Cancellation Certificate (一時抹消) ──────────────────
export const TEMP_CANCEL_SCHEMA = {
  task: "一時抹消登録証明書からデータを抽出する",
  taskDescription: "Extract data from Japanese Temporary Cancellation Certificate (一時抹消登録証明書)",

  inputs: {
    pdf_page: {
      type: "base64_pdf",
      desc: "一時抹消登録証明書（PDF）",
    },
  },

  outputs: {
    chassis_number: {
      type: "string",
      desc: "車台番号（完全な形）",
      constraints: [
        "モデルコード＋シリアル番号の完全な形",
      ],
    },
    registration_number: {
      type: "string",
      desc: "登録番号（ナンバープレート）",
      constraints: [
        "例: 品川 300 あ 1234",
      ],
    },
    owner_name: {
      type: "string",
      desc: "所有者の氏名・法人名",
      constraints: [
        "個人名または法人名",
      ],
    },
    cancellation_date: {
      type: "string",
      desc: "抹消日（一時抹消日）",
      constraints: [
        "YYYY/MM/DD形式",
        "和暦の場合は西暦に変換",
      ],
    },
    brand: {
      type: "string",
      desc: "車名（メーカー名）",
      constraints: [
        "メーカー名のみ",
        "例: トヨタ, 日産, ホンダ, スズキ",
      ],
    },
    model_code: {
      type: "string",
      desc: "型式",
      constraints: [
        "例: DBA-ZVW51, 4BA-JF3",
      ],
    },
    registration_id: {
      type: "string",
      desc: "登録識別情報（一時抹消の固有番号）",
      constraints: [
        "一時抹消登録証明書に記載される識別情報",
      ],
    },
    length: {
      type: "string",
      desc: "長さ（cm）",
      constraints: [
        "数値のみ（単位は含めない）",
        "例: 439, 470, 362",
      ],
    },
    width: {
      type: "string",
      desc: "幅（cm）",
      constraints: [
        "数値のみ（単位は含めない）",
        "例: 169, 178, 147",
      ],
    },
    height: {
      type: "string",
      desc: "高さ（cm）",
      constraints: [
        "数値のみ（単位は含めない）",
        "例: 143, 150, 173",
      ],
    },
    m3: {
      type: "string",
      desc: "M3（長さ×幅×高さ÷1,000,000）",
      constraints: [
        "小数点以下2桁まで",
        "長さ(cm)×幅(cm)×高さ(cm)÷1,000,000で計算",
        "例: 10.63, 12.55, 7.73",
      ],
    },
  },

  outputTemplate: {
    chassis_number: "ZVW51-6097706",
    registration_number: "品川 300 あ 1234",
    owner_name: "山田 太郎",
    cancellation_date: "2025/04/05",
    brand: "トヨタ",
    model_code: "DBA-ZVW51",
    registration_id: "1234-5678-9012",
    length: "439",
    width: "169",
    height: "143",
    m3: "10.63",
  },
};

/**
 * Map docType → schema for extraction.
 * Invoice uses the existing EXTRACTION_SCHEMA from schema.mjs.
 */
export const DOCUMENT_SCHEMA_MAP = {
  export_cert: EXPORT_CERT_SCHEMA,
  inspection_cert: INSPECTION_CERT_SCHEMA,
  temp_cancel: TEMP_CANCEL_SCHEMA,
};

/**
 * Build a simple extraction prompt for document types (not invoices).
 * Much simpler than the invoice promptBuilder since certs are single-page
 * with a flat structure (no arrays, no charges).
 */
export function buildDocumentExtractionPrompt(schema) {
  const sections = [];

  // Task description
  sections.push(`あなたは日本の自動車関連書類からデータを抽出する専門家です。`);
  sections.push(`タスク: ${schema.task}`);
  sections.push(``);

  // Field definitions
  sections.push(`## 抽出フィールド`);
  for (const [key, field] of Object.entries(schema.outputs)) {
    sections.push(`### ${key} (${field.type})`);
    sections.push(`${field.desc}`);
    if (field.constraints) {
      for (const c of field.constraints) {
        sections.push(`  - ${c}`);
      }
    }
    sections.push(``);
  }

  // Output format
  sections.push(`## 出力形式`);
  sections.push(`以下のJSON形式のみを返してください。それ以外のテキストは含めないでください：`);
  sections.push(``);
  sections.push("```json");
  sections.push(JSON.stringify(schema.outputTemplate, null, 2));
  sections.push("```");
  sections.push(``);
  sections.push(`注意:`);
  sections.push(`- 値が読み取れないフィールドは null にする`);
  sections.push(`- 和暦（令和、平成等）は西暦に変換する`);
  sections.push(`- 必ず有効なJSON形式で返す`);
  sections.push(`- JSON以外のテキスト・説明は一切含めない`);

  return sections.join("\n");
}
