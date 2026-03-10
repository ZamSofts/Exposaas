import { useState } from "react";
import { Plus, X } from "lucide-react";

export default function FooterRowEditor({ footerRows = [], onChange }) {
  const [newLabel, setNewLabel] = useState("");

  const addRow = () => {
    if (!newLabel.trim()) return;
    onChange([...footerRows, { label: newLabel.trim() }]);
    setNewLabel("");
  };

  const removeRow = (idx) => {
    onChange(footerRows.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      {footerRows.map((row, idx) => (
        <div
          key={idx}
          className="flex items-center gap-2 text-xs px-3 py-1.5 bg-[var(--input)] rounded"
        >
          <span className="flex-1 text-[var(--foreground)]">{row.label}</span>
          <button
            onClick={() => removeRow(idx)}
            className="text-red-400 hover:text-red-600"
          >
            <X size={14} />
          </button>
        </div>
      ))}

      <div className="flex gap-2">
        <input
          type="text"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="行ラベル（例: 船賃）"
          className="flex-1 text-xs px-2 py-1.5 border border-[var(--border)] rounded bg-[var(--input)] text-[var(--foreground)]"
          onKeyDown={(e) => e.key === "Enter" && addRow()}
        />
        <button
          onClick={addRow}
          disabled={!newLabel.trim()}
          className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
        >
          <Plus size={12} /> 追加
        </button>
      </div>
    </div>
  );
}
