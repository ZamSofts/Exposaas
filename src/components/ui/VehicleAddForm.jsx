import { useState, useEffect } from "react";
import Head from "next/head";
import { useAuth, Error, API, CustomSelect, CustomButton, FilePreviewer, Toast, Loader } from "@/hooks/wrapper";
import Sidebar from "@/components/Sidebar";
import { Car, FileUp, ArrowLeft, Save, Plus } from "lucide-react";

export const VehicleAddForm = ({ vehicleId = null, onBack, onSuccess }) => {
  const { session, status } = useAuth();

  const [brand, setBrand] = useState([]);
  const [vehicleStatus, setVehicleStatus] = useState([]);
  const [error, setError] = useState("");
  const [customLoader, setCustomLoader] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [brandId, setBrandId] = useState(null);
  const [chassisNumber, setChassisNumber] = useState("");
  const [lotNumber, setLotNumber] = useState("");
  const [auction, setAuction] = useState("");
  const [companyId, setCompanyId] = useState(session?.companyId || null);
  const [statusId, setStatusId] = useState(0);
  const [remarks, setRemarks] = useState("");

  // Vehicle documents upload states
  const [vehicleDocuments, setVehicleDocuments] = useState([]);
  const [documentsToDelete, setDocumentsToDelete] = useState([]);
  const [previewFile, setPreviewFile] = useState(null);

  // Vehicle payments states
  const [vehiclePayments, setVehiclePayments] = useState([]);
  const [paymentsToDelete, setPaymentsToDelete] = useState([]);

  // Toast state
  const [toast, setToast] = useState({ id: 0, message: "", type: "success" });

  const isEditMode = vehicleId !== null && vehicleId !== 0;

  useEffect(() => {
    if (status === "authenticated" && session) {
      setCompanyId(Number(session.companyId));
      loadInitialData();
    }
  }, [status, session]);

  useEffect(() => {
    if (isEditMode) {
      loadData();
    }
  }, [vehicleId]);

  const showToast = (message, type = "success") => {
    setToast({ id: Date.now(), message, type });
  };

  const loadInitialData = async () => {
    setCustomLoader(true);
    setError("");
    try {
      const [brandData, statusData] = await Promise.all([API("GET", "brand"), API("GET", "vehicleStatus")]);
      setBrand(!brandData.error ? brandData : []);
      setVehicleStatus(!statusData.error ? statusData : []);
    } catch {
      setError("Something went wrong");
    } finally {
      setCustomLoader(false);
    }
  };

  const loadData = async () => {
    setCustomLoader(true);
    const data = await API("GET", `vehicle?id=${vehicleId}`);
    if (data.error) {
      setError(data.error);
      showToast(data.error, "error");
      setCustomLoader(false);
      return;
    }

    // Populate form fields
    setName(data.name || "");
    setBrandId(data.brandId);
    setChassisNumber(data.chassisNumber);
    setCompanyId(data.companyId);
    setStatusId(data.statusId);
    setLotNumber(data.lotNumber || "");
    setAuction(data.auction || "");
    setRemarks(data.remarks || "");

    setDocumentsToDelete([]);

    // Map existing documents
    const existingDocs = (data.documents || []).map(doc => ({
      id: doc.id,
      name: doc.Url.split("/").pop(),
      docUrl: doc.Url,
      isExisting: true,
      size: 0,
      type: doc.Url.toLowerCase().includes(".jpg") || doc.Url.toLowerCase().includes(".jpeg") || doc.Url.toLowerCase().includes(".png") ? "image" : "document",
    }));
    setVehicleDocuments(existingDocs);

    // Map existing payments
    const existingPayments = (data.payments || []).map(payment => ({
      id: payment.id,
      name: payment.name,
      date: payment.date ? payment.date.split("T")[0] : "", // Format date for input
      remarks: payment.remarks || "",
      url: payment.url || "",
      isExisting: true,
    }));
    setVehiclePayments(existingPayments);
    setPaymentsToDelete([]);

    setCustomLoader(false);
  };

  const handleDocumentChange = e => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (vehicleDocuments.length + files.length > 15) {
      showToast("You can upload a maximum of 15 files.", "error");
      setError("You can upload a maximum of 15 files.");
      return;
    }

    const validFiles = [];
    const invalidFiles = [];
    const allowedTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    const allowedExtensions = ["pdf", "jpg", "jpeg", "png", "doc", "docx"];

    files.forEach(file => {
      const fileExtension = file.name.split(".").pop()?.toLowerCase();
      if (allowedExtensions.includes(fileExtension) && allowedTypes.includes(file.type)) {
        if (file.size > 5 * 1024 * 1024) {
          showToast(`File ${file.name} exceeds the 5MB size limit.`, "error");
          setError(`File ${file.name} exceeds the 5MB size limit.`);
          invalidFiles.push(file.name);
        } else {
          validFiles.push({
            id: Date.now() + Math.random(),
            file,
            name: file.name,
            size: file.size,
            type: file.type,
          });
        }
      } else {
        invalidFiles.push(file.name);
      }
    });

    if (invalidFiles.length > 0) {
      setError(`Invalid files: ${invalidFiles.join(", ")}. Only PDF, JPG, PNG, DOC, DOCX files are allowed! and must be under 5MB.`);
    } else {
      setError("");
    }

    setVehicleDocuments(prev => [...prev, ...validFiles]);
    e.target.value = "";
  };

  const removeDocument = fileId => {
    const documentToRemove = vehicleDocuments.find(doc => doc.id === fileId);

    if (documentToRemove && documentToRemove.isExisting) {
      setDocumentsToDelete(prev => [...prev, documentToRemove.id]);
    }

    setVehicleDocuments(prev => prev.filter(file => file.id !== fileId));
    setError("");
  };

  // Payment management functions
  const addPayment = () => {
    const newPayment = {
      id: Date.now() + Math.random(), // Generate unique ID for tracking
      name: "",
      date: "",
      remarks: "",
      url: "",
      isExisting: false,
    };
    setVehiclePayments(prev => [...prev, newPayment]);
  };

  const updatePayment = (paymentId, field, value) => {
    setVehiclePayments(prev => prev.map((payment, index) => 
      payment.id === paymentId ? { ...payment, [field]: value, index } : payment
    ));
  };

  const removePayment = paymentId => {
    const paymentToRemove = vehiclePayments.find(payment => payment.id === paymentId);

    if (paymentToRemove && paymentToRemove.isExisting) {
      setPaymentsToDelete(prev => [...prev, paymentToRemove.id]);
    }

    setVehiclePayments(prev => prev.filter(payment => payment.id !== paymentId));
  };

  const handlePaymentFileChange = (paymentId, file) => {
    if (!file) return;

    // Validate file type and size
    const allowedTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    const allowedExtensions = ["pdf", "jpg", "jpeg", "png", "doc", "docx"];
    const fileExtension = file.name.split(".").pop()?.toLowerCase();

    if (!allowedExtensions.includes(fileExtension) || !allowedTypes.includes(file.type)) {
      showToast(`Invalid file type. Only PDF, JPG, PNG, DOC, DOCX files are allowed.`, "error");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast(`File ${file.name} exceeds the 5MB size limit.`, "error");
      return;
    }

    // Update payment with the selected file
    setVehiclePayments(prev => prev.map((payment, index) => 
      payment.id === paymentId ? { ...payment, documentFile: file, index } : payment
    ));
  };

  const editData = async () => {
    if (!brandId || !chassisNumber || !statusId) {
      setError(!brandId ? "Please select a brand" : !chassisNumber ? "Chassis number is required" : "Please select current status");
      return;
    }

    setCustomLoader(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("name", name);
      formData.append("brandId", brandId);
      formData.append("chassisNumber", chassisNumber);
      formData.append("companyId", Number(session.companyId));
      formData.append("statusId", statusId);
      formData.append("lotNumber", lotNumber);
      formData.append("auction", auction);
      formData.append("remarks", remarks);

      // Only append new vehicle document files
      const newFiles = vehicleDocuments.filter(docObj => !docObj.isExisting && docObj.file);
      newFiles.forEach(docObj => {
        formData.append("documents", docObj.file);
      });

      // Add payment data to FormData
      const validPayments = vehiclePayments.filter(payment => payment.name && payment.name.trim() !== "" && payment.date);
      
      // Send payment details as JSON string for new payments (in add mode) or payments to process
      if (!isEditMode) {
        // For add mode, send all new payments
        const newPayments = validPayments.map((payment, index) => ({
          name: payment.name.trim(),
          date: payment.date,
          remarks: payment.remarks?.trim() || null,
          hasFile: !!payment.documentFile,
        }));
        formData.append("payments", JSON.stringify(newPayments));
        
        // Append payment files with specific naming convention
        validPayments.forEach((payment, index) => {
          if (payment.documentFile) {
            formData.append(`paymentFile_${index}`, payment.documentFile);
          }
        });
      } else {
        // For edit mode, send all payment operations
        const paymentsWithFiles = validPayments.filter(p => p.documentFile);
        let fileIndex = 0;
        
        const paymentOperations = {
          toDelete: paymentsToDelete,
          toUpdate: validPayments.filter(p => p.isExisting && p.id).map(payment => {
            const result = {
              id: payment.id,
              name: payment.name.trim(),
              date: payment.date,
              remarks: payment.remarks?.trim() || null,
              hasFile: !!payment.documentFile,
              fileIndex: payment.documentFile ? fileIndex : null,
            };
            if (payment.documentFile) fileIndex++;
            return result;
          }),
          toCreate: validPayments.filter(p => !p.isExisting).map(payment => {
            const result = {
              name: payment.name.trim(),
              date: payment.date,
              remarks: payment.remarks?.trim() || null,
              hasFile: !!payment.documentFile,
              fileIndex: payment.documentFile ? fileIndex : null,
            };
            if (payment.documentFile) fileIndex++;
            return result;
          }),
        };
        formData.append("paymentOperations", JSON.stringify(paymentOperations));
        
        // Append payment files with specific naming convention
        fileIndex = 0;
        validPayments.forEach(payment => {
          if (payment.documentFile) {
            formData.append(`paymentFile_${fileIndex}`, payment.documentFile);
            fileIndex++;
          }
        });
        
        formData.append("id", vehicleId);
        formData.append("documentsToDelete", JSON.stringify(documentsToDelete));
      }

      let response;
      if (!isEditMode) {
        response = await API("PUT", "vehicle", formData, true);
      } else {
        response = await API("POST", "vehicle", formData, true);
      }

      if (response.error) {
        setError(response.error);
        showToast(response.error, "error");
        return;
      }

      showToast(
        !isEditMode
          ? `Vehicle added successfully! ${response.documentsUploaded || 0} document(s) uploaded${response.paymentsProcessed > 0 ? `, ${response.paymentsProcessed} payment(s) processed` : ""}.`
          : `Vehicle updated successfully! ${response.documentsUploaded || 0} document(s) uploaded, ${response.documentsDeleted || 0} document(s) deleted${
              response.paymentsProcessed > 0 ? `, ${response.paymentsProcessed} payment(s) processed` : ""
            }${response.paymentsDeleted > 0 ? `, ${response.paymentsDeleted} payment(s) deleted` : ""}.`,
        "success"
      );

    } catch (error) {
      setError("An unexpected error occurred");
      showToast("An unexpected error occurred", "error");
    } finally {
      setCustomLoader(false);
    }
  };

  return (
    <>
      <Head>
        <title>{isEditMode ? "Edit Vehicle" : "Add Vehicle"} - ExpoSaaS</title>
      </Head>
      <Sidebar>
        <div className="p-8 bg-[var(--background)] min-h-screen relative">
          {/* Header Section */}
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={onBack} className="p-2 bg-[var(--surface)] rounded-lg border border-[var(--border)] hover:bg-[var(--input)] transition-colors">
                <ArrowLeft className="w-5 h-5 text-[var(--foreground)]" />
              </button>
              <div className="p-2 bg-[var(--surface)] rounded-lg border border-[var(--border)]">
                <Car className="w-6 h-6 text-[var(--primary)]" />
              </div>
              <h1 className="text-3xl font-bold text-[var(--foreground)]">{isEditMode ? "Edit Vehicle" : "Add New Vehicle"}</h1>
            </div>
            <div className="flex gap-3">
              <CustomButton title={isEditMode ? "Update Vehicle" : "Save Vehicle"} onClick={editData} className="btn-primary" icon={<Save className="w-5 h-5" />} />
              <CustomButton title="Cancel" onClick={onBack} className="px-4 py-2 bg-[var(--secondary)] hover:bg-[var(--border)] rounded-lg" />
            </div>
          </div>

          <Error message={error} />
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6">
              {/* Basic Information Section */}
              <div className="mb-8">
                <h3 className="text-xl font-semibold text-[var(--foreground)] mb-6 border-b border-[var(--border)] pb-3">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="input-label">Vehicle Name</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} className="input-style" placeholder="Enter vehicle name..." />
                  </div>
                  <div>
                    <label className="input-label">Brand *</label>
                    <CustomSelect data={brand} selectedId={brandId} setSelectedId={setBrandId} />
                  </div>
                  <div>
                    <label className="input-label">Current Status *</label>
                    <CustomSelect data={vehicleStatus} selectedId={statusId} setSelectedId={setStatusId} />
                  </div>
                  <div>
                    <label className="input-label">Chassis Number *</label>
                    <input type="text" value={chassisNumber} onChange={e => setChassisNumber(e.target.value)} className="input-style" placeholder="Enter chassis number..." />
                  </div>
                  <div>
                    <label className="input-label">Lot Number</label>
                    <input type="text" value={lotNumber} onChange={e => setLotNumber(e.target.value)} className="input-style" placeholder="Enter lot number..." />
                  </div>
                  <div>
                    <label className="input-label">Auction</label>
                    <input type="text" value={auction} onChange={e => setAuction(e.target.value)} className="input-style" placeholder="Enter auction..." />
                  </div>
                  <div className="col-span-1 md:col-span-3">
                    <label className="input-label">Remarks</label>
                    <textarea value={remarks} onChange={e => setRemarks(e.target.value)} className="input-style" placeholder="Enter remarks..." rows={3} />
                  </div>
                </div>
              </div>
              {/* Vehicle Payments Section */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-[var(--foreground)] border-b border-[var(--border)] pb-3 flex-1">Vehicle Payments</h3>
                  <CustomButton title="Add Payment" onClick={addPayment} className="btn-primary" icon={<Plus className="w-4 h-4" />} />
                </div>

                {vehiclePayments.length === 0 ? (
                  <div className="text-center py-8 text-[var(--secondary-foreground)]">
                    <p>No payments added yet. Click "Add Payment" to get started.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {vehiclePayments.map((payment, index) => (
                      <div key={payment.id} className="bg-[var(--input)] rounded-lg p-4 border border-[var(--border)]">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-medium text-[var(--foreground)]">Payment #{index + 1}</h4>
                          <button onClick={() => removePayment(payment.id)} className="p-1 text-[var(--error)] hover:bg-[var(--error)]/10 rounded">
                            ×
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="input-label">Payment Name *</label>
                            <input
                              type="text"
                              value={payment.name}
                              onChange={e => updatePayment(payment.id, "name", e.target.value)}
                              className="input-style"
                              placeholder="Enter payment name..."
                              required
                            />
                          </div>
                          <div>
                            <label className="input-label">Payment Date *</label>
                            <input type="date" value={payment.date} onChange={e => updatePayment(payment.id, "date", e.target.value)} className="input-style" required />
                          </div>
                          <div>
                            <label className="input-label">Payment Document</label>
                            <div className="flex gap-2">
                              {/* Upload Area */}
                              <div className="relative flex-1">
                                <input 
                                  type="file" 
                                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" 
                                  onChange={e => handlePaymentFileChange(payment.id, e.target.files[0])} 
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                                />
                                <div className="h-10 border-2 border-dashed border-[var(--border)] rounded-md flex items-center justify-center hover:border-[var(--primary)] transition-colors bg-[var(--background)]">
                                  <FileUp className="w-4 h-4 text-[var(--secondary-foreground)] mr-1" />
                                  <span className="text-xs text-[var(--secondary-foreground)]">
                                    {payment.documentFile ? "Change" : "Choose"}
                                  </span>
                                </div>
                              </div>

                              {/* Document Preview */}
                              {(payment.documentFile || payment.url) && (
                                <div className="relative">
                                  <div 
                                    className="w-10 h-10 border border-[var(--border)] rounded-md flex items-center justify-center cursor-pointer hover:bg-[var(--input)] transition-colors bg-[var(--surface)]"
                                    onClick={() => {
                                      if (payment.documentFile) {
                                        setPreviewFile({
                                          url: URL.createObjectURL(payment.documentFile),
                                          fileName: payment.documentFile.name,
                                        });
                                      } else if (payment.url) {
                                        setPreviewFile({
                                          url: payment.url,
                                          fileName: payment.url.split("/").pop() || "Document",
                                        });
                                      }
                                    }}
                                  >
                                    {payment.documentFile ? (
                                      payment.documentFile.type.includes("image") ? (
                                        <img 
                                          src={URL.createObjectURL(payment.documentFile)} 
                                          alt={payment.documentFile.name} 
                                          className="w-6 h-6 object-cover rounded" 
                                        />
                                      ) : (
                                        <FileUp className="w-4 h-4 text-[var(--primary)]" />
                                      )
                                    ) : payment.url ? (
                                      payment.url.toLowerCase().includes(".jpg") || 
                                      payment.url.toLowerCase().includes(".jpeg") || 
                                      payment.url.toLowerCase().includes(".png") ? (
                                        <img 
                                          src={payment.url} 
                                          alt="Payment document" 
                                          className="w-6 h-6 object-cover rounded" 
                                        />
                                      ) : (
                                        <FileUp className="w-4 h-4 text-[var(--primary)]" />
                                      )
                                    ) : null}
                                  </div>
                                  
                                  {/* Remove document button */}
                                  {payment.documentFile && (
                                    <button
                                      onClick={() => updatePayment(payment.id, "documentFile", null)}
                                      className="absolute -top-1 -right-1 w-4 h-4 bg-[var(--error)] text-white rounded-full flex items-center justify-center text-xs hover:bg-[var(--error)]/80 transition-colors"
                                    >
                                      ×
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* File Info */}
                            {payment.documentFile && (
                              <div className="mt-1 text-xs text-[var(--secondary-foreground)]">
                                📄 {payment.documentFile.name.length > 20 ? 
                                  payment.documentFile.name.substring(0, 17) + "..." : 
                                  payment.documentFile.name} ({(payment.documentFile.size / 1024).toFixed(1)} KB)
                              </div>
                            )}

                            {payment.url && !payment.documentFile && (
                              <div className="mt-1 text-xs text-[var(--secondary-foreground)]">
                                📄 <a 
                                  href={payment.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="text-[var(--primary)] hover:underline"
                                >
                                  Current Document
                                </a>
                              </div>
                            )}
                          </div>
                          <div>
                            <label className="input-label">Remarks</label>
                            <input type="text" value={payment.remarks} onChange={e => updatePayment(payment.id, "remarks", e.target.value)} className="input-style" placeholder="Enter remarks..." />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Vehicle Documents Section */}
              <div className="mb-8">
                <h3 className="text-xl font-semibold text-[var(--foreground)] mb-6 border-b border-[var(--border)] pb-3">Vehicle Documents</h3>
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
                              url: docObj.isExisting ? docObj.docUrl : URL.createObjectURL(docObj.file),
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
                            <img src={URL.createObjectURL(docObj.file)} alt={docObj.name} className="w-8 h-8 object-cover rounded mb-1" />
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
            </div>
          {customLoader && <Loader />}
        </div>
      </Sidebar>

      {/* File Preview Component */}
      {previewFile && <FilePreviewer url={previewFile.url} fileName={previewFile.fileName} isOpen={true} onClose={() => setPreviewFile(null)} trigger={null} />}

      <Toast id={toast.id} type={toast.type} message={toast.message} onClose={() => setToast({ id: 0, message: "", type: "success" })} />
    </>
  );
};
