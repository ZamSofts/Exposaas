import { useState, useMemo, useCallback, createContext, useContext } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/router";
import {
  Home,
  Users,
  Menu,
  Building2,
  Shield,
  Car,
  BarChart3,
  FlaskConical,
  Sparkles,
  FolderOpen,
  FileSpreadsheet,
} from "lucide-react";
import { isAllowed } from "../hooks/wrapper";
import SidebarNav from "@/components/sidebar/SidebarNav";
import SidebarSettings from "@/components/sidebar/SidebarSettings";

const SidebarContext = createContext({
  isCollapsed: false,
  setIsCollapsed: () => {},
});

export const useSidebar = () => useContext(SidebarContext);

export default function Sidebar({ children }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const contextValue = useMemo(
    () => ({ isCollapsed, setIsCollapsed }),
    [isCollapsed]
  );

  return (
    <SidebarContext.Provider value={contextValue}>
      <div className="min-h-screen bg-[var(--background)]">
        <SidebarContent isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
        {isMobileMenuOpen && (
          <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />
        )}
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="fixed top-4 left-4 z-30 md:hidden w-10 h-10 rounded-lg bg-[var(--surface)] border border-[var(--border)]
                   flex items-center justify-center text-[var(--foreground)] hover:bg-[var(--secondary)]
                   transition-all duration-200 shadow-lg"
        >
          <Menu size={20} />
        </button>
        <main className={`transition-all duration-300 min-h-screen ${isCollapsed ? "md:ml-16" : "md:ml-64"}`}>
          {children}
        </main>
      </div>
    </SidebarContext.Provider>
  );
}

const filterItemsByRole = (items, userRole, userPermissions = []) => {
  return items.filter(item => {
    if (item.excludeRoles?.length > 0 && userRole && item.excludeRoles.includes(userRole)) return false;
    if (!item.roles || item.roles.length === 0) return true;
    if (!userRole) return false;
    return item.roles.some(r => r === userRole) || item.roles.some(r => userPermissions.includes(r));
  });
};

const ALL_SIDEBAR_SECTIONS = [
  {
    title: null,
    isCollapsible: false,
    items: [
      { id: "home",      label: "ホーム",   icon: <Home size={18} />,     href: "/home",    roles: ["view:vehicle"], excludeRoles: ["Sadmin"] },
      { id: "companies", label: "会社管理", icon: <Building2 size={18} />, href: "/company", roles: ["Sadmin"] },
    ],
  },
  {
    title: "業務",
    isCollapsible: true,
    items: [
      { id: "vehicle",          label: "在庫台帳",         icon: <Car size={18} />,           href: "/vehicle",         roles: ["view:vehicle"], excludeRoles: ["Sadmin"] },
      { id: "documents",        label: "受信書類",         icon: <FolderOpen size={18} />,    href: "/documents",       roles: ["view:vehicle"], excludeRoles: ["Sadmin"] },
      { id: "export-templates", label: "Excelテンプレート", icon: <FileSpreadsheet size={18} />, href: "/exportTemplates", roles: ["view:vehicle"], excludeRoles: ["Sadmin"] },
    ],
  },
  {
    title: "管理",
    isCollapsible: true,
    items: [
      { id: "user",     label: "ユーザー管理", icon: <Users size={18} />,  href: "/user",     roles: ["view:user"] },
      { id: "customer", label: "顧客管理",     icon: <Users size={18} />,  href: "/customer", roles: ["view:customer"], excludeRoles: ["Sadmin"] },
      { id: "role",     label: "ロール管理",   icon: <Shield size={18} />, href: "/role",     roles: ["view:role", "Sadmin"] },
    ],
  },
  {
    title: "AI・システム",
    isCollapsible: true,
    items: [
      { id: "ai-accuracy", label: "AI精度",    icon: <BarChart3 size={18} />,    href: "/accuracy",   roles: ["view:vehicle"], excludeRoles: ["Sadmin"] },
      { id: "evaluation",  label: "評価",       icon: <FlaskConical size={18} />, href: "/evaluation", roles: ["view:vehicle"], excludeRoles: ["Sadmin"] },
      { id: "prompts",     label: "プロンプト", icon: <Sparkles size={18} />,     href: "/prompts",    roles: ["view:vehicle"], excludeRoles: ["Sadmin"] },
    ],
  },
];

