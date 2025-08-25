import { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useConfirm, useAuth, Error, API, CustomSelect, CustomButton } from "@/hooks/wrapper";
import Sidebar from "@/components/Sidebar";
import DataTable from "@/components/ui/DataTable";
import { Plus, Edit, Trash2, Car } from "lucide-react";

export default function VehiclesPage() {
  const { session, status } = useAuth(["Admin"]);
  const router = useRouter();
  const { confirm, ConfirmComponent } = useConfirm();

  const [vehicles, setVehicles] = useState([]);
  const [brand, setBrand] = useState([]);
  const [vehicleStatus, setVehicleStatus] = useState([]);

  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // form states
  const [name, setName] = useState("");
  const [brandId, setBrandId] = useState(null);
  const [chassisNumber, setChassisNumber] = useState("");
  const [companyId, setCompanyId] = useState(Number(session?.companyId));
  const [statusId, setStatusId] = useState(0);
  const [remarks, setRemarks] = useState("");
  const [csvFile, setCsvFile] = useState(null);
  const [csvError, setCsvError] = useState(null);

  const [edit, setEdit] = useState(null);

  // Pagination and search states
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("id");
  const [sortOrder, setSortOrder] = useState("asc");

  useEffect(() => {
    loadData();
  }, [currentPage, perPage, search, sortBy, sortOrder]);

  useEffect(() => {
    if (status !== "authenticated" || !session) return;
    loadInitialData();
  }, [status, session]);

  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      setError("");

      const [brandData, statusData] = await Promise.all([API("GET", "brand"), API("GET", "vehicleStatus")]);
      setBrand(!brandData.error && session?.permissions?.includes("view:user") ? brandData : []);
      setVehicleStatus(!statusData.error && session?.permissions?.includes("view:user") ? statusData : []);
    } catch (err) {
      setError("Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    const params = new URLSearchParams({
      page: currentPage.toString(),
      limit: perPage.toString(),
      search: search.toString(),
      sortBy: sortBy.toString(),
      sortOrder: sortOrder.toString(),
    });

    const data = await API("GET", `vehicle?${params}`);
    if (data.error) {
      setError(data.error);
      setIsLoading(false);
      return;
    }
    setError("");
    setVehicles(data.vehicles || []);
    setTotal(data.total || 0);
    setIsLoading(false);
  };

  const handleSort = (column, order) => {
    setSortBy(column);
    setSortOrder(order);
  };

  const handleSearch = search => {
    setSearch(search);
    setCurrentPage(1);
  };

  const handlePageChange = (page, perPageValue) => {
    setCurrentPage(page);
    setPerPage(perPageValue);
  };

  const saveVehicle = async () => {
    if (!name || !brand || !chassisNumber || !statusId) {
      setError(!name ? "Name is required" : !brand ? "Please select a brand" : !chassisNumber ? "Chassis number is required" : "Please select current status");
      return;
    }

    let response;
    if (edit === 0) {
      response = await API("PUT", "vehicle", {
        name,
        brandId,
        chassisNumber,
        companyId: Number(session?.companyId),
        statusId,
        remarks,
      });
    } else {
      response = await API("POST", "vehicle", {
        id: edit,
        name,
        brandId,
        chassisNumber,
        companyId: Number(companyId),
        statusId,
        remarks,
      });
    }

    if (response.error) {
      setError(response.error);
      return;
    }

    loadData();
    resetForm();
  };

  const handleFileChange = e => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    if (fileExtension !== "csv") {
      setCsvError("Only CSV files are allowed!");
      setCsvFile(null);
      return;
    }

    if (file.type !== "text/csv" && file.type !== "application/vnd.ms-excel") {
      setCsvError("Invalid file format. Please upload a CSV file.");
      setCsvFile(null);
      return;
    }

    setCsvFile(file);
    setCsvError(null);
  };

  const uploadCsv = async () => {
    if (!csvFile) {
      setCsvError("Please select a valid CSV file first.");
      return;
    }

    const formData = new FormData();
    formData.append("file", csvFile);

    const response = await API("POST", "addVehicle", formData, true);
    if (response.error) {
      setError(response.error);
      return;
    } else {
      alert(`CSV uploaded successfully! ${response.rows} rows processed.`);
    }
    resetForm();
    setCsvFile(null);
  };

  const loadEdit = async id => {
    const data = await API("GET", `vehicle?id=${id}`);
    if (data.error) return setError(data.error);

    setName(data.name);
    setBrandId(data.brandId);
    setChassisNumber(data.chassisNumber);
    setCompanyId(data.companyId);
    setStatusId(data.statusId);
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
      return;
    }
    loadData();
  };

  const resetForm = () => {
    setName("");
    setBrandId(0);
    setChassisNumber("");
    setCompanyId(0);
    setStatusId(0);
    setRemarks("");
    setError("");
    setEdit(null);
  };

  const toggleStatus = async id => {
    const vehicle = vehicles.find(v => v.id === id);
    if (!vehicle) return;

    const newStatus = vehicle.status === "active" ? "inactive" : "active";
    const confirmed = await confirm({
      title: "Change vehicle Status",
      message: `Are you sure you want to change "${vehicle.name}" status to ${newStatus}?`,
      confirmText: "Change Status",
      type: "warning",
    });
    if (!confirmed) return;

    // You may want to call API here to update status
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
          {edit != null && edit !== 4 && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 sm:p-4 z-50">
              <div className="bg-[var(--surface)] border bounce border-[var(--border)] rounded-xl p-4 sm:p-6 w-full max-w-3xl">
                <h3 className="text-lg sm:text-xl font-semibold mb-6">{edit === 0 ? "Add New Vehicle" : "Edit Vehicle"}</h3>

                {/* Responsive grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  {/* Brand */}
                  <div>
                    <label className="input-label">Brand</label>
                    <CustomSelect data={brand} selectedId={brandId} setSelectedId={setBrandId} />
                  </div>

                  {/* Vehicle Name */}
                  <div>
                    <label className="input-label">Vehicle Name</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} className="input-style" placeholder="Enter vehicle name..." />
                  </div>

                  {/* Status */}
                  <div>
                    <label className="input-label">Current Status</label>
                    <CustomSelect data={vehicleStatus} selectedId={statusId} setSelectedId={setStatusId} />
                  </div>

                  {/* Chassis Number */}
                  <div>
                    <label className="input-label">Chassis Number</label>
                    <input type="text" value={chassisNumber} onChange={e => setChassisNumber(e.target.value)} className="input-style" placeholder="Enter chassis number..." />
                  </div>

                  {/* Remarks - full width */}
                  <div className="col-span-1 sm:col-span-2">
                    <label className="input-label">Remarks</label>
                    <textarea value={remarks} onChange={e => setRemarks(e.target.value)} className="input-style" placeholder="Enter remarks..." />
                  </div>
                </div>

                {/* Error message */}
                <Error message={error} />

                {/* Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 justify-end mt-6">
                  <CustomButton title={edit === 0 ? "Add Vehicle" : "Save Changes"} onClick={saveVehicle} className="btn-primary w-full sm:w-auto text-center justify-center" />

                  <CustomButton title="Cancel" onClick={resetForm} className="px-4 py-2 bg-[var(--secondary)] hover:bg-[var(--border)] rounded-lg w-full sm:w-auto text-center justify-center" />
                </div>
              </div>
            </div>
          )}

          {edit === 4 && edit != null && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
              <div className="bg-[var(--surface)] border bounce border-[var(--border)] rounded-xl p-6 w-full max-w-md">
                <h3 className="text-xl font-semibold text-[var(--foreground)] mb-4">{edit === 4 ? "Upload File" : "Edit File"}</h3>
                <div className="space-y-4">
                  <div>
                    <div className="col-span-1 sm:col-span-2">
                      <label className="input-label">Upload CSV File</label>
                      <input type="file" accept=".csv" onChange={handleFileChange} className="input-style" />

                      {csvFile && (
                        <p className="text-sm text-[var(--secondary-foreground)] mt-2">
                          Selected file: <strong>{csvFile.name}</strong>
                        </p>
                      )}

                      {csvError && <p className="text-sm text-red-500 mt-1">{csvError}</p>}
                    </div>
                  </div>
                  <Error message={error} />

                  <div className="flex gap-3">
                    <CustomButton title={edit === 4 ? "Upload CSV" : "Save Changes"} onClick={uploadCsv} className="btn-primary" />

                    <CustomButton
                      title="Cancel"
                      onClick={() => setEdit(null)}
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
            {/* Upload Button */}
            <div className="absolute right-0 top-0 hidden md:block">
              <CustomButton title="Upload CSV File" onClick={() => setEdit(4)} className="btn-primary" icon={<Plus className="w-5 h-5" />} />
            </div>

            {/* Show button below search bar on mobile */}
            <div className="block md:hidden mb-3">
              <CustomButton title="Upload CSV File" onClick={() => setEdit(4)} className="w-full btn-primary" icon={<Plus className="w-5 h-5" />} />
            </div>

            {/* Vehicles Table */}
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
                        <div className="text-sm font-medium text-[var(--foreground)]">{v.name}</div>
                      </div>
                    </td>

                    <td className="px-6  py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-[var(--foreground)]">{v.brand.name}</div>
                    </td>
                    <td className="px-6  py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-[var(--foreground)]">{v.chassisNumber}</div>
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
                    {/* <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--secondary-foreground)]">
                    {new Date(v.updatedAt).toLocaleString()}
                  </td> */}

                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => loadEdit(v.id)}
                          className="p-2 text-[var(--secondary-foreground)] hover:text-[var(--primary)] 
                                 hover:bg-[var(--primary)]/10 rounded-lg transition-all duration-200"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteIt(v.id)}
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
          </div>
        </div>
      </Sidebar>

      <ConfirmComponent />
    </>
  );
}
