import { useState, useEffect } from "react";
import ColumnPicker from "./ColumnPicker";
import FormulaBuilder from "./FormulaBuilder";
import FooterRowEditor from "./FooterRowEditor";

/**
 * Template editor form — combines ColumnPicker + FormulaBuilder + FooterRowEditor.
 * Used in the /exportTemplates page for create/edit.
 *
 * Props:
 *  - template: null (create) or ExportTemplateData (edit)
 *  - onSave: (data) => Promise<void>
 *  - onCancel: () => void
 *  - isSaving: boolean
 */
export default function ExportTemplateEditor({ template, onSave, onCancel, isSaving }) {
  const [name, setName] = useState("");
  const [columns, setColumns] = useState([]);
  const [computedColumns, setComputedColumns] = useState([]);
  const [footerRows, setFooterRows] = useState([]);
  const [showContainerNumber, setShowContainerNumber] = useState(true);
  const [showDate, setShowDate] = useState(true);
  const [error, setError] = useState("");

  // Populate form when editing existing template
  useEffect(() => {
    if (template) {
      setName(template.name || "");
      setColumns(template.columns || []);
      setComputedColumns(template.computedColumns || []);
      setFooterRows(template.footerRows || []);
      setShowContainerNumber(template.showContainerNumber ?? true);
      setShowDate(template.showDate ?? true);
    }
  }, [template]);

  const handleSave = () => {
    if (!name.trim()) {
      setError("テンプレート名を入力してください");
      return;
    }
    if (columns.length === 0) {
      setError("カラムを1つ以上選択してください");
      return;
    }
    setError("");
    onSave({
      name: name.trim(),
      columns,
      computedColumns,
      footerRows,
      showContainerNumber,
      showDate,
    });
  };

  return (
    <div className="space-y-6">
      {/* Error */}
      {error && (
        <div className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded">
          {error}
        </div>
      )}

      {/* Section 1: Template Name */}
      <div>
        <label className="block text-xs font-medium text-[var(--foreground)] mb-1">
          テンプレート名 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例: IB コンテナ計算書"
          className="w-full text-sm px-3 py-2 border border-[var(--border)] rounded bg-[var(--input)] text-[var(--foreground)]"
        />
      </div>

      {/* Header options */}
      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-xs text-[var(--foreground)] cursor-pointer">
          <input
            type="checkbox"
            checked={showContainerNumber}
            onChange={(e) => setShowContainerNumber(e.target.checked)}
            className="rounded"
          />
          コンテナ番号を表示
        </label>
        <label className="flex items-center gap-2 text-xs text-[var(--foreground)] cursor-pointer">
          <input
            type="checkbox"
            checked={showDate}
            onChange={(e) => setShowDate(e.target.checked)}
            className="rounded"
          />
          日付を表示
        </label>
      </div>

      {/* Section 2: Column Selection */}
      <div>
        <h3 className="text-xs font-medium text-[var(--foreground)] mb-2">
          エクスポートカラム <span className="text-red-500">*</span>
        </h3>
        <ColumnPicker selected={columns} onChange={setColumns} />
      </div>

      {/* Section 3: Computed Columns */}
      <div>
        <h3 className="text-xs font-medium text-[var(--foreground)] mb-2">
          計算カラム（オプション）
        </h3>
        <p className="text-[10px] text-[var(--secondary-foreground)] mb-2">
          フィールドと演算子を組み合わせて計算カラムを作成します。例: 落札額 + オークション手数料 + 輸送費
        </p>
        <FormulaBuilder computedColumns={computedColumns} onChange={setComputedColumns} />
      </div>

      {/* Section 4: Footer Rows */}
      <div>
        <h3 className="text-xs font-medium text-[var(--foreground)] mb-2">
          フッター行（オプション）
        </h3>
        <p className="text-[10px] text-[var(--secondary-foreground)] mb-2">
          Excel上で手入力する追加費用のラベルを設定します（金額セルは空欄）
        </p>
        <FooterRowEditor footerRows={footerRows} onChange={setFooterRows} />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border)]">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-xs font-medium bg-[var(--secondary)] text-[var(--secondary-foreground)] rounded hover:bg-[var(--border)] transition-colors"
        >
          キャンセル
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-2 text-xs font-medium bg-[var(--primary)] text-white rounded hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-colors"
        >
          {isSaving ? "保存中..." : template ? "更新" : "作成"}
        </button>
      </div>
    </div>
  );
}
