import { useState, useRef, useEffect } from "react";
import { API } from "@/hooks/wrapper";
import InlineCellDropdown from "./InlineCellDropdown";
import InlineCellCombobox from "./InlineCellCombobox";
import { getColorForValue } from "@/lib/colorLabel";

// ─── Shared helpers ──────────────────────────────────────────

/** Normalize a value for local edit state based on field type. */
function normalizeValue(value, type) {
  if (type === "number") return String(Number(value || 0));
  if (type === "dropdown") return value ?? null;
  return value ?? "";
}

/** Read-only content — renders neutral badge with color dot, or plain text. */
function ReadOnlyContent({ text, dotColor }) {
  if (dotColor) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full text-[0.8rem] font-medium whitespace-nowrap"
        style={{
          backgroundColor: "var(--badge-bg)",
          border: "1px solid var(--badge-border)",
          color: "var(--badge-text)",
          padding: "2px 8px",
        }}
      >
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: dotColor }}
        />
        {text}
      </span>
    );
  }
  return <span className="text-sm text-[var(--foreground)]">{text}</span>;
}

// ─── TD class constants ──────────────────────────────────────
const TD_READONLY = "px-2 py-1 whitespace-nowrap border border-[var(--border)] overflow-hidden text-ellipsis";
const TD_CLICKABLE = "px-2 py-1 whitespace-nowrap cursor-pointer hover:bg-[var(--input)] transition-colors border border-[var(--border)] overflow-hidden text-ellipsis";
const TD_EDITING = "px-0.5 py-0.5 whitespace-nowrap border border-[var(--border)]";

/**
 * Polymorphic inline-editable table cell.
 *
 * Props:
 *   type         "number" | "text" | "dropdown" | "combobox" | "date"  (default: "number")
 *   value        Current value (number, string, or ID for relations)
 *   displayValue What to show in read-only mode (e.g., brand.name for brandId)
 *   vehicleId    Vehicle ID to update
 *   field        DB field name to update
 *   options      Array for dropdown: [{value, label}] / combobox: [{value, label}]
 *   onSaved      Callback after save — receives updated vehicle object
 *   onError      Callback on error — receives error message string
 *   editable     Boolean — if false, renders read-only
 *   isClearable  Boolean — for dropdown, allow clearing (default false)
 */
