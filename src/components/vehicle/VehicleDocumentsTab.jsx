import { Plus, FileUp } from "lucide-react";

export default function VehicleDocumentsTab({
  vehicleDocuments,
  handleDocumentChange,
  removeDocument,
  setPreviewFile,
}) {
  return (
    <div>
      <h3 className="text-xl font-semibold text-[var(--foreground)] mb-6">Vehicle Documents</h3>
      <div className="vehicle-doc-style">
        {/* Add Document Tile */}
        <div className="relative">
          <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" multiple onChange={handleDocumentChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
          <div className="vehicle-doc-upload-button">
            <Plus className="w-6 h-6 text-[var(--secondary-foreground)] mb-1" />
            <span className="text-xs text-[var(--secondary-foreground)] text-center px-1">Add Documents</span>
          </div>
        </div>

        {/* Document Tiles */}
        {vehicleDocuments.map(docObj => (
          <div key={docObj.id} className="relative group">
            <div className="vehicle-doc-display">
              <div
                className="flex-1 flex flex-col items-center justify-center cursor-pointer hover:bg-[var(--secondary)]/30 rounded transition-colors"
                onClick={() =>
                  setPreviewFile({
                    url: docObj.isExisting ? docObj.docUrl : docObj.previewUrl,
                    fileName: docObj.name,
                  })
                }
              >
                {docObj.isExisting ? (
                  docObj.type === "image" ? (
                    <img src={docObj.docUrl} alt={docObj.name} className="w-8 h-8 object-cover rounded mb-1" />
                  ) : (
                    <FileUp className="w-5 h-5 text-[var(--primary)] mb-1" />
                  )
                ) : docObj.type && docObj.type.includes("image") ? (
                  <img src={docObj.previewUrl} alt={docObj.name} className="w-8 h-8 object-cover rounded mb-1" />
                ) : (
                  <FileUp className="w-5 h-5 text-[var(--primary)] mb-1" />
                )}
                <div className="text-xs text-[var(--foreground)] text-center break-words leading-tight">
                  {docObj.name && docObj.name.length > 15 ? docObj.name.substring(0, 12) + "..." : docObj.name || ""}
                </div>
                <div className="text-xs text-[var(--secondary-foreground)] mt-1">{docObj.isExisting ? "Existing" : `${(docObj.size / 1024).toFixed(1)} KB`}</div>
              </div>
              <button onClick={() => removeDocument(docObj.id)} className="vehicle-doc-remove-button">
                ×
              </button>
            </div>
          </div>
        ))}
      </div>

      {vehicleDocuments.length > 0 && (
        <div className="mt-4 p-3 bg-[var(--input)] rounded-lg text-sm text-[var(--secondary-foreground)]">
          <span className="font-medium">{vehicleDocuments.length} document(s) selected</span>
          <span className="ml-2">({(vehicleDocuments.reduce((acc, doc) => acc + doc.size, 0) / 1024).toFixed(1)} KB total)</span>
        </div>
      )}
      <p className="text-xs text-[var(--secondary-foreground)] mt-3">Supported formats: PDF, JPG, PNG, DOC, DOCX (Max size per file: 5MB, Max files: 15)</p>
    </div>
  );
}
