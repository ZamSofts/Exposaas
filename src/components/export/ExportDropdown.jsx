import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/router";
import { FileDown, Settings, ChevronDown, Loader2, Download } from "lucide-react";

/**
 * Export dropdown on the vehicle toolbar.
 * Shows list of saved templates; click to open filename dialog, then download.
 *
 * Props:
 *  - templates: { id, name }[]
 *  - onExport: (templateId, filename) => Promise<void>
 *  - isExporting: boolean
 */
export default function ExportDropdown({ templates = [], onExport, isExporting }) {
  const [isOpen, setIsOpen] = useState(false);
  const [pending, setPending] = useState(null); // { id, name } — selected template awaiting filename
  const [filename, setFilename] = useState("");
  const ref = useRef(null);
  const inputRef = useRef(null);
  const router = useRouter();

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Auto-focus filename input when dialog opens
  useEffect(() => {
    if (pending && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [pending]);

  const handleSelectTemplate = (template) => {
    setIsOpen(false);
    setFilename(template.name);
    setPending(template);
  };

  const handleConfirmExport = async () => {
    if (!pending) return;
    const exportFilename = filename.trim() || pending.name;
    setPending(null);
    setFilename("");
    await onExport(pending.id, exportFilename);
  };

  const handleCancelExport = () => {
    setPending(null);
    setFilename("");
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isExporting}
        className="flex items-center gap-1 px-2 py-1 text-xs font-medium
                   bg-[var(--secondary)] text-[var(--foreground)] border border-[var(--border)]
                   rounded hover:bg-[var(--border)] transition-colors disabled:opacity-50"
      >
        {isExporting ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <FileDown className="w-3.5 h-3.5" />
        )}
        Export
        <ChevronDown className="w-3 h-3" />
      </button>

      {/* Template list dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg z-50 py-1">
          {templates.length > 0 ? (
            templates.map((t) => (
              <button
                key={t.id}
                onClick={() => handleSelectTemplate(t)}
                className="w-full text-left px-3 py-2 text-xs text-[var(--foreground)] hover:bg-[var(--secondary)] transition-colors flex items-center gap-2"
              >
                <FileDown className="w-3.5 h-3.5 text-[var(--secondary-foreground)]" />
                {t.name}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-xs text-[var(--secondary-foreground)]">
              テンプレートがありません
            </div>
          )}

          <div className="border-t border-[var(--border)] mt-1 pt-1">
            <button
              onClick={() => {
                setIsOpen(false);
                router.push("/exportTemplates");
              }}
              className="w-full text-left px-3 py-2 text-xs text-[var(--secondary-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)] transition-colors flex items-center gap-2"
            >
              <Settings className="w-3.5 h-3.5" />
              テンプレート管理
            </button>
          </div>
        </div>
      )}

      {/* Filename dialog */}
      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={handleCancelExport}>
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="relative bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl p-5 w-80"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-[var(--foreground)] mb-3">
              ファイル名を入力
            </h3>
            <p className="text-[10px] text-[var(--secondary-foreground)] mb-3">
              テンプレート: {pending.name}
            </p>
            <input
              ref={inputRef}
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConfirmExport()}
              placeholder="例: MORU1234567"
              className="w-full text-sm px-3 py-2 border border-[var(--border)] rounded bg-[var(--input)] text-[var(--foreground)] mb-1"
            />
            <p className="text-[10px] text-[var(--secondary-foreground)] mb-4">
              {(filename.trim() || pending.name)}_{new Date().toISOString().slice(0, 10)}.xlsx
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={handleCancelExport}
                className="px-3 py-1.5 text-xs font-medium bg-[var(--secondary)] text-[var(--secondary-foreground)] rounded hover:bg-[var(--border)] transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleConfirmExport}
                className="px-3 py-1.5 text-xs font-medium bg-[var(--primary)] text-white rounded hover:bg-[var(--primary-hover)] transition-colors flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                ダウンロード
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
