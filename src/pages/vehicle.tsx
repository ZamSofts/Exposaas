import { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useConfirm, useAuth, Error, API } from "@/hooks/wrapper";
import Sidebar from "@/components/Sidebar";
import DataTable from "@/components/ui/DataTable";
import { CustomButton } from "@/hooks/wrapper";
import { Plus, Edit, Trash2, Car } from "lucide-react";

type Vehicle = {
  id: number;
  name: string;
  chassisNumber: string;
  companyId: number;
  status: "active" | "inactive";
  remarks?: string;
  createdAt: string;
  updatedAt: string;
};

export default function VehiclesPage() {
  const session = useAuth(["Admin"]);
  const router = useRouter();
  const { confirm, ConfirmComponent } = useConfirm();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [brand, setBrand] = useState([]);

  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // form states
  const [name, setName] = useState("");
  const [brandId, setBrandId] = useState<number | null>(null);
  const [chassisNumber, setChassisNumber] = useState("");
  const [companyId, setCompanyId] = useState(Number(session?.companyId));
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [remarks, setRemarks] = useState("");

  const [edit, setEdit] = useState<number | null>(null);

  // Pagination and search states
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("id");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    loadData();
  }, [currentPage, perPage, search, sortBy, sortOrder]);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      setError("");
      const brandData = await API("GET", "brand");
      if (brandData.error) return setError(brandData.error);
      setBrand(brandData);
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

  const handleSort = (column: string, order: "asc" | "desc") => {
    setSortBy(column);
    setSortOrder(order);
  };

  const handleSearch = (search: string) => {
    setSearch(search);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number, perPageValue: number) => {
    setCurrentPage(page);
    setPerPage(perPageValue);
  };

  const saveVehicle = async () => {
    if (!name || !brand || !chassisNumber) {
      setError("All required fields must be filled");
      return;
    }

    let response;
    if (edit === 0) {
      response = await API("PUT", "vehicle", {
        name,
        brandId,
        chassisNumber,
        companyId: Number(companyId),
        status,
        remarks,
      });
    } else {
      response = await API("POST", "vehicle", {
        id: edit,
        name,
        brandId,
        chassisNumber,
        companyId: Number(companyId),
        status,
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

  const loadEdit = async (id: number) => {
    const data = await API("GET", `vehicle?id=${id}`);
    if (data.error) return setError(data.error);

    setName(data.name);
    setBrandId(data.brandId);
    setChassisNumber(data.chassisNumber);
    setCompanyId(data.companyId);
    setStatus(data.status);
    setRemarks(data.remarks || "");
    setEdit(id);
  };

  const deleteIt = async (id: number) => {
    const confirmed = await confirm({
      title: "Delete Vehicle",
      message:
        "Are you sure you want to delete this vehicle? This action cannot be undone.",
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
    setStatus("active");
    setRemarks("");
    setError("");
    setEdit(null);
  };

  const toggleStatus = async (id: number) => {
    const vehicle = vehicles.find((v) => v.id === id);
    if (!vehicle) return;

    const newStatus = vehicle.status === "active" ? "inactive" : "active";
    const confirmed = await confirm({
      title: "Change vehicle Status",
      message: `Are you sure you want to change "${vehicle.name}" status to ${newStatus}?`,
      confirmText: "Change Status",
      type: "warning",
    });
    if (!confirmed) return;
    vehicle.status = newStatus;
    const data = await API("POST", `vehicle`, vehicle);
    if (data.error) {
      setError(data.error);
      return;
    }
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
              <h1 className="text-3xl font-bold text-[var(--foreground)]">
                Vehicles Management
              </h1>
            </div>
            <CustomButton
              title="Add Vehicle"
              onClick={() => setEdit(0)}
              className="btn-primary"
              icon={<Plus className="w-5 h-5" />}
            />
          </div>

          {/* Add/Edit Vehicle Modal */}
          {edit != null && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
              <div className="bg-[var(--surface)] border bounce border-[var(--border)] rounded-xl p-6 w-full max-w-md">
                <h3 className="text-xl font-semibold mb-4">
                  {edit === 0 ? "Add New Vehicle" : "Edit Vehicle"}
                </h3>
                <div className="space-y-4">
                  <label className="input-label">Vehicle Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input-style"
                    placeholder="Enter vehicle name..."
                  />
                  <label className="input-label">Brand</label>
                  <select
                    value={brandId}
                    onChange={(e) => setBrandId(e.target.value)}
                    className="input-style"
                  >
                    <option value="">Select a brand</option>
                    {brand.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  <label className="input-label">Chassis Number</label>
                  <input
                    type="text"
                    value={chassisNumber}
                    onChange={(e) => setChassisNumber(e.target.value)}
                    className="input-style"
                    placeholder="Enter chassis number..."
                  />
                  <label className="input-label">Remarks</label>
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="input-style"
                    placeholder="Enter remarks..."
                  />
                  <Error message={error} />
                  <div className="flex gap-3">
                    <CustomButton
                      title={edit === 0 ? "Add Vehicle" : "Save Changes"}
                      onClick={saveVehicle}
                      className="btn-primary"
                    />
                    <CustomButton
                      title="Cancel"
                      onClick={resetForm}
                      className="px-4 py-2 bg-[var(--secondary)] hover:bg-[var(--border)] rounded-lg"
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
                  <p className="text-[var(--secondary-foreground)] text-sm font-medium">
                    Total Vehicles
                  </p>
                  <p className="text-2xl font-bold text-[var(--foreground)]">
                    {isLoading ? "..." : total}
                  </p>
                </div>
                <div className="p-3 bg-[var(--primary)]/10 rounded-lg">
                  <Car className="w-6 h-6 text-[var(--primary)]" />
                </div>
              </div>
            </div>
          </div>

          <Error message={error} />

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
                {/*                 <th id="createdAt">Created Date</th>
                 */}{" "}
                <th id="updatedAt">Updated Date</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => (
                <tr
                  key={v.id}
                  className="hover:bg-[var(--input)] transition-colors duration-200"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-mono text-[var(--secondary-foreground)]">
                      #{v.id.toString().padStart(3, "0")}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-[var(--primary)]/10 rounded-lg">
                        <Car className="w-4 h-4 text-[var(--primary)]" />
                      </div>
                      <div className="text-sm font-medium text-[var(--foreground)]">
                        {v.name}
                      </div>
                    </div>
                  </td>

                  <td className="px-6  py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-[var(--foreground)]">
                      {v.brand.name}
                    </div>
                  </td>
                  <td className="px-6  py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-[var(--foreground)]">
                      {v.chassisNumber}
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      onClick={() => toggleStatus(v.id)}
                      className={`inline-flex cursor-pointer items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                        ${
                          v.status === "active"
                            ? "bg-[var(--success)]/10 text-[var(--success)]"
                            : "bg-[var(--warning)]/10 text-[var(--warning)]"
                        }`}
                    >
                      {v.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 min-w-[100px] max-w-[200px] whitespace-normal">
                    <div className="flex flex-wrap gap-2">
                      <span className="px-3 py-1 text-sm font-medium text-[var(--foreground)] bg-[var(--primary)]/10 rounded-lg">
                        {v.remarks || "-"}
                      </span>
                    </div>
                  </td>
                  {/*   <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--secondary-foreground)]">
                    {new Date(v.createdAt).toLocaleString()}
                  </td> */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--secondary-foreground)]">
                    {new Date(v.updatedAt).toLocaleString()}
                  </td>

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
      </Sidebar>

      <ConfirmComponent />
    </>
  );
}