export default function EditableCell({
  type = "number",
  value,
  displayValue,
  vehicleId,
  field,
  options,
  onSaved,
  onError,
  editable = false,
  isClearable = false,
}) {
  const [editValue, setEditValue] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef(null);

  // Sync local state when parent value changes
  useEffect(() => {
    setEditValue(normalizeValue(value, type));
  }, [value, type]);

  // Auto-focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current && (type === "text" || type === "date")) {
      inputRef.current.focus();
      if (type === "text") inputRef.current.select();
    }
  }, [isEditing, type]);

  // ─── Save Logic ──────────────────────────────────────────
  const handleSave = async (newVal) => {
    const saveValue = newVal !== undefined ? newVal : editValue;

    // Skip if unchanged
    if (type === "number") {
      const newNum = saveValue === "" ? null : parseFloat(saveValue);
      const oldNum = value != null ? Number(value) : null;
      if (newNum === oldNum) { setIsEditing(false); return; }
    } else if (type === "dropdown") {
      if (saveValue === (value ?? null)) { setIsEditing(false); return; }
    } else {
      const newStr = (saveValue ?? "").toString().trim();
      const oldStr = (value ?? "").toString().trim();
      if (newStr === oldStr) { setIsEditing(false); return; }
    }

    setIsSaving(true);
    try {
      const payload = type === "number"
        ? (saveValue === "" ? null : parseFloat(saveValue))
        : saveValue;

      const result = await API("POST", "vehicleInlineUpdate", {
        id: vehicleId,
        field,
        value: payload,
      });

      if (result.error) {
        onError?.(result.error);
        revert();
        return;
      }
      setIsEditing(false);
      onSaved?.(result.vehicle);
    } catch (err) {
      onError?.("Failed to save");
      revert();
    } finally {
      setIsSaving(false);
    }
  };

  const revert = () => {
    setEditValue(normalizeValue(value, type));
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      inputRef.current?.blur();
    }
    if (e.key === "Escape") {
      revert();
    }
  };

  // ─── Computed display values ────────────────────────────────
  const readOnlyText = () => {
    if (displayValue !== undefined && displayValue !== null) return displayValue;
    if (type === "number") return Number(value || 0).toLocaleString();
    if (type === "date" && value) {
      try { return new Date(value).toLocaleDateString(); } catch { return value; }
    }
    return value || "-";
  };

  const dotColor = (type === "dropdown" || type === "combobox")
    ? getColorForValue(displayValue ?? value)
    : null;

  // ─── Read-Only Mode (not editable) ─────────────────────────
  if (!editable) {
    return (
      <td className={TD_READONLY}>
        <ReadOnlyContent text={readOnlyText()} dotColor={dotColor} />
      </td>
    );
  }

  // ─── Number: Always-visible input (Excel-style) ────────────
  if (type === "number") {
    return (
      <td className={TD_EDITING}>
        <input
          ref={inputRef}
          type="number"
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={() => handleSave()}
          onKeyDown={handleKeyDown}
          disabled={isSaving}
          className={`w-20 px-1.5 py-1 text-sm tabular-nums bg-transparent border border-transparent rounded
            text-[var(--foreground)] text-right
            hover:border-[var(--border)] focus:border-[var(--primary)] focus:bg-[var(--input)]
            focus:outline-none transition-colors
            ${isSaving ? "opacity-50" : ""}`}
          placeholder="-"
        />
      </td>
    );
  }

  // ─── Click-to-edit types (read display) ─────────────────────
  if (!isEditing) {
    return (
      <td className={TD_CLICKABLE} onClick={() => setIsEditing(true)}>
        <ReadOnlyContent text={readOnlyText()} dotColor={dotColor} />
      </td>
    );
  }

  // ─── Text Input ─────────────────────────────────────────────
  if (type === "text") {
    return (
      <td className={TD_EDITING}>
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={() => handleSave()}
          onKeyDown={handleKeyDown}
          disabled={isSaving}
          className={`w-full min-w-[80px] px-1.5 py-1 text-sm bg-[var(--input)] border border-[var(--primary)] rounded
            text-[var(--foreground)] focus:outline-none transition-colors
            ${isSaving ? "opacity-50" : ""}`}
          placeholder="-"
        />
      </td>
    );
  }

  // ─── Date Input ─────────────────────────────────────────────
  if (type === "date") {
    const dateVal = editValue ? (typeof editValue === "string" ? editValue.split("T")[0] : "") : "";
    return (
      <td className={TD_EDITING}>
        <input
          ref={inputRef}
          type="date"
          value={dateVal}
          onChange={e => setEditValue(e.target.value)}
          onBlur={() => handleSave()}
          onKeyDown={handleKeyDown}
          disabled={isSaving}
          className={`w-full min-w-[120px] px-1.5 py-1 text-sm bg-[var(--input)] border border-[var(--primary)] rounded
            text-[var(--foreground)] focus:outline-none transition-colors
            ${isSaving ? "opacity-50" : ""}`}
        />
      </td>
    );
  }

  // ─── Dropdown (relation fields) ─────────────────────────────
  if (type === "dropdown") {
    return (
      <td className={TD_EDITING} style={{ minWidth: "140px" }}>
        <InlineCellDropdown
          options={options || []}
          selectedValue={editValue}
          onChange={(newVal) => handleSave(newVal)}
          onBlur={() => handleSave()}
          onCancel={revert}
          isClearable={isClearable}
        />
      </td>
    );
  }

  // ─── Combobox (free text + suggestions) ─────────────────────
  if (type === "combobox") {
    return (
      <td className={TD_EDITING} style={{ minWidth: "140px" }}>
        <InlineCellCombobox
          options={options || []}
          currentValue={editValue}
          onChange={(newVal) => handleSave(newVal)}
          onBlur={() => handleSave()}
          onCancel={revert}
        />
      </td>
    );
  }

  return null;
}
