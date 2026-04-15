/**
 * POS番号：会場グループ別の固定番号
 * 陸送依頼書に記載が必要
 */
const POS_RULES = [
  { keywords: ["USS", "HAA", "JAA", "LAA"], posNumber: "O7029" },
  { keywords: ["TAA", "CAA"],               posNumber: "59559" },
  // 他グループは判明次第追加
];

/**
 * 会場名からPOS番号を返す
 * @param {string|null} venueStr
 * @returns {string|null}
 */
export function getPosNumber(venueStr) {
  if (!venueStr) return null;
  const upper = venueStr.toUpperCase();
  for (const rule of POS_RULES) {
    if (rule.keywords.some(k => upper.includes(k.toUpperCase()))) {
      return rule.posNumber;
    }
  }
  return null;
}