function SidebarContent({ isMobileMenuOpen, setIsMobileMenuOpen }) {
  const { isCollapsed, setIsCollapsed } = useSidebar();
  const router = useRouter();
  const { session } = useAuth();

  const [sectionStates, setSectionStates] = useState({});

  const toggleSection = useCallback((title) => {
    setSectionStates(prev => ({ ...prev, [title]: !prev[title] }));
  }, []);

  const sidebarSections = useMemo(
    () =>
      ALL_SIDEBAR_SECTIONS
        .map(section => ({
          ...section,
          items: filterItemsByRole(section.items, session?.role, session?.permissions),
        }))
        .filter(section => section.items.length > 0),
    [session?.role, session?.permissions]
  );

  const isActiveRoute = useCallback(
    href => router.pathname === href,
    [router.pathname]
  );

  return (
    <aside
      className={`
        fixed left-0 top-0 z-50 h-screen bg-[var(--sidebar-bg)] border-r border-[var(--border)]
        transition-all duration-300 ease-in-out flex flex-col
        ${isCollapsed ? "md:w-16" : "md:w-64"}
        ${isMobileMenuOpen ? "w-64 translate-x-0" : "w-64 -translate-x-full md:translate-x-0 md:w-16"}
      `}
      style={{ overflowX: isCollapsed ? "hidden" : undefined }}
    >
      {/* Header */}
      <div className="h-14 items-center justify-between px-3 border-b border-[var(--border)] hidden md:flex">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-8 h-8 rounded-lg hover:bg-[var(--border)]
                   flex items-center justify-center transition-all duration-200
                   text-[var(--secondary-foreground)] hover:text-[var(--foreground)]"
        >
          <Menu size={18} />
        </button>
      </div>

      {/* Mobile Header */}
      <div className="h-14 items-center justify-between px-3 border-b border-[var(--border)] flex md:hidden">
        <span className="text-sm font-semibold text-[var(--foreground)]">Menu</span>
        <button
          onClick={() => setIsMobileMenuOpen?.(false)}
          className="w-8 h-8 rounded-lg hover:bg-[var(--border)] flex items-center justify-center
                   text-[var(--secondary-foreground)] hover:text-[var(--foreground)] transition-all"
        >
          ×
        </button>
      </div>

      {/* User Profile */}
      <div className="p-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <div className="w-9 h-9 bg-[var(--primary)] rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-sm">
              {session?.name
                ? `${session.name.charAt(0).toUpperCase()}${session.name.charAt(session.name.length - 1).toUpperCase()}`
                : "U"}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[var(--success)] border-2 border-[var(--sidebar-bg)] rounded-full" />
          </div>
          <div className={`min-w-0 transition-all duration-300 ${isCollapsed ? "md:opacity-0 md:w-0 overflow-hidden" : "opacity-100"}`}>
            <p className="text-sm font-semibold text-[var(--foreground)] truncate leading-tight">
              {session?.name || session?.username || "User"}
            </p>
            <p className="text-xs text-[var(--muted-foreground)] truncate leading-tight">
              {session?.company || ""}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <SidebarNav
        sidebarSections={sidebarSections}
        isCollapsed={isCollapsed}
        isActiveRoute={isActiveRoute}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        sectionStates={sectionStates}
        toggleSection={toggleSection}
      />

      {/* Settings */}
      <SidebarSettings isCollapsed={isCollapsed} />
    </aside>
  );
}
