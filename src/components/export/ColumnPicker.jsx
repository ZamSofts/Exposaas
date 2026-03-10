import { VEHICLE_COLUMNS } from "@/config/vehicleColumns";
import { ChevronUp, ChevronDown, X } from "lucide-react";

// Only show selectable columns (not static/actions)
const SELECTABLE = VEHICLE_COLUMNS.filter(c => !["static", "actions", "readonly-currency", "readonly-currency-primary"].includes(c.type));

export default function ColumnPicker({ selected = [], onChange }) {
  const selectedSet = new Set(selected);
  const available = SELECTABLE.filter(c => !selectedSet.has(c.id));

  const add = (id) => onChange([...selected, id]);
  const remove = (id) => onChange(selected.filter(c => c !== id));
  const moveUp = (i) => {
    if (i === 0) return;
    const next = [...selected];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    onChange(next);
  };
  const moveDown = (i) => {
    if (i === selected.length - 1) return;
    const next = [...selected];
    [next[i], next[i + 1]] = [next[i + 1], next[i]];
    onChange(next);
  };

  const labelMap = Object.fromEntries(VEHICLE_COLUMNS.map(c => [c.id, c.label]));

  return (
    <div className="flex gap-4">
      {/* Available */}
      <div className="flex-1">
        <p className="text-xs font-medium text-[var(--secondary-foreground)] mb-2">利用可能なカラム</p>
        <div className="border border-[var(--border)] rounded p-2 max-h-48 overflow-y-auto space-y-1">
          {available.map(col => (
            <button
              key={col.id}
              onClick={() => add(col.id)}
              className="block w-full text-left text-xs px-2 py-1.5 rounded hover:bg-[var(--input)] text-[var(--foreground)] transition-colors"
            >
              + {col.label}
            </button>
          ))}
          {available.length === 0 && (
            <p className="text-xs text-[var(--secondary-foreground)] px-2 py-1">すべて選択済み</p>
          )}
        </div>
      </div>

      {/* Selected */}
      <div className="flex-1">
        <p className="text-xs font-medium text-[var(--secondary-foreground)] mb-2">選択中 ({selected.length})</p>
        <div className="border border-[var(--border)] rounded p-2 max-h-48 overflow-y-auto space-y-1">
          {selected.map((id, i) => (
            <div key={id} className="flex items-center gap-1 text-xs px-2 py-1 bg-[var(--input)] rounded">
              <span className="flex-1 text-[var(--foreground)]">{labelMap[id] || id}</span>
              <button onClick={() => moveUp(i)} className="p-0.5 hover:text-blue-500" title="上に移動">
                <ChevronUp size={12} />
              </button>
              <button onClick={() => moveDown(i)} className="p-0.5 hover:text-blue-500" title="下に移動">
                <ChevronDown size={12} />
              </button>
              <button onClick={() => remove(id)} className="p-0.5 hover:text-red-500" title="削除">
                <X size={12} />
              </button>
            </div>
          ))}
          {selected.length === 0 && (
            <p className="text-xs text-[var(--secondary-foreground)] px-2 py-1">カラムを選択してください</p>
          )}
        </div>
      </div>
    </div>
  );
}
