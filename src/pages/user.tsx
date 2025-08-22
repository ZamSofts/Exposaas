import { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useConfirm, useAuth, Error, API, CustomSelect } from "@/hooks/wrapper";
import Sidebar from "@/components/Sidebar";
import DataTable from "@/components/ui/DataTable";
import { MultiSelect } from "@/hooks/wrapper";
import { CustomButton } from "@/hooks/wrapper";
import { Eye, EyeOff, Plus, Edit, Trash2, User, Users } from "lucide-react";

type Company = {
  id: number;
  name: string;
  createdAt: string;
  status: "active" | "inactive";
};

type User = {
  username: string;
  password: string;
  companyId: number;
  rolesId: number[];
};

export default function Userss() {
  const { session, status } = useAuth(["Sadmin", "Admin"]);
  const router = useRouter();
  const { confirm, ConfirmComponent } = useConfirm();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUser] = useState<User[]>([]);

  const [roles, setRoles] = useState([]);

  const [username, setUserName] = useState("");
  const [companyId, setCompanyId] = useState();
  const [rolesId, setRolesId] = useState<number[]>([]);
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<number[]>([]);

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

      const [companyData, roleData] = await Promise.all([API("GET", "company?col=id,name"), API("GET", "role")]);
      setRoles(!roleData.error && session?.permissions?.includes("view:user") ? roleData.role : []);
      if (!companyData.error && session?.permissions?.includes("view:user")) {
        setCompanies(companyData.company ?? []);
      } else {
        setCompanies([]);
        setCompanyId(session?.companyId ?? "");
      }
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

    const data = await API("GET", `user?${params}`);
    if (data.error) {
      setError(data.error);
      setIsLoading(false);
      return;
    }
    setError("");
    setUser(data.user);
    console.log('User data',data.user);
    setTotal(data.total);
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
    console.log("Editing user data", {
      username,
      password,
      companyId,
      rolesId,
      edit,
    });
    if (!username || !password || rolesId.length === 0) {
      setError(!username ? "Name is required" : !password ? "Password is required" : "Please select a role");
      return;
    }
    if (username == "ad") {
      setError("Username cannot be 'ad'");
      return;
    }
    if (edit === 0) {
      const newUser = {
        username,
        password,
        companyId:
          session?.role != "Sadmin"
            ? Number(session?.companyId)
            : Number(companyId),
        roleIds: rolesId,
      };
      if (
        !newUser.username ||
        !newUser.password ||
        !newUser.companyId ||
        newUser.roleIds.length === 0
      ) {
        setError(
          !newUser.username
            ? "Name is required"
            : !newUser.password
            ? "Password is required"
            : !newUser.companyId
            ? "Please select a company"
            : "Please select a role"
        );
        return;
      }
      if (username == "ad") {
        setError("Username cannot be 'ad'");
        return;
      }

      const data = await API("PUT", "user", newUser);
      if (data.error) {
        setError(data.error);
        return;
      }
    } else {
      const updatedUser = {
        id: edit,
        username,
        password,
        companyId: Number(companyId),
        rolesId: rolesId,
      };
      const data = await API("POST", `user`, updatedUser);
      if (data.error) {
        setError(data.error);
        return;
      }
    }

    loadData();
    setUserName("");
    setPassword("");
    setCompanyId("");
    setError("");
    setRolesId([]);
    setEdit(null);
  };

  const loadEdit = async (id: number) => {
    const data = await API("GET", `user?id=${id}`);
    setIsLoading;
    setUserName(data.username);
    setPassword(data.password);
    setCompanyId(data.companyId);
    setRolesId(data.rolesId);
    setEdit(id);
  };

  const deleteIt = async (id: number) => {
    const confirmed = await confirm({
      title: "Delete User",
      message: "Are you sure you want to delete this user? This action cannot be undone.",
      confirmText: "Delete",
      type: "danger",
    });
    if (!confirmed) return;

    const data = await API("DELETE", `user?id=${id}`);
    if (data.error) {
      setError(data.error);
      return;
    }
    loadData();
  };

  const togglePasswordVisibility = (id: number) => {
    setVisiblePasswords(prev => (prev.includes(id) ? prev.filter(uid => uid !== id) : [...prev, id]));
  };
  const getRoleName = (roleId: number) => {
    const rolename = roles.find(r => r.id === roleId);
    if (!rolename) return "Unknown";
    return rolename.name;
  };
  const getCompanyName = (CompanyId: number) => {
    const companyName = companies.find(c => c.id === CompanyId);
    if (!companyName) return "Unknown";
    return companyName.name;
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
                  <Users className="w-6 h-6 text-[var(--primary)]" />
                </div>
                <h1 className="text-3xl font-bold text-[var(--foreground)]">Users Management</h1>
              </div>
              {/* Add Company Button */}
              <CustomButton title="Add Users" onClick={() => setEdit(0)} className="btn-primary" icon={<Plus className="w-5 h-5" />} />
            </div>
            <p className="text-[var(--secondary-foreground)]">Manage and oversee all registered users in your platform</p>
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
                      value={username}
                      onChange={e => setUserName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          editData();
                        }
                      }}
                      placeholder="Enter user name..."
                      className="input-style"
                      autoFocus
                    />
                    {session.role === "Sadmin" && (
                      <>
                        <label className="input-label">Select Company</label>
                        <CustomSelect data={companies} selectedId={companyId} setSelectedId={setCompanyId} />
                      </>
                    )}
                    <label className="input-label">Select Roles</label>
                    <MultiSelect roles={roles} rolesId={rolesId} setRolesId={setRolesId} />
                    <label className="input-label">Password</label>
                    <div className="relative w-full">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") {
                            editData();
                          }
                        }}
                        placeholder="Enter password..."
                        className="input-style"
                        autoFocus
                      />

                      {/* Eye Icon */}
                      <CustomButton
                        title={showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white hover:text-gray-300"
                      />
                    </div>
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
                  <p className="text-[var(--secondary-foreground)] text-sm font-medium">Total Users</p>
                  <p className="text-2xl font-bold text-[var(--foreground)]">{isLoading ? "..." : total}</p>
                </div>
                <div className="p-3 bg-[var(--primary)]/10 rounded-lg">
                  <Users className="w-6 h-6 text-[var(--primary)]" />
                </div>
              </div>
            </div>
          </div>
          <Error message={error} />

          {/* DataTable with JSX children */}
          <DataTable
            data={users}
            total={total}
            isLoading={isLoading}
            searchPlaceholder="Search Users..."
            onSearch={handleSearch}
            onSort={handleSort}
            onPageChange={handlePageChange}
            title="Users"
            sortBy={sortBy}
            sortOrder={sortOrder}
          >
            {/* Table Headers with sortable IDs */}
            <thead className="bg-[var(--secondary)]">
              <tr>
                <th id="id">ID</th>
                <th id="username">Username</th>
                <th id="companyId">Company</th>
                <th id="role">Role</th>
                <th id="password">Password</th>
                <th id="createdAt">Created Date</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>

            {/* Table Body with data rows */}
            <tbody>
              {users.map(user => (
                <tr key={user.id} className="hover:bg-[var(--input)] transition-colors duration-200">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-mono text-[var(--secondary-foreground)]">#{user.id.toString().padStart(3, "0")}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-[var(--primary)]/10 rounded-lg">
                        <User className="w-4 h-4 text-[var(--primary)]" />
                      </div>
                      <div className="text-sm font-medium text-[var(--foreground)]">{user.username}</div>
                    </div>
                  </td>
                  <td className="px-6  py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-[var(--foreground)]">{user.company?.name}</div>
                  </td>

                  <td className="px-6 py-4 min-w-[100px] max-w-[200px] whitespace-normal">
                    <div className="flex flex-wrap gap-2">
                      {user.rolesnames.map((role, index) => (
                        <span key={index} className="px-3 py-1 text-sm font-medium text-[var(--foreground)] bg-[var(--primary)]/10 rounded-lg">
                          {role || "Unknown"}
                        </span>
                      ))}
                    </div>
                  </td>

                  <td className="px-6  py-4  whitespace-nowrap">
                    <div className="flex flex-row gap-3 items-center justify-center">
                      <div className="text-sm font-medium text-[var(--foreground)]">{visiblePasswords.includes(user.id) ? user.password : "*******"}</div>

                      <div className="text-sm font-medium text-[var(--foreground)]">
                        <button onClick={() => togglePasswordVisibility(user.id)} className="text-gray-500 hover:text-gray-700">
                          {visiblePasswords.includes(user.id) ? <Eye size={20} /> : <EyeOff size={20} />}
                        </button>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--secondary-foreground)]">{new Date(user.createdAt).toLocaleString("en-GB")}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => loadEdit(user.id)}
                        className="p-2 text-[var(--secondary-foreground)] hover:text-[var(--primary)] 
                                 hover:bg-[var(--primary)]/10 rounded-lg transition-all duration-200"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteIt(user.id)}
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
