import { useState, useEffect, useRef } from "react";
import { useConfirm, useAuth, Error, API, CustomSelect, CustomButton, Loader, Toast, FilePreviewer } from "@/hooks/wrapper";
import DataTable from "@/components/ui/DataTable";
import { Plus, Edit, Trash2, DollarSign, FileUp, Calendar, Building2 } from "lucide-react";

// Document Preview Component
const DocumentPreview = ({ document, onPreview, onRemove, onFileChange }) => {
  const currentDoc = document.file || document.existing;
  const isNewFile = !!document.file;

  const getPreviewElement = () => {
    if (isNewFile) {
      const isImage = document.file.type?.includes("image");
      const isPdf = document.file.type === "application/pdf";

      if (isImage) {
        return <img src={URL.createObjectURL(document.file)} alt={document.file.name} className="w-full h-full object-cover" />;
      } else if (isPdf) {
        return (
          <div className="text-red-500">
            <FileUp className="w-6 h-6" />
          </div>
        );
      } else {
        return <FileUp className="w-6 h-6 text-[var(--primary)]" />;
      }
    } else {
      const fileName = currentDoc?.fileName || "";
      const isImage = fileName.toLowerCase().match(/\.(jpg|jpeg|png)$/);
      const isPdf = fileName.toLowerCase().includes(".pdf");

      if (isImage) {
        return (
          <img
            src={currentDoc.url}
            alt={fileName}
            className="w-full h-full object-cover"
            onError={e => {
              e.target.style.display = "none";
              e.target.nextSibling.style.display = "flex";
            }}
          />
        );
      } else if (isPdf) {
        return (
          <div className="text-red-500">
            <FileUp className="w-6 h-6" />
          </div>
        );
      } else {
        return <FileUp className="w-6 h-6 text-[var(--primary)]" />;
      }
    }
  };

  return (
    <div className="border border-[var(--border)] rounded-lg bg-[var(--surface)] p-4">
      <div className="flex items-start gap-4">
        {/* Document Preview */}
        <div className="flex-shrink-0 w-16 h-16 border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--input)] flex items-center justify-center">{getPreviewElement()}</div>

        {/* Document Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--foreground)] truncate">{isNewFile ? document.file.name : currentDoc?.fileName || "Document"}</p>
              <p className="text-xs text-[var(--secondary-foreground)] mt-1">{isNewFile ? `${(document.file.size / 1024).toFixed(1)} KB` : "Existing document"}</p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {/* Preview Button */}
              <button
                type="button"
                onClick={() => onPreview(isNewFile ? URL.createObjectURL(document.file) : currentDoc.url, isNewFile ? document.file.name : currentDoc.fileName)}
                className="p-1 text-[var(--primary)] hover:bg-[var(--primary)]/10 rounded"
                title="Preview document"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              </button>

              {/* Remove Button */}
              <button type="button" onClick={onRemove} className="p-1 text-[var(--error)] hover:bg-[var(--error)]/10 rounded" title="Remove document">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Replace File Option */}
          <div className="mt-2">
            <label className="relative inline-flex items-center text-xs text-[var(--primary)] hover:underline cursor-pointer">
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={onFileChange} className="absolute opacity-0 w-0 h-0" />
              Replace file
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function Payments({ vehicleId }) {
  const { session, status } = useAuth();
  const { confirm, ConfirmComponent } = useConfirm();

  // Data states
  const [payments, setPayments] = useState([]);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [customLoader, setCustomLoader] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [remarks, setRemarks] = useState("");
  const [edit, setEdit] = useState(null);

  // Simplified document state
  const [documentState, setDocumentState] = useState({
    file: null, // New file to upload
    existing: null, // Existing document info
    original: null, // Original document for undo
    shouldRemove: false, // Flag to remove existing document
    preview: null, // Preview modal state
  });

  // Pagination and search states
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(5);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("id");
  const [sortOrder, setSortOrder] = useState("desc");

  // Toast state
  const [toast, setToast] = useState({ id: 0, message: "", type: "success" });

  // Modal ref for click outside
  const modalRef = useRef(null);

  // Load data when pagination, search, sorting, or vehicleId changes
  useEffect(() => {
    loadData();
  }, [currentPage, perPage, search, sortBy, sortOrder, vehicleId]);

  // Handle click outside modal to close
  useEffect(() => {
    const handleClickOutside = event => {
      // Only close edit modal if preview modal is not open and click is outside edit modal
      if (modalRef.current && !modalRef.current.contains(event.target) && !documentState.preview) {
        resetForm();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [documentState.preview]); // Add documentState.preview as dependency

  const showToast = (message, type = "success") => {
    setToast({ id: Date.now(), message, type });
  };

  // Document helper functions
  const validateFile = file => {
    const allowedTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    const allowedExtensions = ["pdf", "jpg", "jpeg", "png", "doc", "docx"];
    const fileExtension = file.name.split(".").pop()?.toLowerCase();

    if (!allowedExtensions.includes(fileExtension) || !allowedTypes.includes(file.type)) {
      return "Invalid file type. Only PDF, JPG, PNG, DOC, DOCX files are allowed.";
    }

    if (file.size > 5 * 1024 * 1024) {
      return "File size exceeds 5MB limit.";
    }

    return null;
  };

  const updateDocument = updates => {
    setDocumentState(prev => ({ ...prev, ...updates }));
  };

  const resetDocument = () => {
    setDocumentState({
      file: null,
      existing: null,
      original: null,
      shouldRemove: false,
      preview: null,
    });
  };

  const hasAnyDocument = () => documentState.file || documentState.existing;
  const shouldShowUploadArea = () => !documentState.file && !documentState.existing && !documentState.shouldRemove;
  const shouldShowRemovalState = () => documentState.shouldRemove && !documentState.file && !documentState.existing;

  const loadData = async () => {
    if (!vehicleId) {
      setPayments([]);
      setTotal(0);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: perPage.toString(),
        search: search.toString(),
        sortBy: sortBy.toString(),
        sortOrder: sortOrder.toString(),
        vehicleId: vehicleId.toString(),
      });

      const data = await API("GET", `vehiclePayments?${params}`);

      if (data.error) {
        setError(data.error);
        setPayments([]);
        setTotal(0);
        return;
      }

      // Handle both paginated and non-paginated responses
      if (data.payments !== undefined) {
        setPayments(data.payments || []);
        setTotal(data.total || 0);
      } else if (Array.isArray(data)) {
        setPayments(data);
        setTotal(data.length);
      } else {
        setPayments([]);
        setTotal(0);
      }
    } catch (error) {
      setError("Failed to load payments");
      setPayments([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSort = (column, order) => {
    setSortBy(column);
    setSortOrder(order);
  };

  const handleSearch = searchValue => {
    setSearch(searchValue);
    setCurrentPage(1); // Reset to first page on search
  };

  const handlePageChange = (page, perPageValue) => {
    setCurrentPage(page);
    setPerPage(perPageValue);
  };

  const handleFileChange = e => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      showToast(validationError, "error");
      return;
    }

    updateDocument({ file });
    setError("");
  };

  const editData = async () => {
    // Validation
    if (!name) {
      setError("Payment name is required");
      return;
    }
    if (!amount || amount.trim() === "") {
      setError("Amount is required");
      return;
    }
    if (isNaN(parseFloat(amount))) {
      setError("Amount must be a valid number");
      return;
    }
    if (!vehicleId) {
      setError("Vehicle ID is required");
      return;
    }

    setCustomLoader(true);
    setError("");

    try {
      // Build form data
      const formData = new FormData();
      formData.append("name", name);
      formData.append("amount", amount);
      formData.append("date", date);
      formData.append("remarks", remarks || "");
      formData.append("vehicleId", vehicleId);

      if (documentState.file) {
        formData.append("document", documentState.file);
      }

      if (edit !== 0 && documentState.shouldRemove) {
        formData.append("removeDocument", "true");
      }

      const isCreating = edit === 0;
      if (!isCreating) formData.append("id", edit);

      const response = await API(isCreating ? "PUT" : "POST", "vehiclePayments", formData, true);

      if (response.error) {
        setError(response.error);
        showToast(response.error, "error");
        return;
      }

      // Success message
      const baseMessage = isCreating ? "Payment created successfully" : "Payment updated successfully";
      const docMessage = response.fileUploaded ? " with new document" : response.documentRemoved ? " and document removed" : "";

      showToast(baseMessage + docMessage + "!", "success");
      resetForm();
      loadData();
    } catch (error) {
      setError("An unexpected error occurred");
      showToast("An unexpected error occurred", "error");
    } finally {
      setCustomLoader(false);
    }
  };

  const loadEdit = async id => {
    try {
      setCustomLoader(true);
      const data = await API("GET", `vehiclePayments?id=${id}`);

      if (data.error) {
        setError(data.error);
        showToast(data.error, "error");
        return;
      }

      // Set form data
      setName(data.name || "");
      setAmount(data.amount ? data.amount.toString() : "");
      setDate(data.date ? data.date.split("T")[0] : "");
      setRemarks(data.remarks || "");

      // Handle document
      if (data.url) {
        const fileData = {
          url: data.url,
          fileName: data.url.split("/").pop() || "Document",
        };
        setDocumentState({
          file: null,
          existing: fileData,
          original: fileData,
          shouldRemove: false,
          preview: null,
        });
      } else {
        resetDocument();
      }

      setEdit(id);
    } catch (error) {
      setError("Failed to load payment data");
      showToast("Failed to load payment data", "error");
    } finally {
      setCustomLoader(false);
    }
  };

  const deleteIt = async id => {
    const confirmed = await confirm({
      title: "Delete Payment",
      message: "Are you sure you want to delete this payment? This action cannot be undone and will also delete any associated document.",
      confirmText: "Delete",
      type: "danger",
    });

    if (!confirmed) return;

    try {
      setCustomLoader(true);
      const data = await API("DELETE", `vehiclePayments?id=${id}`);
      if (data.error) {
        setError(data.error);
        showToast(data.error, "error");
        return;
      }

      showToast(data.message, "success");
      loadData();
    } catch (error) {
      setError("Failed to delete payment");
      showToast("Failed to delete payment", "error");
    } finally {
      setCustomLoader(false);
    }
  };

  const resetForm = () => {
    setName("");
    setAmount("");
    setDate(new Date().toISOString().split("T")[0]);
    setRemarks("");
    setError("");
    setEdit(null);
    setCustomLoader(false);
    resetDocument();
  };

  // Calculate stats
  const totalAmount = payments.reduce((sum, payment) => sum + (parseFloat(payment.amount) || 0), 0);
  const totalPayments = payments.filter(payment => payment.amount >= 0).reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
  const totalExpenses = Math.abs(payments.filter(payment => payment.amount < 0).reduce((sum, payment) => sum + parseFloat(payment.amount), 0));
  const netBalance = totalPayments - totalExpenses;
  const paymentsThisMonth = payments.filter(payment => {
    if (!payment.date) return false; // Skip payments without date
    const paymentDate = new Date(payment.date);
    const now = new Date();
    return paymentDate.getMonth() === now.getMonth() && paymentDate.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="relative">
      {/* Header Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-semibold text-[var(--foreground)] mb-6">Vehicle Payments</h3>
          </div>
          <CustomButton title="Add Payment" onClick={() => setEdit(0)} className="btn-primary" icon={<Plus className="w-5 h-5" />} />
        </div>
      </div>

      {/* Add/Edit Payment Modal */}
      {edit !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div ref={modalRef} className="bg-[var(--surface)] border bounce border-[var(--border)] rounded-xl p-6 w-full max-w-2xl">
            <h3 className="text-xl font-semibold text-[var(--foreground)] mb-4">{edit === 0 ? "Add New Payment" : "Edit Payment"}</h3>
            <div className="space-y-6">
              {/* First Row: Payment Name, Amount and Date */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="input-label">Payment Name *</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Enter payment name..." className="input-style" autoFocus />
                </div>
                <div>
                  <label className="input-label">Amount *</label>
                  <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="input-style" />
                  <p className="text-xs text-[var(--secondary-foreground)] mt-1">Use positive for payments (+100.00), negative for expenses (-200.00)</p>
                </div>
                <div>
                  <label className="input-label">Payment Date</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input-style" />
                </div>
              </div>

              {/* Second Row: Remarks */}
              <div>
                <label className="input-label">Remarks</label>
                <textarea value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Enter additional remarks..." className="input-style" rows={3} />
              </div>

              {/* Third Row: Document Upload with Preview */}
              <div>
                <label className="input-label">Payment Document</label>

                {/* Upload Area */}
                {shouldShowUploadArea() ? (
                  <div className="relative">
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                    <div className="flex items-center justify-center w-full h-32 border-2 border-dashed border-[var(--border)] rounded-lg bg-[var(--input)] hover:bg-[var(--secondary)] transition-colors">
                      <div className="text-center">
                        <FileUp className="w-8 h-8 text-[var(--secondary-foreground)] mx-auto mb-2" />
                        <p className="text-sm text-[var(--foreground)] font-medium">Click to upload document</p>
                        <p className="text-xs text-[var(--secondary-foreground)] mt-1">PDF, JPG, PNG, DOC, DOCX (Max 5MB)</p>
                      </div>
                    </div>
                  </div>
                ) : shouldShowRemovalState() ? (
                  /* Document Removed State */
                  <div className="border border-[var(--border)] rounded-lg bg-[var(--surface)] p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[var(--error)]/10 flex items-center justify-center">
                          <svg className="w-5 h-5 text-[var(--error)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[var(--foreground)]">Document will be removed</p>
                          <p className="text-xs text-[var(--secondary-foreground)]">The existing document will be deleted when you save changes</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          updateDocument({
                            shouldRemove: false,
                            existing: documentState.original,
                            file: null,
                          })
                        }
                        className="text-[var(--primary)] hover:underline text-sm"
                        title="Undo removal"
                      >
                        Undo
                      </button>
                    </div>

                    {/* Upload new file option */}
                    <div className="mt-3 pt-3 border-t border-[var(--border)]">
                      <label className="relative inline-flex items-center text-sm text-[var(--primary)] hover:underline cursor-pointer">
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={handleFileChange} className="absolute opacity-0 w-0 h-0" />
                        Or upload a new document instead
                      </label>
                    </div>
                  </div>
                ) : (
                  /* Document Preview */
                  <DocumentPreview
                    document={documentState}
                    onPreview={(url, fileName) => updateDocument({ preview: { url, fileName } })}
                    onRemove={() => {
                      if (documentState.file) {
                        // Remove new file, keep removal state if there was an original
                        updateDocument({
                          file: null,
                          shouldRemove: edit !== 0 && documentState.original ? true : false,
                        });
                      } else if (documentState.existing && edit !== 0) {
                        // Remove existing file
                        updateDocument({
                          existing: null,
                          shouldRemove: true,
                        });
                      }
                      setError("");
                    }}
                    onFileChange={handleFileChange}
                  />
                )}

                <p className="text-xs text-[var(--secondary-foreground)] mt-2">Supported formats: PDF, JPG, PNG, DOC, DOCX (Max size: 5MB)</p>
              </div>

              <Error message={error} />
              {customLoader && <Loader />}

              <div className="flex gap-3">
                <CustomButton title={edit === 0 ? "Add Payment" : "Save Changes"} onClick={editData} className="btn-primary" />
                <CustomButton
                  title="Cancel"
                  onClick={resetForm}
                  className="px-4 py-2 bg-[var(--secondary)] hover:bg-[var(--border)] text-[var(--secondary-foreground)] rounded-lg font-medium transition-all duration-200"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <Error message={error} />

      {/* Payment Summary Cards
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--secondary-foreground)]">Total Payments</p>
              <p className="text-lg font-semibold text-green-600">+{totalPayments.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/10 rounded-lg">
              <DollarSign className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--secondary-foreground)]">Total Expenses</p>
              <p className="text-lg font-semibold text-red-600">-{totalExpenses.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${netBalance >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
              <DollarSign className={`w-5 h-5 ${netBalance >= 0 ? 'text-green-500' : 'text-red-500'}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--secondary-foreground)]">Net Balance</p>
              <p className={`text-lg font-semibold ${netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {netBalance >= 0 ? '+' : ''}{netBalance.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[var(--primary)]/10 rounded-lg">
              <Building2 className="w-5 h-5 text-[var(--primary)]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--secondary-foreground)]">Total Records</p>
              <p className="text-lg font-semibold text-[var(--foreground)]">{payments.length}</p>
            </div>
          </div>
        </div>
      </div> */}

      {/* DataTable */}

      <DataTable
        data={payments}
        total={total}
        isLoading={isLoading}
        searchPlaceholder="Search payments..."
        onSearch={handleSearch}
        onSort={handleSort}
        onPageChange={handlePageChange}
        title="Payments"
        sortBy={sortBy}
        sortOrder={sortOrder}
      >
        {/* Table Headers */}
        <thead className="bg-[var(--secondary)]">
          <tr>
            <th id="id">ID</th>
            <th id="name">Payment Name</th>
            <th id="amount">Amount</th>
            <th id="date">Payment Date</th>
            <th id="remarks">Remarks</th>
            <th>Document</th>
            <th id="createdAt">Created Date</th>
            <th className="text-right">Actions</th>
          </tr>
        </thead>

        {/* Table Body */}
        <tbody>
          {payments.map(payment => (
            <tr key={payment.id} className="hover:bg-[var(--input)] transition-colors duration-200">
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="text-sm font-mono text-[var(--secondary-foreground)]">#{payment.id.toString().padStart(3, "0")}</span>
              </td>

              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[var(--primary)]/10 rounded-lg">
                    <DollarSign className="w-4 h-4 text-[var(--primary)]" />
                  </div>
                  <div className="text-sm font-medium text-[var(--foreground)]">{payment.name}</div>
                </div>
              </td>

              <td className="px-6 py-4 whitespace-nowrap">
                <div className={`text-sm font-semibold ${payment.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {payment.amount >= 0 ? "+" : ""}
                  {Number(payment.amount).toFixed(2)}
                </div>
              </td>

              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-[var(--foreground)]">{payment.date ? new Date(payment.date).toLocaleDateString("en-GB") : "-"}</div>
              </td>

              <td className="px-6 py-4 max-w-[200px]">
                <div className="text-sm text-[var(--secondary-foreground)] truncate">{payment.remarks || "-"}</div>
              </td>

              <td className="px-6 py-4 whitespace-nowrap">
                {payment.url ? (
                  <button
                    onClick={() =>
                      updateDocument({
                        preview: {
                          url: payment.url,
                          fileName: payment.url.split("/").pop() || "Document",
                        },
                      })
                    }
                    className="text-[var(--primary)] hover:underline text-sm"
                  >
                    📄 View
                  </button>
                ) : (
                  <span className="text-[var(--secondary-foreground)] text-sm">-</span>
                )}
              </td>

              <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--secondary-foreground)]">{new Date(payment.createdAt).toLocaleString("en-GB")}</td>

              <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => loadEdit(payment.id)}
                    className="p-2 text-[var(--secondary-foreground)] hover:text-[var(--primary)] 
                                 hover:bg-[var(--primary)]/10 rounded-lg transition-all duration-200"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteIt(payment.id)}
                    className="p-2 text-[var(--secondary-foreground)] hover:text-[var(--error)] 
                               hover:bg-[var(--error)]/10 rounded-lg transition-all duration-200"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>

      {/* File Preview Modal */}
      {documentState.preview && (
        <FilePreviewer url={documentState.preview.url} fileName={documentState.preview.fileName} isOpen={true} onClose={() => updateDocument({ preview: null })} trigger={null} />
      )}

      {/* Confirmation Modal */}
      <ConfirmComponent />

      {/* Toast Notifications */}
      <Toast id={toast.id} type={toast.type} message={toast.message} onClose={() => setToast({ id: 0, message: "", type: "success" })} />
    </div>
  );
}
