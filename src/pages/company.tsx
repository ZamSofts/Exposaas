import { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useConfirm, useAuth, Error, API, Skeleton } from "@/hooks/wrapper";
import Sidebar from "@/components/Sidebar";
import { Plus, Search, Building2, Edit, Trash2, MoreVertical } from "lucide-react";

type Company = {
  id: number;
  name: string;
  createdAt: string;
  status: "active" | "inactive";
};

export default function Company() {
  const session = useAuth();
  const router = useRouter();
  const { confirm, ConfirmComponent } = useConfirm();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [name, setName] = useState("");
  const [edit, setEdit] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [inactive, setInactive] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (session?.role !== "Sadmin") {
      router.push("/");
    }

    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    const data = await API("GET", "company");
    if (data.error) {
      setError(data.error);
      setIsLoading(false);
      return;
    }
    console.log(data);
    setCompanies(data.company);
    setTotal(data.total);
    setInactive(data.inactive);
    setIsLoading(false);
  };
  const editData = async () => {
    if (edit === 0) {
      const data = await API("PUT", "company", { name });
      if (data.error) {
        setError(data.error);
        return;
      }
    } else {
      const data = await API("POST", `company`, { id: edit, name });
      if (data.error) {
        setError(data.error);
        return;
      }
    }

    loadData();
    setName("");
    setEdit(null);
  };

  const loadEdit = async (id: number) => {
    setEdit(id);
    const data = await API("GET", `company?id=${id}`);
    console.log(data);
    setName(data.name);
    setEdit(id);
  };

  const deleteIt = async (id: number) => {
    const confirmed = await confirm({
      title: "Delete Company",
      message: "Are you sure you want to delete this company? This action cannot be undone.",
      confirmText: "Delete",
      type: "danger",
    });
    if (!confirmed) return;
    const data = await API("DELETE", `company?id=${id}`);
    if (data.error) {
      setError(data.error);
      return;
    }
    loadData();
  };

  const toggleStatus = async (id: number) => {
    const company = companies.find((c) => c.id === id);
    if (!company) return;

    const newStatus = company.status === "active" ? "inactive" : "active";
    const confirmed = await confirm({
      title: "Change Company Status",
      message: `Are you sure you want to change "${company.name}" status to ${newStatus}?`,
      confirmText: "Change Status",
      type: "warning",
    });
    if (!confirmed) return;

    const data = await API("POST", `company`, { id, status: newStatus });
    if (data.error) {
      setError(data.error);
      return;
    }
    loadData();
  };

  return (
    <>
      <Head>
        <title>Companies Management - ExpoSaaS</title>
      </Head>

      <Sidebar>
        <div className="p-8 bg-[var(--background)] min-h-screen">
          {/* Header Section */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-[var(--surface)] rounded-lg border border-[var(--border)]">
                <Building2 className="w-6 h-6 text-[var(--primary)]" />
              </div>
              <h1 className="text-3xl font-bold text-[var(--foreground)]">Companies Management</h1>
            </div>
            <p className="text-[var(--secondary-foreground)]">Manage and oversee all registered companies in your platform</p>
          </div>

          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[var(--secondary-foreground)]" />
              <input
                type="text"
                placeholder="Search companies..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-[var(--input)] border border-[var(--border)] rounded-lg 
                         text-[var(--foreground)] placeholder-[var(--secondary-foreground)]
                         focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent
                         transition-all duration-200"
              />
            </div>

            {/* Add Company Button */}
            <button
              onClick={() => setEdit(0)}
              className="flex items-center gap-2 px-6 py-3 bg-[var(--primary)] hover:bg-[var(--primary-hover)]
                       text-white rounded-lg font-medium transition-all duration-200 hover:scale-105
                       shadow-lg hover:shadow-xl">
              <Plus className="w-5 h-5" />
              Add Company
            </button>
          </div>

          {/* Add Company Modal/Form */}
          {edit != null && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 w-full max-w-md">
                <h3 className="text-xl font-semibold text-[var(--foreground)] mb-4">Add New Company</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--secondary-foreground)] mb-2">Company Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
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
                    <button
                      onClick={editData}
                      className="flex-1 px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)]
                               text-white rounded-lg font-medium transition-all duration-200
                               disabled:opacity-50 disabled:cursor-not-allowed">
                      Add Company
                    </button>
                    <button
                      onClick={() => {
                        setEdit(null);
                      }}
                      className="px-4 py-2 bg-[var(--secondary)] hover:bg-[var(--border)]
                               text-[var(--secondary-foreground)] rounded-lg font-medium transition-all duration-200">
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

          {/* Companies Table */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden shadow-lg">
            <div className="p-6 border-b border-[var(--border)]">
              <h2 className="text-xl font-semibold text-[var(--foreground)]">Companies ({isLoading ? "..." : companies.length})</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[var(--secondary)]">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-medium text-[var(--secondary-foreground)] uppercase tracking-wider">ID</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-[var(--secondary-foreground)] uppercase tracking-wider">
                      Company Name
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-[var(--secondary-foreground)] uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-[var(--secondary-foreground)] uppercase tracking-wider">
                      Created Date
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-[var(--secondary-foreground)] uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {isLoading ? (
                    <Skeleton columns={5} rows={5} />
                  ) : (
                    <>
                      {companies.map((company) => (
                        <tr key={company.id} className="hover:bg-[var(--input)] transition-colors duration-200">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <span className="text-sm font-mono text-[var(--secondary-foreground)]">#{company.id.toString().padStart(3, "0")}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-[var(--primary)]/10 rounded-lg">
                                <Building2 className="w-4 h-4 text-[var(--primary)]" />
                              </div>
                              <div>
                                <div className="text-sm font-medium text-[var(--foreground)]">{company.name}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              onClick={() => toggleStatus(company.id)}
                              className={`inline-flex cursor-pointer items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                              ${
                                company.status === "active"
                                  ? "bg-[var(--success)]/10 text-[var(--success)]"
                                  : "bg-[var(--warning)]/10 text-[var(--warning)]"
                              }`}>
                              {company.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--secondary-foreground)]">
                            {new Date(company.createdAt).toLocaleString("en-GB")}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => loadEdit(company.id)}
                                className="p-2 text-[var(--secondary-foreground)] hover:text-[var(--primary)] 
                                               hover:bg-[var(--primary)]/10 rounded-lg transition-all duration-200">
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => deleteIt(company.id)}
                                className="p-2 text-[var(--secondary-foreground)] hover:text-[var(--error)] 
                                         hover:bg-[var(--error)]/10 rounded-lg transition-all duration-200">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}

                      {companies.length === 0 && !isLoading && (
                        <tr>
                          <td colSpan={5} className="text-center py-12">
                            <Building2 className="w-12 h-12 text-[var(--secondary-foreground)] mx-auto mb-4" />
                            <p className="text-[var(--secondary-foreground)] text-lg">
                              {search ? "No companies found matching your search." : "No companies registered yet."}
                            </p>
                            {!search && (
                              <button
                                onClick={() => setEdit(0)}
                                className="mt-4 px-6 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)]
                                         text-white rounded-lg font-medium transition-all duration-200">
                                Add Your First Company
                              </button>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Sidebar>

      {/* Confirmation Modal */}
      <ConfirmComponent />
    </>
  );
}
