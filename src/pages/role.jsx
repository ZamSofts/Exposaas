import { useState } from "react";
import Head from "next/head";
import { useConfirm, Error, API, MultiSelect, CustomButton, Loader, useAuth, DataTable, PermissionSelector, usePaginatedList, useStaticOptions, queryKeys } from "@/hooks/wrapper";
import { useQueryClient } from "@tanstack/react-query";
import Sidebar from "@/components/Sidebar";

import { Plus, Edit, Trash2, Shield } from "lucide-react";

export default function Role() {
  const { session } = useAuth(["view:role", "Sadmin"]);
  const { confirm, ConfirmComponent } = useConfirm();
  const queryClient = useQueryClient();

  // ── Data fetching (React Query) ──
  const {
    items: roles, total, isLoading, error: listError,
    handleSearch, handleSort, handlePageChange, sortBy, sortOrder,
  } = usePaginatedList(queryKeys.roles, "role", {
    defaultPerPage: 10,
    select: (res) => ({
      items: res.role || [],
      total: res.total || 0,
    }),
  });

  // ── Static data: permissions list ──
  const static_permissions = useStaticOptions(
    queryKeys.permissions(),
    "permission",
    (data) => data?.permissions || [],
  );

  // ── Form state ──
  const [name, setName] = useState("");
  const [permissions, setPermission] = useState([]);

  const [edit, setEdit] = useState(null);
  const [error, setError] = useState("");
  const [customLoader, setcustomLoader] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isFullAccess, setIsFullAccess] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["roles"] });

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
    const finalPermissions = isFullAccess ? static_permissions.map(permission => permission.id) : permissions;

    // Build payload based on operation type
    let payload;
    if (edit === 0) {
      if (session?.role === "Sadmin") {
        payload = { name, permissions: finalPermissions };
      } else {
        payload = { name, permissions: finalPermissions, companyId: session?.companyId };
      }
    } else {
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
    invalidate();
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
    const hasAllPermissions = static_permissions.length > 0 && static_permissions.every(permission => role.permissions.includes(permission.id));
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
    invalidate();
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
    return role.companyId !== null && role.companyId === session?.companyId;
  };

  const resetForm = () => {
    setName("");
    setPermission([]);
    setEdit(null);
    setError("");
    setcustomLoader(false);
    setIsDropdownOpen(false);
    setIsFullAccess(false);
  };

  // Handle Full Access toggle
  const handleFullAccessToggle = checked => {
    setIsFullAccess(checked);
    if (checked) {
      setPermission(static_permissions.map(permission => permission.id));
    } else {
      setPermission([]);
    }
  };

  // Handle individual permission changes
  const handlePermissionChange = selectedPermissions => {
    setPermission(selectedPermissions);
    const allSelected = static_permissions.length > 0 && static_permissions.every(permission => selectedPermissions.includes(permission.id));
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
              <CustomButton title="Add Roles" onClick={() => setEdit(0)} className="btn-primary" icon={<Plus className="w-5 h-5" />} />
            </div>
            <p className="text-[var(--secondary-foreground)]">Manage and oversee all registered roles in your platform</p>
          </div>

          {/* Add User Modal/Form */}
          {edit != null && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
              <div
                className={`bg-[var(--surface)] border bounce border-[var(--border)] rounded-xl p-6 w-full
    max-w-sm sm:max-w-md md:max-w-lg lg:max-w-2xl xl:max-w-2xl
    relative transition-all duration-300
    ${isDropdownOpen ? "min-h-[600px] max-h-[80vh] overflow-visible" : "max-h-[90vh] overflow-y-auto"}`}
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
                  </div>

                  <div className="relative z-[60]">
                    <label className="input-label">Select Permissions</label>
                    <PermissionSelector static_permissions={static_permissions} permissions={permissions} setPermission={setPermission} isFullAccess={isFullAccess} setIsFullAccess={setIsFullAccess} />
                    {isFullAccess && <p className="text-xs text-[var(--primary)] mt-1 flex items-center gap-1">Full access enabled - all permissions will be granted</p>}
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
          <Error message={listError || error} />

          {customLoader && <Loader />}
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
            <thead className="bg-[var(--secondary)]">
              <tr>
                <th id="id">ID</th>
                <th id="name">Name</th>
                <th >Permissions</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>

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

      <ConfirmComponent />
    </>
  );
}
