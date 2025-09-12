import { useState, useEffect } from "react";
import Head from "next/head";
import { useConfirm, useAuth, Error, API, CustomButton, Loader, Toast } from "@/hooks/wrapper";
import Sidebar from "@/components/Sidebar";
import DataTable from "@/components/ui/DataTable";
import { Plus, Edit, Trash2, UserCheck, Building } from "lucide-react";

export default function Customers() {
  const { session} = useAuth(["view:customer"]);
  const { confirm, ConfirmComponent } = useConfirm();

  const [customers, setCustomers] = useState([]);

  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [uniqueId, setUniqueId] = useState("");

  const [edit, setEdit] = useState(null);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [customLoader, setCustomLoader] = useState(false);
  const [toast, setToast] = useState({ id: 0, message: "", type: "success" });

  // Pagination and search states
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(5);
  const [search, setSearch] = useState("");

  // Sorting state managed by parent
  const [sortBy, setSortBy] = useState("id");
  const [sortOrder, setSortOrder] = useState("asc");

  // Reload data when pagination, search, or sorting changes
  useEffect(() => {
    loadData();
  }, [currentPage, perPage, search, sortBy, sortOrder]);



  const showToast = (message, type = "success") => {
    setToast({ id: Date.now(), message, type });
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

    const data = await API("GET", `customer?${params}`);
    if (data.error) {
      setError(data.error);
      setIsLoading(false);
      return;
    }
    setError("");
    setCustomers(data.customer);
    setTotal(data.total);
    setIsLoading(false);
  };

  const handleSort = (column, order) => {
    setSortBy(column);
    setSortOrder(order);
  };

  const handleSearch = search => {
    setSearch(search);
    setCurrentPage(1); // Reset to first page on search
  };

  const handlePageChange = (page, perPageValue) => {
    setCurrentPage(page);
    setPerPage(perPageValue);
  };

  const editData = async () => {
    const newCustomer = {
      name: name.trim(),
      country: country.trim() || null,
      uniqueId: uniqueId.trim(),
      companyId: Number(session?.companyId),
    };

    if (!newCustomer.name || !newCustomer.uniqueId || !newCustomer.companyId) {
      setError(!newCustomer.name ? "Customer name is required" : !newCustomer.uniqueId ? "Unique ID is required" : "Please select a company");
      return;
    }

    setCustomLoader(true);
    if (edit === 0) {
      const data = await API("PUT", "customer", newCustomer);
      if (data.error) {
        setError(data.error);
        setCustomLoader(false);
        return;
      }
      showToast(data.message, "success");
    } else {
      const updatedCustomer = { ...newCustomer, id: edit };
      const data = await API("POST", `customer`, updatedCustomer);
      if (data.error) {
        setError(data.error);
        setCustomLoader(false);
        return;
      }
      showToast(data.message, "success");
    }

    resetForm();
    loadData();
  };

  const loadEdit = async id => {
    setCustomLoader(true);
    const data = await API("GET", `customer?id=${id}`);
    if (data.error) {
      setError(data.error);
      setCustomLoader(false);
      return;
    }
    setIsLoading(false);
    setName(data.name);
    setCountry(data.country || "");
    setUniqueId(data.uniqueId);
    setEdit(id);
    setCustomLoader(false);
  };

  const deleteIt = async id => {
    const confirmed = await confirm({
      title: "Delete Customer",
      message:
        "Are you sure you want to delete this customer? This action will permanently delete the customer record. Note: If this customer has associated vehicles, you must reassign or remove them first.",
      confirmText: "Delete",
      type: "danger",
    });
    if (!confirmed) return;
    setCustomLoader(true);
    const data = await API("DELETE", `customer?id=${id}`);
    if (data.error) {
      setError(data.error);
      showToast(data.error, "error");
      setCustomLoader(false);
      return;
    }
    showToast(data.message, "success");
    loadData();
    setCustomLoader(false);
  };

  const resetForm = () => {
    setName("");
    setCountry("");
    setUniqueId("");
    setError("");
    setEdit(null);
    setCustomLoader(false);
    setIsLoading(false);
  };

  return (
    <>
      <Head>
        <title>Customer Management - ExpoSaaS</title>
      </Head>

      <Sidebar>
        <div className="p-8 bg-[var(--background)] min-h-screen relative">
          {customLoader && <Loader />}

          {/* Header Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[var(--surface)] rounded-lg border border-[var(--border)]">
                  <UserCheck className="w-6 h-6 text-[var(--primary)]" />
                </div>
                <h1 className="text-3xl font-bold text-[var(--foreground)]">Customer Management</h1>
              </div>
              {/* Add Customer Button */}
              <CustomButton title="Add Customer" onClick={() => setEdit(0)} className="btn-primary" icon={<Plus className="w-5 h-5" />} />
            </div>
            <p className="text-[var(--secondary-foreground)]">Manage and oversee all customers in your platform</p>
          </div>

          {/* Add Customer Modal/Form */}
          {edit != null && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
              <div className="bg-[var(--surface)] border bounce border-[var(--border)] rounded-xl p-6 w-full max-w-md">
                <h3 className="text-xl font-semibold text-[var(--foreground)] mb-4">{edit === 0 ? "Add New Customer" : "Edit Customer"}</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--secondary-foreground)] mb-2">Customer Name *</label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          editData();
                        }
                      }}
                      placeholder="Enter customer name..."
                      className="input-style"
                      autoFocus
                    />

                    <label className="block text-sm font-medium text-[var(--secondary-foreground)] mb-2 mt-4">Unique ID *</label>
                    <input
                      type="text"
                      value={uniqueId}
                      onChange={e => setUniqueId(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          editData();
                        }
                      }}
                      placeholder="Enter unique identifier..."
                      className="input-style"
                    />

                    <label className="block text-sm font-medium text-[var(--secondary-foreground)] mb-2 mt-4">Country</label>
                    <input
                      type="text"
                      value={country}
                      onChange={e => setCountry(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          editData();
                        }
                      }}
                      placeholder="Enter country (optional)..."
                      className="input-style"
                    />
                  </div>
                  <Error message={error} />
                  <div className="flex gap-3">
                    <CustomButton title={edit === 0 ? "Add Customer" : "Save Changes"} onClick={editData} className="btn-primary" />

                    <CustomButton
                      title="Cancel"
                      onClick={() => resetForm()}
                      className="px-4 py-2 bg-[var(--secondary)] hover:bg-[var(--border)] text-[var(--secondary-foreground)] rounded-lg font-medium transition-all duration-200"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[var(--secondary-foreground)] text-sm font-medium">Total Customers</p>
                  <p className="text-2xl font-bold text-[var(--foreground)]">{isLoading ? "..." : total}</p>
                </div>
                <div className="p-3 bg-[var(--primary)]/10 rounded-lg">
                  <UserCheck className="w-6 h-6 text-[var(--primary)]" />
                </div>
              </div>
            </div>
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[var(--secondary-foreground)] text-sm font-medium">With Vehicles</p>
                  <p className="text-2xl font-bold text-[var(--foreground)]">{isLoading ? "..." : customers.filter(c => c.vehicleCount > 0).length}</p>
                </div>
                <div className="p-3 bg-green-500/10 rounded-lg">
                  <Building className="w-6 h-6 text-green-500" />
                </div>
              </div>
            </div>
            
          </div>
          <Error message={error} />
          {customLoader && <Loader />}

          {/* DataTable with JSX children */}
          <DataTable
            data={customers}
            total={total}
            isLoading={isLoading}
            searchPlaceholder="Search Customers..."
            onSearch={handleSearch}
            onSort={handleSort}
            onPageChange={handlePageChange}
            title="Customers"
            sortBy={sortBy}
            sortOrder={sortOrder}
          >
            {/* Table Headers with sortable IDs */}
            <thead className="bg-[var(--secondary)]">
              <tr>
                <th id="id">ID</th>
                <th id="name">Customer Name</th>
                <th id="uniqueId">Unique ID</th>
                <th id="country">Country</th>
                <th>Vehicles</th>
                <th id="createdAt">Created Date</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>

            {/* Table Body with data rows */}
            <tbody>
              {customers.map(customer => (
                <tr key={customer.id} className="hover:bg-[var(--input)] transition-colors duration-200">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-mono text-[var(--secondary-foreground)]">#{customer.id.toString().padStart(3, "0")}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-[var(--primary)]/10 rounded-lg">
                        <UserCheck className="w-4 h-4 text-[var(--primary)]" />
                      </div>
                      <div className="text-sm font-medium text-[var(--foreground)]">{customer.name}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-[var(--foreground)]">
                      <span className="px-2 py-1 bg-[var(--secondary)] rounded text-xs font-mono">{customer.uniqueId}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[var(--foreground)]">{customer.country || "-"}</span>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Building className="w-4 h-4 text-[var(--secondary-foreground)]" />
                      <span className="text-sm font-medium text-[var(--foreground)]">{customer.vehicleCount || 0}</span>
                      {customer.vehicleCount > 0 && <span className={`inline-flex cursor-pointer items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--success)]/10 text-[var(--success)]`}>Active</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--secondary-foreground)]">{new Date(customer.createdAt).toLocaleString("en-GB")}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => loadEdit(customer.id)}
                        className="p-2 text-[var(--secondary-foreground)] hover:text-[var(--primary)] 
                                 hover:bg-[var(--primary)]/10 rounded-lg transition-all duration-200"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteIt(customer.id)}
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

      {/* Confirmation Modal */}
      <ConfirmComponent />
      <Toast id={toast.id} type={toast.type} message={toast.message} onClose={() => setToast({ id: 0, message: "", type: "success" })} />
    </>
  );
}
