import { Error as ErrorMsg, CustomButton } from "@/hooks/wrapper";

/**
 * Reusable file upload modal with progress bar.
 *
 * Props:
 *   isOpen       Boolean — show/hide modal
 *   label        String — input label (e.g. "Upload CSV File")
 *   accept       String — file accept attribute (e.g. ".csv" or ".pdf")
 *   file         File | null — currently selected file (single mode)
 *   files        File[] — selected files (multi mode, optional)
 *   multiple     Boolean — allow multiple file selection (optional, default false)
 *   progress     Number — upload progress 0-100
 *   error        String — error message to display
 *   onFileChange Function — file input onChange handler
 *   onUpload     Function — upload button handler
 *   onCancel     Function — cancel/close handler
 *   modalRef     Ref — ref for click-outside detection
 */
export default function FileUploadModal({
  isOpen,
  label,
  accept,
  file,
  files,
  multiple,
  progress,
  error,
  onFileChange,
  onUpload,
  onCancel,
  modalRef,
}) {
  if (!isOpen) return null;

  const selectedFiles = files?.length > 0 ? files : file ? [file] : [];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div
        ref={modalRef}
        className="bg-[var(--surface)] border bounce border-[var(--border)] rounded-xl p-6 w-full max-w-md"
      >
        <h3 className="text-xl font-semibold text-[var(--foreground)] mb-4">Upload File</h3>
        <div className="space-y-4">
          <div>
            <label className="input-label">{label}</label>
            <input
              type="file"
              accept={accept}
              multiple={!!multiple}
              onChange={onFileChange}
              className="input-style"
            />
            {selectedFiles.length === 1 && (
              <p className="text-sm text-[var(--secondary-foreground)] mt-2">
                Selected file: <strong>{selectedFiles[0].name}</strong>
              </p>
            )}
            {selectedFiles.length > 1 && (
              <div className="text-sm text-[var(--secondary-foreground)] mt-2">
                <p><strong>{selectedFiles.length} files selected:</strong></p>
                <ul className="list-disc list-inside mt-1 max-h-24 overflow-y-auto">
                  {selectedFiles.map((f, i) => (
                    <li key={i} className="truncate">{f.name}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <ErrorMsg message={error} />
          {progress > 0 && (
            <div className="w-full bg-[var(--border)] rounded h-3 mb-2">
              <div
                className="bg-[var(--primary)] h-3 rounded transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
              <div className="text-xs text-right mt-1 text-[var(--foreground)]">{progress}%</div>
            </div>
          )}
          <div className="flex gap-3">
            <CustomButton title="Upload & Sync" onClick={onUpload} className="btn-primary" />
            <CustomButton
              title="Cancel"
              onClick={onCancel}
              className="px-4 py-2 bg-[var(--secondary)] hover:bg-[var(--border)] text-[var(--secondary-foreground)] rounded-lg font-medium transition-all duration-200"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
