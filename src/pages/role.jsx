import { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useConfirm, useAuth, Error, API, MultiSelect, CustomButton, Loader } from "@/hooks/wrapper";
import Sidebar from "@/components/Sidebar";
import DataTable from "@/components/ui/DataTable";
import { Plus, Edit, Trash2, Shield } from "lucide-react";

export default function Role() {
  const { session, status } = useAuth(["view:permission"]);
  const router = useRouter();
  const { confirm, ConfirmComponent } = useConfirm();

  const [roles, setRole] = useState([]);
  const [static_permissions, setStaticPermissions] = useState([]);

  const [name, setName] = useState("");
  const [permissions, setPermission] = useState([]);

  const [edit, setEdit] = useState(null);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [customLoader, setcustomLoader] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isFullAccess, setIsFullAccess] = useState(false);

  // Pagination and search states
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [search, setSearch] = useState("");

  // Sorting state managed by parent
  const [sortBy, setSortBy] = useState("id");
  const [sortOrder, setSortOrder] = useState("asc");

  // Reload data when pagination, search, or sorting changes
  useEffect(() => {
    loadData();
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

  const loadData = async () => {
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
    if (!name || (permissions.length === 0 && !isFullAccess)) {
      setError(!name ? "Role name is required" : "Please select at least one permission");
      return;
    }

    const reserved = ["customer", "sadmin"];
    if (reserved.includes(name.trim().toLowerCase())) {
      setError(`Role name cannot be '${name}'. This is a reserved system role.`);
      return;
    }

    setcustomLoader(true);

    // Use all permissions if Full Access is enabled
    const finalPermissions = isFullAccess 
      ? static_permissions.map(permission => permission.id)
      : permissions;

    // Build payload based on operation type
    let payload;
    if (edit === 0) {
      // Creating new role - include companyId based on user role
      if (session?.role === "Sadmin") {
        // Sadmin creates global roles (no companyId)
        payload = { name, permissions: finalPermissions };
      } else {
        // Company users create company-specific roles (with their companyId)
        payload = { name, permissions: finalPermissions, companyId: session?.companyId };
      }
    } else {
      // Editing existing role - NEVER change companyId, preserve original ownership
      payload = { id: edit, name, permissions: finalPermissions };
    }

    let data;
    if (edit === 0) {
      data = await API("PUT", "role", payload);
    } else {
      data = await API("POST", "role", payload);
    }
    if (data.error) {
      setError(data.error);
      setcustomLoader(false);
      return;
    }
    loadData();
    resetForm();
  };

  const loadEdit = async id => {
    setcustomLoader(true);
    const role = await API("GET", `role?id=${id}`);
    if (!role) {
      setError("User not found");
      setcustomLoader(false);
      return;
    }

    setName(role.name);
    setPermission(role.permissions);
    
    // Check if this role has all permissions (Full Access)
    const hasAllPermissions = static_permissions.length > 0 && 
      static_permissions.every(permission => role.permissions.includes(permission.id));
    setIsFullAccess(hasAllPermissions);
    
    setEdit(id);
    setcustomLoader(false);
  };

  const deleteIt = async id => {
    const confirmed = await confirm({
      title: "Delete Role",
      message: "Are you sure you want to delete this role? This action cannot be undone.",
      confirmText: "Delete",
      type: "danger",
    });
    if (!confirmed) return;
    setcustomLoader(true);
    const data = await API("DELETE", `role?id=${id}`);
    if (data.error) {
      setError(data.error);
      setcustomLoader(false);
      return;
    }
    loadData();
    setcustomLoader(false);
  };

  const getPermissionNames = permissionId => {
    const permission = static_permissions.find(p => p.id === permissionId);
    if (!permission) {
      return "Unknown";
    }
    return permission.name;
  };

  // Check if current user can edit/delete a role
  const canEditRole = role => {
    // Sadmin can edit all roles
    if (session?.role === "Sadmin") {
      return true;
    }

    // Company users can only edit roles that belong to their company
    // Global roles (companyId === null) are created by Sadmin and cannot be edited by company users
    return role.companyId !== null && role.companyId === session?.companyId;
  };

  const resetForm = () => {
    setName("");
    setPermission([]);
    setEdit(null);
    setError("");
    setIsLoading(false);
    setcustomLoader(false);
    setIsDropdownOpen(false);
    setIsFullAccess(false);
  };

  // Handle Full Access toggle
  const handleFullAccessToggle = (checked) => {
    setIsFullAccess(checked);
    if (checked) {
      // Select all permissions
      setPermission(static_permissions.map(permission => permission.id));
    } else {
      // Clear all permissions
      setPermission([]);
    }
  };

  // Handle individual permission changes
  const handlePermissionChange = (selectedPermissions) => {
    setPermission(selectedPermissions);
    
    // Check if all permissions are selected
    const allSelected = static_permissions.length > 0 && 
      static_permissions.every(permission => selectedPermissions.includes(permission.id));
    setIsFullAccess(allSelected);
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
              <div 
                className={`bg-[var(--surface)] border bounce border-[var(--border)] rounded-xl p-6 w-full max-w-md relative transition-all duration-300 ${
                  isDropdownOpen 
                    ? 'min-h-[600px] max-h-[80vh] overflow-visible' 
                    : 'max-h-[90vh] overflow-y-auto'
                }`}
              >
                <h3 className="text-xl font-semibold text-[var(--foreground)] mb-4">{edit === 0 ? "Add New Role" : "Edit Role"}</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--secondary-foreground)] mb-2">Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          editData();
                        }
                      }}
                      placeholder="Enter role name..."
                      className={`input-style ${name.toLowerCase() === "sadmin" ? "border-[var(--error)] focus:ring-[var(--error)]" : ""}`}
                      autoFocus
                    />
                    {/* {name.toLowerCase() === "sadmin" && (
                      <p className="text-xs text-[var(--error)] mt-1 flex items-center gap-1">
                        <span>⚠️</span>
                        'Sadmin' is a reserved system role name
                      </p>
                    )} */}
                  </div>

                  <div className="relative z-[60]">
                    <div className="flex items-center justify-between mb-3">
                      <label className="input-label">Select Permissions</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="fullAccess"
                          checked={isFullAccess}
                          onChange={(e) => handleFullAccessToggle(e.target.checked)}
                          className="input-label"
                        />
                        <label htmlFor="fullAccess" className="input-label">
                          Full Access
                        </label>
                      </div>
                    </div>
                    <MultiSelect 
                      roles={static_permissions} 
                      rolesId={permissions} 
                      setRolesId={handlePermissionChange}
                      onDropdownToggle={setIsDropdownOpen}
                      placeholder={isFullAccess ? "All permissions selected" : "Select permissions..."}
                    />
                    {isFullAccess && (
                      <p className="text-xs text-[var(--primary)] mt-1 flex items-center gap-1">
                        Full access enabled - all permissions will be granted
                      </p>
                    )}
                  </div>
                  
                  <Error message={error} />

                  <div className="flex gap-3 pt-4">
                    <CustomButton title={edit === 0 ? "Add Role" : "Save Changes"} onClick={editData} className="btn-primary" />

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
          <Error message={error} />

          {customLoader && <Loader />}
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
              {roles.map(role => (
                <tr key={role.id} className="hover:bg-[var(--input)] transition-colors duration-200">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-mono text-[var(--secondary-foreground)]">#{role.id.toString().padStart(3, "0")}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-[var(--primary)]/10 rounded-lg">
                        <Shield className="w-4 h-4 text-[var(--primary)]" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-[var(--foreground)]">
                          {role.name}
                          {role.companyId === null && <span className="px-2 py-0.5 ml-3 text-xs font-medium bg-[var(--primary)]/20 text-[var(--primary)] rounded-full">Global Role</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 min-w-[100px] max-w-[200px] whitespace-normal">
                    <div className="flex flex-wrap gap-2">
                      {role.permissions.map((permissionId, index) => (
                        <span key={index} className="px-3 py-1 text-sm font-medium text-[var(--foreground)] bg-[var(--primary)]/10 rounded-lg">
                          {getPermissionNames(permissionId)}
                        </span>
                      ))}
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <div className="flex items-center justify-end gap-2">
                      {canEditRole(role) ? (
                        <>
                          <button
                            onClick={() => loadEdit(role.id)}
                            className="p-2 text-[var(--secondary-foreground)] hover:text-[var(--primary)] 
                                     hover:bg-[var(--primary)]/10 rounded-lg transition-all duration-200"
                            title="Edit role"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteIt(role.id)}
                            className="p-2 text-[var(--secondary-foreground)] hover:text-[var(--error)] 
                                   hover:bg-[var(--error)]/10 rounded-lg transition-all duration-200"
                            title="Delete role"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <div className="flex items-center gap-1 text-xs text-[var(--secondary-foreground)]">
                          <span className="p-2 rounded-lg bg-[var(--secondary)]/20">
                            <Edit className="w-4 h-4 opacity-50" />
                          </span>
                          <span className="p-2 rounded-lg bg-[var(--secondary)]/20">
                            <Trash2 className="w-4 h-4 opacity-50" />
                          </span>
                          <span className="text-xs">{role.companyId === null ? "" : "No Permission"}</span>
                        </div>
                      )}
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
