import { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useConfirm, useAuth, Error, API } from "@/hooks/wrapper";
import Sidebar from "@/components/Sidebar";
import DataTable from "@/components/ui/DataTable";
import { MultiSelect } from "@/hooks/wrapper";
import { CustomButton } from "@/hooks/wrapper";
import { Plus, Edit, Trash2, Users, Shield } from "lucide-react";
import { get } from "http";

type Role = {
  name: string;
  permissions: number[];
};

export default function Role() {
  const session = useAuth(["Sadmin", "Admin"]);
  const router = useRouter();
  const { confirm, ConfirmComponent } = useConfirm();

  const [roles, setRole] = useState<Role[]>([]);

  const [static_permissions, setStaticPermissions] = useState([]);

  const [name, setName] = useState("");
  const [permissions, setPermission] = useState<number[]>([]);

  const [edit, setEdit] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Pagination and search states
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [search, setSearch] = useState("");

  // Sorting state managed by parent
  const [sortBy, setSortBy] = useState("id");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Reload data when pagination, search, or sorting changes
  useEffect(() => {
    getRoleData();
  }, [currentPage, perPage, search, sortBy, sortOrder]);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setIsLoading(true);

      const Data = await API("GET", "permission");
      if (Data.error) {
        setError(Data.error);
        return;
      }
      setError("");
      setStaticPermissions(Data.permissions);
    } catch (err) {
      setError("Failed to load data");
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleData = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: perPage.toString(),
        search: search,
        sortBy: sortBy,
        sortOrder: sortOrder,
      });

      const data = await API("GET", `role?${params}`);
      if (data.error) {
        setError(data.error);
        return;
      }
      setRole(data.role);
      setTotal(data.total);
    } catch (err) {
      setError("Failed to load roles");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSort = (column: string, order: "asc" | "desc") => {
    setSortBy(column);
    setSortOrder(order);
  };

  const handleSearch = (search: string) => {
    setSearch(search);
    setCurrentPage(1); // Reset to first page on search
  };

  const handlePageChange = (page: number, perPageValue: number) => {
    setCurrentPage(page);
    setPerPage(perPageValue);
  };

  const editData = async () => {
    if (!name || permissions.length === 0) {
      setError(!name ? "Name is required" : "Please select a Permission");
      return;
    }
    if (edit === 0) {
      const newRole = {
        name,
        permissions,
      };
      const data = await API("PUT", `role`, newRole);
      if (data.error) {
        setError(data.error);
        return;
      }
    } else {
      const updatedRole = { id: edit, name, permissions };

      const data = await API("POST", `role`, updatedRole);
      if (data.error) {
        setError(data.error);
        return;
      }
    }

    getRoleData();
    setName("");
    setPermission([]);
    setEdit(null);
  };

  const loadEdit = async (id: number) => {
    const role = await API("GET", `role?id=${id}`);
    if (!role) {
      setError("User not found");
      return;
    }

    setName(role.name);
    setPermission(role.permissions);
    setEdit(id);
  };

  const deleteIt = async (id: number) => {
    const confirmed = await confirm({
      title: "Delete Role",
      message:
        "Are you sure you want to delete this role? This action cannot be undone.",
      confirmText: "Delete",
      type: "danger",
    });
    if (!confirmed) return;
    const newRole = roles.filter((u) => u.id !== id);
    setRole([...newRole]);
    const data = await API("DELETE", `role?id=${id}`);
    if (data.error) {
      setError(data.error);
      return;
    }
    getRoleData();
  };

  const getPermissionNames = (permissionId: number) => {
    const permission = static_permissions.find((p) => p.id === permissionId);
    if (!permission) {
      return "Unknown";
    }
    return permission.name;
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
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[var(--surface)] rounded-lg border border-[var(--border)]">
                  <Shield className="w-6 h-6 text-[var(--primary)]" />
                </div>
                <h1 className="text-3xl font-bold text-[var(--foreground)]">
                  Roles Management
                </h1>
              </div>
              {/* Add Company Button */}
              <CustomButton
                title="Add Roles"
                onClick={() => setEdit(0)}
                className="btn-primary"
                icon={<Plus className="w-5 h-5" />}
              />
            </div>
            <p className="text-[var(--secondary-foreground)]">
              Manage and oversee all registered roles in your platform
            </p>
          </div>

          {/* Add User Modal/Form */}
          {edit != null && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
              <div className="bg-[var(--surface)] border bounce border-[var(--border)] rounded-xl p-6 w-full max-w-md">
                <h3 className="text-xl font-semibold text-[var(--foreground)] mb-4">
                  {edit === 0 ? "Add New Role" : "Edit Role"}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--secondary-foreground)] mb-2">
                      Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          editData();
                        }
                      }}
                      placeholder="Enter role name..."
                      className="input-style"
                      autoFocus
                    />

                    <label className="input-label">Select Permissions</label>
                    <MultiSelect
                      roles={static_permissions}
                      rolesId={permissions}
                      setRolesId={setPermission}
                    />
                  </div>
                  <Error message={error} />

                  <div className="flex gap-3">
                    <CustomButton
                      title={edit === 0 ? "Add Role" : "Save Changes"}
                      onClick={editData}
                      className="btn-primary"
                    />

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

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[var(--secondary-foreground)] text-sm font-medium">
                    Total Roles
                  </p>
                  <p className="text-2xl font-bold text-[var(--foreground)]">
                    {isLoading ? "..." : total}
                  </p>
                </div>
                <div className="p-3 bg-[var(--primary)]/10 rounded-lg">
                  <Shield className="w-6 h-6 text-[var(--primary)]" />
                </div>
              </div>
            </div>
          </div>
          <Error message={error} />
          {/* DataTable with JSX children */}
          <DataTable
            data={roles}
            total={total}
            isLoading={isLoading}
            searchPlaceholder="Search Roles..."
            onSearch={handleSearch}
            onSort={handleSort}
            onPageChange={handlePageChange}
            title="Roles"
            sortBy={sortBy}
            sortOrder={sortOrder}
          >
            {/* Table Headers with sortable IDs */}
            <thead className="bg-[var(--secondary)]">
              <tr>
                <th id="id">ID</th>
                <th id="name">Name</th>
                <th id="permissions">Permissions</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>

            {/* Table Body with data rows */}
            <tbody>
              {roles.map((role) => (
                <tr
                  key={role.id}
                  className="hover:bg-[var(--input)] transition-colors duration-200"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-mono text-[var(--secondary-foreground)]">
                      #{role.id.toString().padStart(3, "0")}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-[var(--primary)]/10 rounded-lg">
                        <Shield className="w-4 h-4 text-[var(--primary)]" />
                      </div>
                      <div className="text-sm font-medium text-[var(--foreground)]">
                        {role.name}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 min-w-[100px] max-w-[200px] whitespace-normal">
                    <div className="flex flex-wrap gap-2">
                      {role.permissions.map((permissionId, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 text-sm font-medium text-[var(--foreground)] bg-[var(--primary)]/10 rounded-lg"
                        >
                          {getPermissionNames(permissionId)}
                        </span>
                      ))}
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => loadEdit(role.id)}
                        className="p-2 text-[var(--secondary-foreground)] hover:text-[var(--primary)] 
                                 hover:bg-[var(--primary)]/10 rounded-lg transition-all duration-200"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteIt(role.id)}
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
