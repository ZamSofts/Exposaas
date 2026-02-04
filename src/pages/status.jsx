import { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useConfirm } from "@/components/ui/ConfirmModal";
import { useAuth } from "@/hooks/useAuth";
import Error from "@/components/ui/Error";
import { API } from "@/lib/api";
import { CustomButton } from "@/components/ui/CustomButton";
import { Loader } from "@/components/ui/Loader";
import Sidebar from "@/components/Sidebar";
import { Plus, Edit, Trash2, Tag } from "lucide-react";
import Skeleton from "@/components/ui/Skeleton";

export default function StatusPage() {
  const { session, status: authStatus } = useAuth(["Sadmin", "Admin"]);
  const router = useRouter();
  const { confirm, ConfirmComponent } = useConfirm();

  const [statuses, setStatuses] = useState([]);
  const [name, setName] = useState("");
  const [edit, setEdit] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [customLoader, setCustomLoader] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setError("");
    try {
      const data = await API("GET", "status");
      if (data.error) {
        setError(data.error);
        setIsLoading(false);
        return;
      }
      setStatuses(data.statuses || []);
      setIsLoading(false);
    } catch (error) {
      setError("Something went wrong");
      setIsLoading(false);
    }
  };
  const editData = async () => {
    if (!name.trim()) {
      setError("Status name is required");
      return;
    }
    setCustomLoader(true);
    if (edit === 0) {
      const data = await API("PUT", "status", { name });
      if (data.error) {
        setError(data.error);
        setCustomLoader(false)
        return;
      }
    } else {
      const data = await API("POST", "status", { id: edit, name });
      if (data.error) {
        setError(data.error);
        setCustomLoader(false)
        return;
      }
    }
    resetForm()
    loadData();
  };

  const loadEdit = async id => {
    setCustomLoader(true);
    const data = await API("GET", `status?id=${id}`);
    if (data.error) {
      setError(data.error);
      setCustomLoader(false)
      return;
    }
    setName(data.name);
    setEdit(id);
    setCustomLoader(false);
  };

  const deleteIt = async id => {
    const confirmed = await confirm({
      title: "Delete Status",
      message: "Are you sure you want to delete this status? This action cannot be undone.",
      confirmText: "Delete",
      type: "danger",
    });
    if (!confirmed) return;
    setCustomLoader(true);
    const data = await API("DELETE", `status?id=${id}`);
    if (data.error) {
      setError(data.error);
      setCustomLoader(false)
      return;
    }
    loadData();
    setCustomLoader(false);
  };

  const resetForm = () => {
    setName("");
    setEdit(null);
    setError("");
    setCustomLoader(false);
  };

  if (authStatus === "loading") {
    return <div className="flex items-center justify-center min-h-screen"></div>;
  }

  if (!session) {
    router.push("/");
    return null;
  }

  return (
    <>
      <Head>
        <title>Status Management - ExpoSaaS</title>
      </Head>
      <Sidebar>
        <div className="p-8 bg-[var(--background)] min-h-screen">
          {/* Header Section */}
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[var(--surface)] rounded-lg border border-[var(--border)]">
                <Tag className="w-6 h-6 text-[var(--primary)]" />
              </div>
              <h1 className="text-3xl font-bold text-[var(--foreground)]">Status Management</h1>
            </div>
            <CustomButton title="Add Status" onClick={() => setEdit(0)} className="btn-primary" icon={<Plus className="w-5 h-5" />} />
          </div>

          {/* Add/Edit Status Modal */}
          {edit !== null && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 sm:p-4 z-50">
              <div className="bg-[var(--surface)] border bounce border-[var(--border)] rounded-xl p-4 sm:p-6 w-full max-w-md">
                <h3 className="text-lg sm:text-xl font-semibold mb-6">{edit === 0 ? "Add New Status" : "Edit Status"}</h3>
                <div className="space-y-4">
                  <div>
                    <label className="input-label">Status Name</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} className="input-style" placeholder="Enter status name..." />
                  </div>
                  <div className="mt-4">
                    <Error message={error} />
                  </div>
                  <div className="flex gap-3">
                    <CustomButton title={edit === 0 ? "Add Role" : "Save Changes"} onClick={editData} className="btn-primary" />

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

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[var(--secondary-foreground)] text-sm font-medium">Total Statuses</p>
                  <p className="text-2xl font-bold text-[var(--foreground)]">{isLoading ? "..." : statuses.length}</p>
                </div>
                <div className="p-3 bg-[var(--primary)]/10 rounded-lg">
                  <Tag className="w-6 h-6 text-[var(--primary)]" />
                </div>
              </div>
            </div>
          </div>

          <Error message={error} />
          {customLoader && <Loader />}

          {/* Status Table */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden">
            <div className="p-4 border-b border-[var(--border)]">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">All Statuses</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[var(--secondary)]">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--secondary-foreground)] uppercase tracking-wider">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--secondary-foreground)] uppercase tracking-wider">Status Name</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-[var(--secondary-foreground)] uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-[var(--surface)] divide-y divide-[var(--border)]">
                  {isLoading ? (
                    <Skeleton columns={3} rows={5} />
                  ) : statuses.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="px-6 py-4 text-center text-[var(--muted-foreground)]">
                        No statuses found
                      </td>
                    </tr>
                  ) : (
                    statuses.map(status => (
                      <tr key={status.id} className="hover:bg-[var(--input)] transition-colors duration-200">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-mono text-[var(--secondary-foreground)]">#{status.id.toString().padStart(3, "0")}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-[var(--primary)]/10 rounded-lg">
                              <Tag className="w-4 h-4 text-[var(--primary)]" />
                            </div>
                            <div className="text-sm font-medium text-[var(--foreground)]">{status.name}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => loadEdit(status.id)}
                              className="p-2 text-[var(--secondary-foreground)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 rounded-lg transition-all duration-200"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteIt(status.id)}
                              className="p-2 text-[var(--secondary-foreground)] hover:text-[var(--error)] hover:bg-[var(--error)]/10 rounded-lg transition-all duration-200"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Sidebar>
      <ConfirmComponent />
    </>
  );
}
