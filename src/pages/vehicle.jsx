import { useState, useEffect, useRef } from "react";
import Head from "next/head";
import { useConfirm, useAuth, Error, API, CustomSelect, CustomButton } from "@/hooks/wrapper";
import Sidebar from "@/components/Sidebar";
import DataTable from "@/components/ui/DataTable";
import { Plus, Edit, Trash2, Car, FileUp } from "lucide-react";
import { Toast } from "../hooks/wrapper";

export default function VehiclesPage() {
  const { session, status } = useAuth(["Admin"]);
  const { confirm, ConfirmComponent } = useConfirm();

  const [vehicles, setVehicles] = useState([]);
  const [brand, setBrand] = useState([]);
  const [vehicleStatus, setVehicleStatus] = useState([]);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Form states
  const [name, setName] = useState("");
  const [brandId, setBrandId] = useState(null);
  const [chassisNumber, setChassisNumber] = useState("");
  const [lotNumber, setLotNumber] = useState("");
  const [auction, setAuction] = useState("");
  const [companyId, setCompanyId] = useState(session?.companyId || null);
  const [statusId, setStatusId] = useState(0);
  const [remarks, setRemarks] = useState("");
  const [csvFile, setCsvFile] = useState(null);
  const [csvFileModal, setCsvFileModal] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Vehicle documents upload states
  const [vehicleDocuments, setVehicleDocuments] = useState([]);

  const [edit, setEdit] = useState(null);

  // Pagination and search states
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(5);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("id");
  const [sortOrder, setSortOrder] = useState("asc");

  // Toast state
  const [toast, setToast] = useState({ id: 0, message: "", type: "success" });
  useEffect(() => {
    if (status === "authenticated" && session) {
      setCompanyId(Number(session.companyId));
      loadInitialData();
    }
  }, [status, session]);

  useEffect(() => {
    loadData();
  }, [currentPage, perPage, search, sortBy, sortOrder]);

  const showToast = (message, type = "success") => {
    setToast({ id: Date.now(), message, type });
  };

  const loadInitialData = async () => {
    setIsLoading(true);
    setError("");
    try {
      const [brandData, statusData] = await Promise.all([API("GET", "brand"), API("GET", "vehicleStatus")]);
      setBrand(!brandData.error ? brandData : []);
      setVehicleStatus(!statusData.error ? statusData : []);
    } catch {
      setError("Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    setError("");
    const params = new URLSearchParams({
      page: currentPage,
      limit: perPage,
      search,
      sortBy,
      sortOrder,
    });
    const data = await API("GET", `vehicle?${params}`);
    if (data.error) {
      setError(data.error);
      setIsLoading(false);
      return;
    }
    setVehicles(data.vehicles || []);
    setTotal(data.total || 0);
    setIsLoading(false);
  };

  const handleSort = (column, order) => {
    setSortBy(column);
    setSortOrder(order);
  };

  const handleSearch = value => {
    setSearch(value);
    setCurrentPage(1);
  };

  const handlePageChange = (page, perPageValue) => {
    setCurrentPage(page);
    setPerPage(perPageValue);
  };


  const handleFileChange = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    if (fileExtension !== "csv" || !["text/csv", "application/vnd.ms-excel"].includes(file.type)) {
      setError("Only valid CSV files are allowed!");
      setCsvFile(null);
      return;
    }
    setCsvFile(file);
    setError("");
  };

  // Handle vehicle document uploads
  const handleDocumentChange = e => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if(vehicleDocuments.length + files.length > 15) {
      setError("You can upload a maximum of 15 files.");
      return;
    }

    const validFiles = [];
    const invalidFiles = [];
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    const allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'];
    
    files.forEach(file => {
      const fileExtension = file.name.split(".").pop()?.toLowerCase();
      if (allowedExtensions.includes(fileExtension) && allowedTypes.includes(file.type)) {
        if(file.size > 5 * 1024 * 1024) { // 5MB limit
          setError(`File ${file.name} exceeds the 5MB size limit.`);
          invalidFiles.push(file.name);
        } else {
          validFiles.push({
            id: Date.now() + Math.random(),
            file,
            name: file.name,
            size: file.size,
            type: file.type
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
    // Reset the input value to allow selecting the same files again
    e.target.value = '';
  };

  const removeDocument = (fileId) => {
    setVehicleDocuments(prev => prev.filter(file => file.id !== fileId));
    setError("");
  };

  // Fake progress bar for CSV upload
  const uploadCsv = async () => {
    if (!csvFile) {
      setError("Please select a valid CSV file first.");
      showToast("Please select a valid CSV file first.", "error");
      return;
    }
    setUploadProgress(1);
    let fakeProgress = 1;
    const interval = setInterval(() => {
      fakeProgress += Math.random() * 10;
      if (fakeProgress < 90) {
        setUploadProgress(Math.floor(fakeProgress));
      }
    }, 200);

    const formData = new FormData();
    formData.append("file", csvFile);
    const response = await API("POST", "addVehicle", formData, true);

    clearInterval(interval);
    setUploadProgress(100);

    setTimeout(() => setUploadProgress(0), 1000);

    if (response.error) {
      setError(response.error);
      showToast(response.error, "error");
      return;
    }
    showToast(response.message, "success");
    setCsvFileModal(false);
    setCsvFile(null);
    setError("");
    loadData();
  };


  const saveVehicle = async () => {
    if (!brandId || !chassisNumber || !statusId) {
      setError(!brandId ? "Please select a brand" : !chassisNumber ? "Chassis number is required" : "Please select current status");
      return;
    }
    const formData = new FormData();
    formData.append('name', name);
    formData.append('brandId', brandId);
    formData.append('chassisNumber', chassisNumber);
    formData.append('companyId', Number(session.companyId));
    formData.append('statusId', statusId);
    formData.append('lotNumber', lotNumber);
    formData.append('auction', auction);
    formData.append('remarks', remarks);
    vehicleDocuments.forEach((docObj) => {
      formData.append('documents', docObj.file);
    });

    if (edit !== 0) {
      formData.append('id', edit);
    }

    let response;
    if (edit === 0) {
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
      edit === 0 ? 
        `Vehicle added successfully! ${response.documentsUploaded || 0} document(s) uploaded.` : 
        `Vehicle updated successfully! ${response.documentsUploaded || 0} document(s) uploaded.`, 
      "success"
    );
    loadData();
    resetForm();
  };


  const loadEdit = async id => {
    const data = await API("GET", `vehicle?id=${id}`);
    if (data.error) {
      setError(data.error);
      showToast(data.error, "error");
      return;
    }
    setName(data.name);
    setBrandId(data.brandId);
    setChassisNumber(data.chassisNumber);
    setCompanyId(data.companyId);
    setStatusId(data.statusId);
    setLotNumber(data.lotNumber || "");
    setAuction(data.auction || "");
    setRemarks(data.remarks || "");
    setEdit(id);
  };

  const deleteIt = async id => {
    const confirmed = await confirm({
      title: "Delete Vehicle",
      message: "Are you sure you want to delete this vehicle? This action cannot be undone.",
      confirmText: "Delete",
      type: "danger",
    });
    if (!confirmed) return;
    const data = await API("DELETE", `vehicle?id=${id}`);
    if (data.error) {
      setError(data.error);
      showToast(data.error, "error");
      return;
    }
    showToast("Vehicle deleted successfully!", "success");
    loadData();
  };

  const resetForm = () => {
    setName("");
    setBrandId(null);
    setChassisNumber("");
    setCompanyId(Number(session?.companyId));
    setStatusId(0);
    setLotNumber("");
    setAuction("");
    setRemarks("");
    setError("");
    setEdit(null);
    setCsvFile(null);
    setCsvFileModal(false);
    setVehicleDocuments([]);
  };

  // Toggle vehicle status with API call
  const toggleStatus = async id => {
    const vehicle = vehicles.find(v => v.id === id);
    if (!vehicle) return;
    const currentStatusName = vehicle.status?.name?.toLowerCase();
    const newStatusObj = vehicleStatus.find(s => s.name?.toLowerCase() !== currentStatusName);
    if (!newStatusObj) {
      showToast("No alternate status found.", "error");
      return;
    }
    const confirmed = await confirm({
      title: "Change vehicle Status",
      message: `Are you sure you want to change "${vehicle.name}" status to ${newStatusObj.name}?`,
      confirmText: "Change Status",
      type: "warning",
    });
    if (!confirmed) return;
    const response = await API("POST", "vehicle", {
      id: vehicle.id,
      statusId: newStatusObj.id,
    });
    if (response.error) {
      setError(response.error);
      showToast(response.error, "error");
      return;
    }
    showToast(`Status changed to ${newStatusObj.name}`, "success");
    loadData();
  };

  return (
    <>
      <Head>
        <title>Vehicles Management - ExpoSaaS</title>
      </Head>
      <Sidebar>
        <div className="p-8 bg-[var(--background)] min-h-screen">
          {/* Header Section */}
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[var(--surface)] rounded-lg border border-[var(--border)]">
                <Car className="w-6 h-6 text-[var(--primary)]" />
              </div>
              <h1 className="text-3xl font-bold text-[var(--foreground)]">Vehicles Management</h1>
            </div>
            <CustomButton title="Add Vehicle" onClick={() => setEdit(0)} className="btn-primary" icon={<Plus className="w-5 h-5" />} />
          </div>

          {/* Add/Edit Vehicle Modal */}
          {edit != null && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 sm:p-4 z-50">
              <div className="bg-[var(--surface)] border bounce border-[var(--border)] rounded-xl p-4 sm:p-6 w-full max-w-5xl max-h-[90vh] overflow-y-auto">
                <h3 className="text-lg sm:text-xl font-semibold mb-6">{edit === 0 ? "Add New Vehicle" : "Edit Vehicle"}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                  <div>
                    <label className="input-label">Vehicle Name</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} className="input-style" placeholder="Enter vehicle name..." />
                  </div>
                  <div>
                    <label className="input-label">Brand</label>
                    <CustomSelect data={brand} selectedId={brandId} setSelectedId={setBrandId} />
                  </div>
                  
                  <div>
                    <label className="input-label">Current Status</label>
                    <CustomSelect data={vehicleStatus} selectedId={statusId} setSelectedId={setStatusId} />
                  </div>
                  <div>
                    <label className="input-label">Chassis Number</label>
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
                  
                  {/* Remarks - Full Width */}
                  <div className="col-span-1 md:col-span-3">
                    <label className="input-label">Remarks</label>
                    <textarea value={remarks} onChange={e => setRemarks(e.target.value)} className="input-style" placeholder="Enter remarks..." rows={3} />
                  </div>
                  
                  {/* Vehicle Documents Upload Section - Full Width */}
                  <div className="col-span-1 md:col-span-3">
                    <label className="input-label">Vehicle Documents</label>
                    <div className="vehicle-doc-style">
                      {/* Add Document Tile */}
                      <div className="relative">
                        <input 
                          type="file" 
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" 
                          multiple
                          onChange={handleDocumentChange} 
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div className="vehicle-doc-upload-button">
                          <Plus className="w-6 h-6 text-[var(--secondary-foreground)] mb-1" />
                          <span className="text-xs text-[var(--secondary-foreground)] text-center px-1">Add Documents</span>
                        </div>
                      </div>
                      
                      {/* Document Tiles */}
                      {vehicleDocuments.map((docObj) => (
                        <div key={docObj.id} className="relative group">
                          <div className="vehicle-doc-display">
                            <div className="flex-1 flex flex-col items-center justify-center">
                              {docObj.type.includes('image') ? (
                                <img 
                                  src={URL.createObjectURL(docObj.file)} 
                                  alt={docObj.name}
                                  className="w-8 h-8 object-cover rounded mb-1"
                                />
                              ) : (
                                <FileUp className="w-5 h-5 text-[var(--primary)] mb-1" />
                              )}
                              <div className="text-xs text-[var(--foreground)] text-center break-words leading-tight">
                                {docObj.name.length > 15 ? docObj.name.substring(0, 12) + '...' : docObj.name}
                              </div>
                              <div className="text-xs text-[var(--secondary-foreground)] mt-1">
                                {(docObj.size / 1024).toFixed(1)} KB
                              </div>
                            </div>
                            {/* Remove Button */}
                            <button
                              onClick={() => removeDocument(docObj.id)}
                              className="vehicle-doc-remove-button"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Document Info */}
                    {vehicleDocuments.length > 0 && (
                      <div className="mt-2 p-2 bg-[var(--surface)] rounded text-xs text-[var(--secondary-foreground)]">
                        <span className="font-medium">{vehicleDocuments.length} document(s) selected</span>
                        <span className="ml-2">
                          ({(vehicleDocuments.reduce((acc, doc) => acc + doc.size, 0) / 1024).toFixed(1)} KB total)
                        </span>
                      </div>
                    )}
                    <p className="text-xs text-[var(--secondary-foreground)] mt-1">
                      Supported formats: PDF, JPG, PNG, DOC, DOCX (Max size per file: 10MB)
                    </p>
                  </div>
                </div>
                <Error message={error} />
                <div className="flex flex-col sm:flex-row gap-3 justify-end mt-6">
                  <CustomButton title={edit === 0 ? "Add Vehicle" : "Save Changes"} onClick={saveVehicle} className="btn-primary w-full sm:w-auto text-center justify-center" />
                  <CustomButton title="Cancel" onClick={resetForm} className="px-4 py-2 bg-[var(--secondary)] hover:bg-[var(--border)] rounded-lg w-full sm:w-auto text-center justify-center" />
                </div>
              </div>
            </div>
          )}

          {/* CSV Upload Modal */}
          {csvFileModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
              <div className="bg-[var(--surface)] border bounce border-[var(--border)] rounded-xl p-6 w-full max-w-md">
                <h3 className="text-xl font-semibold text-[var(--foreground)] mb-4">Upload File</h3>
                <div className="space-y-4">
                  <div>
                    <label className="input-label">Upload CSV File</label>
                    <input type="file" accept=".csv" onChange={handleFileChange} className="input-style" />
                    {csvFile && (
                      <p className="text-sm text-[var(--secondary-foreground)] mt-2">
                        Selected file: <strong>{csvFile.name}</strong>
                      </p>
                    )}
                  </div>
                  <Error message={error} />
                  {uploadProgress > 0 && (
                    <div className="w-full bg-[var(--border)] rounded h-3 mb-2">
                      <div className="bg-[var(--primary)] h-3 rounded transition-all duration-200" style={{ width: `${uploadProgress}%` }}></div>
                      <div className="text-xs text-right mt-1 text-[var(--foreground)]">{uploadProgress}%</div>
                    </div>
                  )}
                  <div className="flex gap-3">
                    <CustomButton title="Upload & Sync" onClick={uploadCsv} className="btn-primary" />
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

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[var(--secondary-foreground)] text-sm font-medium">Total Vehicles</p>
                  <p className="text-2xl font-bold text-[var(--foreground)]">{isLoading ? "..." : total}</p>
                </div>
                <div className="p-3 bg-[var(--primary)]/10 rounded-lg">
                  <Car className="w-6 h-6 text-[var(--primary)]" />
                </div>
              </div>
            </div>
          </div>

          <Error message={error} />

          <div className="relative">
            <div className="absolute right-0 top-0 hidden md:block">
              <CustomButton title="Upload CSV File" onClick={() => setCsvFileModal(!csvFileModal)} className="btn-primary" icon={<FileUp className="w-5 h-5" />} />
            </div>
            <div className="block md:hidden mb-3">
              <CustomButton title="Upload CSV File" onClick={() => setCsvFileModal(!csvFileModal)} className="w-full btn-primary" icon={<FileUp className="w-5 h-5" />} />
            </div>
            <DataTable
              data={vehicles}
              total={total}
              isLoading={isLoading}
              searchPlaceholder="Search Vehicles..."
              onSearch={handleSearch}
              onSort={handleSort}
              onPageChange={handlePageChange}
              title="Vehicles"
              sortBy={sortBy}
              sortOrder={sortOrder}
            >
              <thead className="bg-[var(--secondary)]">
                <tr>
                  <th id="id">ID</th>
                  <th id="name">Name</th>
                  <th id="brand">Brand</th>
                  <th id="chassisNumber">Chassis Number</th>
                  <th id="lotNumber">Lot Number</th>
                  <th id="auction">Auction</th>
                  <th id="status">Status</th>
                  <th id="remarks">Remarks</th>
                  <th id="createdAt">Registered At</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map(v => (
                  <tr key={v.id} className="hover:bg-[var(--input)] transition-colors duration-200">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-mono text-[var(--secondary-foreground)]">#{v.id.toString().padStart(3, "0")}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-[var(--primary)]/10 rounded-lg">
                          <Car className="w-4 h-4 text-[var(--primary)]" />
                        </div>
                        <div className="text-sm font-medium text-[var(--foreground)]">{v.name || "-"}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-[var(--foreground)]">{v.brand?.name || "-"}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-[var(--foreground)]">{v.chassisNumber}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-[var(--foreground)]">{v.lotNumber || "-"}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-[var(--foreground)]">{v.auction || "-"}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        onClick={() => toggleStatus(v.id)}
                        className="inline-flex cursor-pointer items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--success)]/10 text-[var(--success)]"
                      >
                        {v?.status?.name}
                      </span>
                    </td>
                    <td className="px-6 py-4 min-w-[100px] max-w-[200px] whitespace-normal">
                      <div className="flex flex-wrap gap-2">
                        <span className="px-3 py-1 text-sm font-medium text-[var(--foreground)] bg-[var(--primary)]/10 rounded-lg">{v.remarks || "-"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--secondary-foreground)]">{new Date(v.createdAt).toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => loadEdit(v.id)}
                          className="p-2 text-[var(--secondary-foreground)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 rounded-lg transition-all duration-200"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteIt(v.id)}
                          className="p-2 text-[var(--secondary-foreground)] hover:text-[var(--error)] hover:bg-[var(--error)]/10 rounded-lg transition-all duration-200"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </div>
        </div>
      </Sidebar>

      <ConfirmComponent />
      <Toast id={toast.id} type={toast.type} message={toast.message} onClose={() => setToast({ id: 0, message: "", type: "success" })} />
    </>
  );
}
