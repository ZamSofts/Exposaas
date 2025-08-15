import { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useConfirm, useAuth, Error, API } from "@/hooks/wrapper";
import Sidebar from "@/components/Sidebar";
import DataTable from "@/components/ui/DataTable";
import { MultiSelect } from "@/hooks/wrapper";
import { CustomButton } from "@/hooks/wrapper";
import { Plus, Edit, Trash2, Users, Shield } from "lucide-react";

type Role = {
  id: number;
  name: string;
  permissions: number[];
  createdAt: Date;
};

export default function Role() {
  const session = useAuth(["Sadmin", "Admin"]);
  const router = useRouter();
  const { confirm, ConfirmComponent } = useConfirm();

  const [roles, setRole] = useState<Role[]>([]);

  const [static_permissions, setStaticPermissions] = useState([
    { id: 1, name: "vehicle:view" },
    { id: 2, name: "vehicle:create" },
    { id: 3, name: "vehicle:update" },
    { id: 4, name: "vehicle:delete" },
    { id: 5, name: "document:view" },
    { id: 6, name: "document:create" },
    { id: 7, name: "document:update" },
    { id: 8, name: "document:delete" },
  ]);

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
    loadPermissions();
    setTotal(roles.length);
  }, [currentPage, perPage, search, sortBy, sortOrder, roles]);

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    setIsLoading(true);

    /* const data = await API("GET", `permisssions?${params}`);
    if (data.error) {
      setError(data.error);
      setIsLoading(false);
      return;
    }
    setError("");
    console.log("Companies Data", data.company);
    setCompanies(data.company);
    //setTotal(data.total); */

    setIsLoading(false);
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
        id: Date.now(),
        name,
        permissions,
        createdAt: new Date(),
      };

      setRole((prev) => [newRole, ...prev]);

      // const data = await API("PUT", "company", { name });
      // if (data.error) {
      //   setError(data.error);
      //}
    } else {
      const role = roles.find((r) => r.id === edit);
      if (!role) {
        setError("Role not found");
        return;
      }

      const updatedRole: Role = {
        ...role,
        name,
        permissions,
      };

      setRole((prev) => prev.map((r) => (r.id === edit ? updatedRole : r)));

      // const data = await API("POST", `company`, { id: edit, name });
      // if (data.error) {
      //   setError(data.error);
      //   return;
      // }
    }

    /*  loadData(); */
    setName("");
    setPermission([]);
    setEdit(null);
  };

  const loadEdit = async (id: number) => {
    //const data = await API("GET", `company?id=${id}`);
    const role = roles.find((r) => r.id === id);
    if (!role) {
      setError("User not found");
      return;
    }

    setName(role.name);

    setPermission(role.permissions); // <-- add this
    setEdit(id);
  };

  const deleteIt = async (id: number) => {
    const confirmed = await confirm({
      title: "Delete Role",
      message: "Are you sure you want to delete this role? This action cannot be undone.",
      confirmText: "Delete",
      type: "danger",
    });
    if (!confirmed) return;
    const newRole = roles.filter((u) => u.id !== id);
    setRole([...newRole]);
    /*  const data = await API("DELETE", `company?id=${id}`);
    if (data.error) {
      setError(data.error);
      return;
    } */
    /* loadData(); */
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
                <h1 className="text-3xl font-bold text-[var(--foreground)]">Roles Management</h1>
              </div>
              {/* Add Company Button */}
              <CustomButton title="Add Roles" onClick={() => setEdit(0)} className="btn-primary" icon={<Plus className="w-5 h-5" />} />
            </div>
            <p className="text-[var(--secondary-foreground)]">Manage and oversee all registered roles in your platform</p>
          </div>

          {/* Add User Modal/Form */}
          {edit != null && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
              <div className="bg-[var(--surface)] border bounce border-[var(--border)] rounded-xl p-6 w-full max-w-md">
                <h3 className="text-xl font-semibold text-[var(--foreground)] mb-4">{edit === 0 ? "Add New User" : "Edit User"}</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--secondary-foreground)] mb-2">Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          editData();
                        }
                      }}
                      placeholder="Enter Role name..."
                      className="input-style"
                      autoFocus
                    />

                    <label className="input-label">Select Roles</label>
                    <MultiSelect roles={static_permissions} rolesId={permissions} setRolesId={setPermission} />
                  </div>
                  <Error message={error} />

                  <div className="flex gap-3">
                    <CustomButton title={edit === 0 ? "Add User" : "Save Changes"} onClick={editData} className="btn-primary" />

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
                  <p className="text-[var(--secondary-foreground)] text-sm font-medium">Total Roles</p>
                  <p className="text-2xl font-bold text-[var(--foreground)]">{isLoading ? "..." : total}</p>
                </div>
                <div className="p-3 bg-[var(--primary)]/10 rounded-lg">
                  <Shield className="w-6 h-6 text-[var(--primary)]" />
                </div>
              </div>
            </div>
          </div>

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
            sortOrder={sortOrder}>
            {/* Table Headers with sortable IDs */}
            <thead className="bg-[var(--secondary)]">
              <tr>
                <th id="id">ID</th>
                <th id="name">Name</th>
                <th id="permissions">Permissions</th>
                <th id="createdAt">Created Date</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>

            {/* Table Body with data rows */}
            <tbody>
              {roles.map((role) => (
                <tr key={role.id} className="hover:bg-[var(--input)] transition-colors duration-200">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-mono text-[var(--secondary-foreground)]">#{role.id.toString().padStart(3, "0")}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-[var(--primary)]/10 rounded-lg">
                        <Shield className="w-4 h-4 text-[var(--primary)]" />
                      </div>
                      <div className="text-sm font-medium text-[var(--foreground)]">{role.name}</div>
                    </div>
                  </td>
                  {/* <td className="px-6  py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-[var(--foreground)]">
                      {getPermissionNames(role.permissions)}
                    </div>
                  </td> */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    {role.permissions.map((permissionid, index) => (
                      <div key={index} className="text-sm font-medium text-[var(--foreground)]">
                        {getPermissionNames(permissionid)}
                      </div>
                    ))}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--secondary-foreground)]">
                    {new Date(role.createdAt).toLocaleString("en-GB")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => loadEdit(role.id)}
                        className="p-2 text-[var(--secondary-foreground)] hover:text-[var(--primary)] 
                                 hover:bg-[var(--primary)]/10 rounded-lg transition-all duration-200">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteIt(role.id)}
                        className="p-2 text-[var(--secondary-foreground)] hover:text-[var(--error)] 
                               hover:bg-[var(--error)]/10 rounded-lg transition-all duration-200">
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
