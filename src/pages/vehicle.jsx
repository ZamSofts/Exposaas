import { useState, useEffect, useRef } from "react";
import Head from "next/head";
import { useConfirm, useAuth, Error, API, isAllowed, CustomButton, Toast, Loader, EditVehicle, } from "@/hooks/wrapper";
import Sidebar from "@/components/Sidebar";
import DataTable from "@/components/ui/DataTable";
import { Plus, Edit, Trash2, Car, FileUp } from "lucide-react";

export default function VehiclesPage() {
  const { session, status } = useAuth(["view:vehicle"], ["Sadmin"]);
  const { confirm, ConfirmComponent } = useConfirm();

  const [vehicles, setVehicles] = useState([]);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [customLoader, setCustomLoader] = useState(false);
  const [invoiceFile, setInvoiceFile] = useState(null);
  //const [invoiceType,setInvoiceType]= useState("");
  const [invoiceFileModal, setInvoiceFileModal] = useState(false);


  const [csvFile, setCsvFile] = useState(null);
  const [csvFileModal, setCsvFileModal] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [edit, setEdit] = useState(null);
  const [currentView, setCurrentView] = useState("list");

  // Modal refs for click outside
  const csvModalRef = useRef(null);

  // Pagination and search states
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(5);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("id");
  const [sortOrder, setSortOrder] = useState("asc");

  // Toast state
  const [toast, setToast] = useState({ id: 0, message: "", type: "success" });

  useEffect(() => {
    loadData();
  }, [currentPage, perPage, search, sortBy, sortOrder]);

  // Handle click outside modal to close
  useEffect(() => {
    const handleClickOutside = event => {
      if (csvModalRef.current && !csvModalRef.current.contains(event.target)) {
        resetForm();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const showToast = (message, type = "success") => {
    setToast({ id: Date.now(), message, type });
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

  const handleInvoiceFileChange = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    if (fileExtension !== "pdf" || !["application/pdf"].includes(file.type)) {
      setError("Only valid invoice files are allowed!");
      setInvoiceFile(null);
      return;
    }
    setInvoiceFile(file);
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

  // Fake progress bar for Invoice upload
  const uploadInvoice = async () => {
    if (!invoiceFile) {
      setError("Please select a valid Invoice file first.");
      showToast("Please select a valid Invoice file first.", "error");
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
    formData.append("file", invoiceFile);
    //formData.append("invoiceType", invoiceType);
    const response = await API("PUT", "addInvoice", formData, true);

    clearInterval(interval);
    setUploadProgress(100);

    setTimeout(() => setUploadProgress(0), 1000);

    if (response.error) {
      setError(response.error);
      showToast(response.error, "error");
      return;
    }
    showToast(response.message, "success");
    // setInvoiceResponse(response.data);
    // setIsInvoiceDataView(true);
    setInvoiceFileModal(false);
    setInvoiceFile(null);
    setError("");
    loadData();
  };

  const deleteIt = async id => {
    const confirmed = await confirm({
      title: "Delete Vehicle",
      message: "Are you sure you want to delete this vehicle? This will also permanently delete all associated documents and Payments. This action cannot be undone.",
      confirmText: "Delete",
      type: "danger",
    });
    if (!confirmed) return;

    setCustomLoader(true);
    const data = await API("DELETE", `vehicle?id=${id}`);
    if (data.error) {
      setError(data.error);
      showToast(data.error, "error");
      setCustomLoader(false);
      return;
    }

    setCustomLoader(false);
    const documentsDeletedText = data.documentsDeleted > 0 ? ` ${data.documentsDeleted} associated document(s) were also removed.` : "";
    showToast(`Vehicle deleted successfully!${documentsDeletedText}`, "success");
    loadData();
  };

  const resetForm = () => {
    setError("");
    setEdit(null);
    setCsvFile(null);
    setCsvFileModal(false);
    setCustomLoader(false);
    setInvoiceFileModal(false);
  };

  // View management functions
  const handleAddVehicle = () => {
    setEdit(0); // 0 for new vehicle
    setCurrentView("form");
  };

  const handleEditVehicle = vehicleId => {
    setEdit(vehicleId);
    setCurrentView("form");
  };

  const handleBackToList = () => {
    setCurrentView("list");
    setEdit(null);
    loadData(); // Refresh the list
  };

  const handleFormSuccess = () => {
    handleBackToList();
  };

  // If we're in form view, render the VehicleForm component
  if (currentView === "form") {
    return <EditVehicle vehicleId={edit} onBack={handleBackToList} onSuccess={handleFormSuccess} />;
  }

  return (
    <>
      <Head>
        <title>Vehicles Management - ExpoSaaS</title>
      </Head>
      <Sidebar>
        <div className="p-8 bg-[var(--background)] min-h-screen relative">
          {/* Header Section */}
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[var(--surface)] rounded-lg border border-[var(--border)]">
                <Car className="w-6 h-6 text-[var(--primary)]" />
              </div>
              <h1 className="text-3xl font-bold text-[var(--foreground)]">Vehicles Management</h1>
            </div>
            {isAllowed(["add:vehicle"], session) ? <CustomButton title="Add Vehicle" onClick={handleAddVehicle} className="btn-primary" icon={<Plus className="w-5 h-5" />} /> : null}
          </div>

          {/* CSV Upload Modal */}
          {csvFileModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
              <div ref={csvModalRef} className="bg-[var(--surface)] border bounce border-[var(--border)] rounded-xl p-6 w-full max-w-md">
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

          {invoiceFileModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
              <div className="bg-[var(--surface)] border bounce border-[var(--border)] rounded-xl p-6 w-full max-w-md">
                <h3 className="text-xl font-semibold text-[var(--foreground)] mb-4">Upload File</h3>
                <div className="space-y-4">
                  <div>
                     {/* <label className="input-label">Invoice Type</label>
                    <ReactSelect
                        required
                        value={invoiceType}
                        onChange={setInvoiceType}
                        placeholder="Select Invoice Type"
                        options={invoiceTypesOptions}
                      /> */}

                    <label className="input-label">Upload Invoice File</label>
                    <input type="file" accept=".pdf" onChange={handleInvoiceFileChange} className="input-style" />
                    {invoiceFile && (
                      <p className="text-sm text-[var(--secondary-foreground)] mt-2">
                        Selected file: <strong>{invoiceFile.name}</strong>
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
                    <CustomButton title="Upload & Sync" onClick={uploadInvoice} className="btn-primary" />
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
          {customLoader && <Loader />}

          <div className="relative">
            {isAllowed(["add:csv"], session) ? (
              <>
                <div className="absolute right-0 top-0 hidden md:block">
                  <CustomButton title="Upload CSV File" onClick={() => setCsvFileModal(!csvFileModal)} className="btn-primary" icon={<FileUp className="w-5 h-5" />} />
                </div>
                <div className="absolute right-60 top-0 hidden md:block">
                  <CustomButton title="Upload Invoice" onClick={() => setInvoiceFileModal(!invoiceFileModal)} className="btn-primary" icon={<FileUp className="w-5 h-5" />} />
                </div>
                <div className="block md:hidden mb-3">
                  <CustomButton title="Upload CSV File" onClick={() => setCsvFileModal(!csvFileModal)} className="w-full btn-primary" icon={<FileUp className="w-5 h-5" />} />
                </div>
                <div className="block md:hidden mb-3">
                  <CustomButton title="Upload Invoice" onClick={() => setInvoiceFileModal(!invoiceFileModal)} className="w-full btn-primary" icon={<FileUp className="w-5 h-5" />} />
                </div>
              </>
            ) : null}

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
                  {isAllowed(["edit:vehicle"], session) ? <th>Actions</th> : null}
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
                      <span className="inline-flex cursor-pointer items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--success)]/10 text-[var(--success)]">{v?.status?.name}</span>
                    </td>
                    <td className="px-6 py-4 min-w-[100px] max-w-[200px] whitespace-normal">
                      <div className="flex flex-wrap gap-2">
                        <span className="px-3 py-1 text-sm font-medium text-[var(--foreground)] bg-[var(--primary)]/10 rounded-lg">{v.remarks || "-"}</span>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--secondary-foreground)]">{new Date(v.createdAt).toLocaleString()}</td>

                    {isAllowed(["edit:vehicle"], session) && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEditVehicle(v.id)}
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
                    )}
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
