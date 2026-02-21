/**
 * Document classification schema for the unified document upload pipeline.
 *
 * Stage 1: Classify what type of document the PDF is (invoice, export cert, etc.)
 * Stage 2: Route to the correct extraction pipeline based on docType.
 */

export const DOCUMENT_TYPES = {
  invoice: {
    key: "invoice",
    labelJa: "請求書",
    labelEn: "Invoice",
    blobPath: "invoices/",
    color: "#3b82f6", // blue
  },
  export_cert: {
    key: "export_cert",
    labelJa: "輸出抹消",
    labelEn: "Export Cancellation Certificate",
    blobPath: "documents/export_cert/",
    color: "#10b981", // green
  },
  inspection_cert: {
    key: "inspection_cert",
    labelJa: "車検証",
    labelEn: "Vehicle Inspection Certificate",
    blobPath: "documents/inspection_cert/",
    color: "#f59e0b", // amber
  },
  temp_cancel: {
    key: "temp_cancel",
    labelJa: "一時抹消",
    labelEn: "Temporary Cancellation Certificate",
    blobPath: "documents/temp_cancel/",
    color: "#8b5cf6", // purple
  },
  unknown: {
    key: "unknown",
    labelJa: "不明",
    labelEn: "Unknown Document",
    blobPath: "documents/unknown/",
    color: "#6b7280", // gray
  },
};

/** Minimum confidence to auto-classify (below this → "unknown") */
export const CLASSIFICATION_CONFIDENCE_THRESHOLD = 0.7;

/**
 * Classification prompt — sent to Gemini with page 1 of the PDF.
 * Returns a simple JSON: { type, confidence }
 */
export const CLASSIFICATION_PROMPT = `あなたは日本の自動車輸出業で使用される書類を分類する専門家です。
添付のPDF（1ページ目）を確認し、以下のどの書類タイプに該当するか判定してください。

## 書類タイプ

1. **invoice** — オークション請求書・精算書
   - キーワード: 請求書, 精算書, 落札, オークション, 出品番号, ロット, 消費税, bid, auction
   - 特徴: 車台番号の一覧、費目（落札価格、手数料、保険料等）が記載
   - 例: USS, HAA, JU, TAA, CAA 等のオークション請求書

2. **export_cert** — 輸出抹消仮登録証明書（輸出抹消）
   - キーワード: 輸出抹消仮登録証明書, 輸出抹消, 輸出予定届出証明書
   - 特徴: 車台番号、登録番号、所有者名、抹消日が記載
   - 公的書類のフォーマット

3. **inspection_cert** — 自動車検査証（車検証）
   - キーワード: 自動車検査証, 車検証, 有効期間, 初度登録年月
   - 特徴: 車台番号、車名（メーカー）、型式、原動機型式、排気量、有効期限
   - 国土交通省発行のフォーマット

4. **temp_cancel** — 一時抹消登録証明書（一時抹消）
   - キーワード: 一時抹消登録証明書, 一時抹消, 登録識別情報
   - 特徴: 車台番号、登録番号、所有者名、抹消日
   - 公的書類のフォーマット

5. **unknown** — 上記のいずれにも該当しない

## 出力形式

以下のJSONのみを返してください。それ以外のテキストは含めないでください：

\`\`\`json
{
  "type": "invoice",
  "confidence": 0.95
}
\`\`\`

- type: 上記5つのいずれか
- confidence: 0.0〜1.0（判定の確信度）
- 確信が低い場合（0.7未満）は type を "unknown" にしてください`;
