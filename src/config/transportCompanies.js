/**
 * Known transport companies for dropdown suggestions.
 * Used with <datalist> in the transport request form.
 * Last updated: 2026-04-14
 */

// 依頼書が必要な業者（共通フォーム or 専用フォーマット）
export const TRANSPORT_COMPANIES = [
  "ゼロ",           // ⚠️ 専用フォーマット必要
  "ハヤシダ",
  "ベスト",
  "キャリアメッセ", // 電話のみ・手配書が来る
  "アフザルコーポレーション", // 社長経由
  "MSJT",           // 社長経由（シャージさん）
];

// ゼロだけ専用フォーマットが必要
export const ZERO_TRANSPORT = "ゼロ";
