import { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { DataTable, useConfirm, Error, Loader, useAuth, API, usePaginatedList, queryKeys } from "@/hooks/wrapper";
import { useQueryClient } from "@tanstack/react-query";
import Sidebar from "@/components/Sidebar";
import { Plus, Building2, Edit, Trash2 } from "lucide-react";

export default function Company() {
  const { session } = useAuth();
  const router = useRouter();
  const { confirm, ConfirmComponent } = useConfirm();
  const queryClient = useQueryClient();

  // ── Data fetching (React Query) ──
  const {
    items: companies, total, isLoading, error: listError,
    handleSearch, handleSort, handlePageChange, sortBy, sortOrder, extra,
  } = usePaginatedList(queryKeys.companies, "company", {
    defaultPerPage: 5,
    defaultOrder: "desc",
    select: (res) => ({
      items: res.company || [],
      total: res.total || 0,
      extra: { inactive: res.inactive || 0 },
    }),
  });

  const inactive = extra?.inactive || 0;

  // ── Form state (not managed by React Query) ──
  const [name, setName] = useState("");
  const [edit, setEdit] = useState(null);
  const [error, setError] = useState("");
  const [customLoader, setCustomLoader] = useState(false);

  useEffect(() => {
    if (session?.role !== "Sadmin") {
      router.push("/");
    }
  }, []);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["companies"] });

  const editData = async () => {
    if (!name.trim()) {
      setError("Company name cannot be empty");
      return;
    }
    setCustomLoader(true);
    if (edit === 0) {
      const data = await API("PUT", "company", { name });
      if (data.error) {
        setError(data.error);
        setCustomLoader(false);
        return;
      }
    } else {
      const data = await API("POST", `company`, { id: edit, name });
      if (data.error) {
        setError(data.error);
        setCustomLoader(false);
        return;
      }
    }

    invalidate();
    resetForm();
  };

  const loadEdit = async id => {
    setCustomLoader(true);
    const data = await API("GET", `company?id=${id}`);
    if (data.error) {
      setError(data.error);
      return;
    }
    setName(data.name);
    setEdit(id);
    setCustomLoader(false);
  };

  const deleteIt = async id => {
    const confirmed = await confirm({
      title: "Delete Company",
      message: "Are you sure you want to delete this company? This action cannot be undone.",
      confirmText: "Delete",
      type: "danger",
    });
    if (!confirmed) return;
    setCustomLoader(true);
    const data = await API("DELETE", `company?id=${id}`);
    if (data.error) {
      setError(data.error);
      setCustomLoader(false);
      return;
    }
    invalidate();
    setCustomLoader(false);
  };

  const toggleStatus = async id => {
    const company = companies.find(c => c.id === id);
    if (!company) return;

    const newStatus = company.status === "active" ? "inactive" : "active";
    const confirmed = await confirm({
      title: "Change Company Status",
      message: `Are you sure you want to change "${company.name}" status to ${newStatus}?`,
      confirmText: "Change Status",
      type: "warning",
    });
    if (!confirmed) return;
    setCustomLoader(true);
    const data = await API("POST", `company`, { id, status: newStatus, name: company.name });
    if (data.error) {
      setError(data.error);
      setCustomLoader(false);
      return;
    }
    invalidate();
    setCustomLoader(false);
  };

  const resetForm = () => {
    setName("");
    setEdit(null);
    setError("");
    setCustomLoader(false);
  };

  return (
    <>
      <Head>
        <title>Companies Management - ExpoSaaS</title>
      </Head>

      <Sidebar>
        <div className="p-6 bg-[var(--background)] min-h-screen">
          {/* Header Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[var(--surface)] rounded-lg border border-[var(--border)]">
                  <Building2 className="w-6 h-6 text-[var(--primary)]" />
                </div>
                <h1 className="text-3xl font-bold text-[var(--foreground)]">Companies Management</h1>
              </div>
              {/* Add Company Button */}
              <button onClick={() => setEdit(0)} className="btn-primary">
                <Plus className="w-5 h-5" />
                Add Company
              </button>
            </div>
            <p className="text-[var(--secondary-foreground)]">Manage and oversee all registered companies in your platform</p>
          </div>

          {/* Add Company Modal/Form */}
          {edit != null && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
              <div className="bg-[var(--surface)] border bounce border-[var(--border)] rounded-xl p-6 w-full max-w-md">
                <h3 className="text-xl font-semibold text-[var(--foreground)] mb-4">{edit === 0 ? "Add New Company" : "Edit Company"}</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--secondary-foreground)] mb-2">Company Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          editData();
                        }
                      }}
                      placeholder="Enter company name..."
                      className="w-full px-4 py-3 bg-[var(--input)] border border-[var(--border)] rounded-lg
                               text-[var(--foreground)] placeholder-[var(--secondary-foreground)]
                               focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent
                               transition-all duration-200"
                      autoFocus
                    />
                  </div>
                  <Error message={error} />

                  <div className="flex gap-3">
                    <button onClick={editData} className="w-40 btn-primary">
                      {edit === 0 ? "Add Company" : "Save Changes"}
                    </button>
                    <button
                      onClick={() => {
                        resetForm();
                      }}
                      className="px-4 py-2 bg-[var(--secondary)] hover:bg-[var(--border)]
                               text-[var(--secondary-foreground)] rounded-lg font-medium transition-all duration-200"
                    >
                      Cancel
                    </button>
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
                  <p className="text-[var(--secondary-foreground)] text-sm font-medium">Total Companies</p>
                  <p className="text-2xl font-bold text-[var(--foreground)]">{isLoading ? "..." : total}</p>
                </div>
                <div className="p-3 bg-[var(--primary)]/10 rounded-lg">
                  <Building2 className="w-6 h-6 text-[var(--primary)]" />
                </div>
              </div>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[var(--secondary-foreground)] text-sm font-medium">Active Companies</p>
                  <p className="text-2xl font-bold text-[var(--success)]">{isLoading ? "..." : total - inactive}</p>
                </div>
                <div className="p-3 bg-[var(--success)]/10 rounded-lg">
                  <div className="w-6 h-6 bg-[var(--success)] rounded-full"></div>
                </div>
              </div>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[var(--secondary-foreground)] text-sm font-medium">Inactive Companies</p>
                  <p className="text-2xl font-bold text-[var(--warning)]">{isLoading ? "..." : inactive}</p>
                </div>
                <div className="p-3 bg-[var(--warning)]/10 rounded-lg">
                  <div className="w-6 h-6 bg-[var(--warning)] rounded-full"></div>
                </div>
              </div>
            </div>
          </div>
          <Error message={listError} />
          {customLoader && <Loader />}
          {/* DataTable with JSX children */}
          <DataTable
            data={companies}
            total={total}
            isLoading={isLoading}
            searchPlaceholder="Search companies..."
            onSearch={handleSearch}
            onSort={handleSort}
            onPageChange={handlePageChange}
            title="Companies"
            sortBy={sortBy}
            sortOrder={sortOrder}
          >
            {/* Table Headers with sortable IDs */}
            <thead className="bg-[var(--secondary)]">
              <tr>
                <th id="id">ID</th>
                <th id="name">Company Name</th>
                <th id="status">Status</th>
                <th id="createdAt">Created Date</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>

            {/* Table Body with data rows */}
            <tbody>
              {companies.map(company => (
                <tr key={company.id} className="hover:bg-[var(--input)] transition-colors duration-200">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-mono text-[var(--secondary-foreground)]">#{company.id.toString().padStart(3, "0")}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-[var(--primary)]/10 rounded-lg">
                        <Building2 className="w-4 h-4 text-[var(--primary)]" />
                      </div>
                      <div className="text-sm font-medium text-[var(--foreground)]">{company.name}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      onClick={() => toggleStatus(company.id)}
                      className={`inline-flex cursor-pointer items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                        ${company.status === "active" ? "bg-[var(--success)]/10 text-[var(--success)]" : "bg-[var(--warning)]/10 text-[var(--warning)]"}`}
                    >
                      {company.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--secondary-foreground)]">{new Date(company.createdAt).toLocaleString("en-GB")}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => loadEdit(company.id)}
                        className="p-2 text-[var(--secondary-foreground)] hover:text-[var(--primary)]
                                 hover:bg-[var(--primary)]/10 rounded-lg transition-all duration-200"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteIt(company.id)}
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
    </>
  );
}
