import { useState } from "react";
import { FORMULA_ALLOWED_FIELDS, FORMULA_ALLOWED_OPS } from "@/config/exportTypes";
import { Plus, X, Trash2 } from "lucide-react";

const FIELD_LABELS = {
  bidAmount: "落札額",
  auctionFee: "オークション手数料",
  insuranceFee: "保険料",
  recyclingFee: "リサイクル料",
  transportFee: "輸送費",
  otherFees: "その他費用",
  taxSum: "消費税",
  totalCost: "合計",
};

export default function FormulaBuilder({ computedColumns = [], onChange }) {
  const [newLabel, setNewLabel] = useState("");

  const addColumn = () => {
    if (!newLabel.trim()) return;
    const id = `computed_${Date.now()}`;
    onChange([...computedColumns, { id, label: newLabel.trim(), formula: [] }]);
    setNewLabel("");
  };

  const removeColumn = (idx) => {
    onChange(computedColumns.filter((_, i) => i !== idx));
  };

  const addToken = (ccIdx, type, value) => {
    const updated = [...computedColumns];
    updated[ccIdx] = {
      ...updated[ccIdx],
      formula: [...updated[ccIdx].formula, { type, value }],
    };
    onChange(updated);
  };

  const removeLastToken = (ccIdx) => {
    const updated = [...computedColumns];
    updated[ccIdx] = {
      ...updated[ccIdx],
      formula: updated[ccIdx].formula.slice(0, -1),
    };
    onChange(updated);
  };

  const renderFormula = (formula) => {
    return formula.map((token, i) => (
      <span
        key={i}
        className={`inline-block px-1.5 py-0.5 rounded text-[10px] mr-1 ${
          token.type === "field" ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 font-bold"
        }`}
      >
        {token.type === "field" ? (FIELD_LABELS[token.value] || token.value) : token.value}
      </span>
    ));
  };

  // Determine next expected token type
  const getNextTokenType = (formula) => {
    if (formula.length === 0) return "field";
    const last = formula[formula.length - 1];
    return last.type === "field" ? "op" : "field";
  };

  return (
    <div className="space-y-3">
      {computedColumns.map((cc, ccIdx) => {
        const nextType = getNextTokenType(cc.formula);

        return (
          <div key={cc.id} className="border border-[var(--border)] rounded p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--foreground)]">{cc.label}</span>
              <button onClick={() => removeColumn(ccIdx)} className="text-red-500 hover:text-red-700">
                <Trash2 size={14} />
              </button>
            </div>

            {/* Formula display */}
            <div className="min-h-[28px] bg-[var(--input)] rounded px-2 py-1 flex items-center flex-wrap gap-0.5">
              {cc.formula.length > 0 ? renderFormula(cc.formula) : (
                <span className="text-[10px] text-[var(--secondary-foreground)]">フィールドを追加してください</span>
              )}
              {cc.formula.length > 0 && (
                <button onClick={() => removeLastToken(ccIdx)} className="ml-1 text-red-400 hover:text-red-600">
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Token buttons */}
            {nextType === "field" ? (
              <div className="flex flex-wrap gap-1">
                {FORMULA_ALLOWED_FIELDS.map(f => (
                  <button
                    key={f}
                    onClick={() => addToken(ccIdx, "field", f)}
                    className="text-[10px] px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
                  >
                    {FIELD_LABELS[f] || f}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex gap-1">
                {FORMULA_ALLOWED_OPS.map(op => (
                  <button
                    key={op}
                    onClick={() => addToken(ccIdx, "op", op)}
                    className="text-sm px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 font-mono font-bold"
                  >
                    {op}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Add new computed column */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newLabel}
          onChange={e => setNewLabel(e.target.value)}
          placeholder="計算カラム名（例: Sum）"
          className="flex-1 text-xs px-2 py-1.5 border border-[var(--border)] rounded bg-[var(--input)] text-[var(--foreground)]"
          onKeyDown={e => e.key === "Enter" && addColumn()}
        />
        <button
          onClick={addColumn}
          disabled={!newLabel.trim()}
          className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
        >
          <Plus size={12} /> 追加
        </button>
      </div>
    </div>
  );
}
