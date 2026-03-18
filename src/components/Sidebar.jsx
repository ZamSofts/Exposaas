import { useState, useMemo, useCallback, createContext, useContext } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useRouter } from "next/router";
import {
  Home,
  Truck,
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

// Create context for sidebar state
const SidebarContext = createContext({
  isCollapsed: false,
  setIsCollapsed: () => {},
});

export const useSidebar = () => useContext(SidebarContext);

export default function Sidebar({ children }) {
  const { session, status } = useAuth();

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
        {/* Mobile overlay */}
        {isMobileMenuOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />}
        {/* Mobile menu button */}
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="fixed top-4 left-4 z-30 md:hidden w-10 h-10 rounded-lg bg-[var(--surface)] border border-[var(--border)]
                   flex items-center justify-center text-[var(--foreground)] hover:bg-[var(--secondary)]
                   transition-all duration-200 shadow-lg"
        >
          <Menu size={20} />
        </button>
        <main
          className={`
            transition-all duration-300 min-h-screen
            ${isCollapsed ? "md:ml-16" : "md:ml-72"}
          `}
        >
          {children}
        </main>
      </div>
    </SidebarContext.Provider>
  );
}

// Helper function to filter items based on user role and permissions
const filterItemsByRole = (items, userRole, userPermissions = []) => {
  return items.filter(item => {
    // Check if role is excluded
    if (item.excludeRoles && item.excludeRoles.length > 0 && userRole && item.excludeRoles.includes(userRole)) {
      return false;
    }

    // If no roles specified, show to everyone
    if (!item.roles || item.roles.length === 0) return true;
    if (!userRole) return false;

    // Custom: allow permission strings in roles array
    const hasRole = item.roles.some(r => r === userRole);
    const hasPermission = item.roles.some(r => userPermissions.includes(r));
    return hasRole || hasPermission;
  });
};

// Module-level constant — JSX icons created once, not on every render
const ALL_SIDEBAR_SECTIONS = [
  {
    title: "メインメニュー",
    items: [
      {
        id: "home",
        label: "ホーム",
        icon: <Home size={20} />,
        href: "/home",
        roles: ["view:vehicle"],
        excludeRoles: ["Sadmin"],
        color: "#60a5fa",
      },
      {
        id: "companies",
        label: "会社管理",
        icon: <Building2 size={20} />,
        href: "/company",
        roles: ["Sadmin"], // Only show to Sadmin
      },
      // {
      //   id: "shipping",
      //   label: "Shipping Channels",
      //   icon: <Truck size={20} />,
      //   href: "/shipping",
      // },
      {
        id: "user",
        label: "ユーザー管理",
        icon: <Users size={20} />,
        href: "/user",
        roles: ["view:user"],
      },
      {
        id: "customer",
        label: "顧客管理",
        icon: <Users size={20} />,
        href: "/customer",
        roles: ["view:customer"],
        excludeRoles: ["Sadmin"],
      },

      {
        id: "role",
        label: "ロール管理",
        icon: <Shield size={20} />,
        href: "/role",
        roles: ["view:role", "Sadmin"],
      },
      {
        id: "vehicle",
        label: "車両管理",
        icon: <Car size={20} />,
        href: "/vehicle",
        roles: ["view:vehicle"],
        excludeRoles: ["Sadmin"],
        color: "#fbbf24",
      },
      {
        id: "documents",
        label: "書類管理",
        icon: <FolderOpen size={20} />,
        href: "/documents",
        roles: ["view:vehicle"],
        excludeRoles: ["Sadmin"],
        color: "#34d399",
      },
      {
        id: "export-templates",
        label: "出力テンプレート",
        icon: <FileSpreadsheet size={20} />,
        href: "/exportTemplates",
        roles: ["view:vehicle"],
        excludeRoles: ["Sadmin"],
        color: "#a78bfa",
      },
      {
        id: "ai-accuracy",
        label: "AI精度",
        icon: <BarChart3 size={20} />,
        href: "/accuracy",
        roles: ["view:vehicle"],
        excludeRoles: ["Sadmin"],
        color: "#fb7185",
      },
      {
        id: "evaluation",
        label: "評価",
        icon: <FlaskConical size={20} />,
        href: "/evaluation",
        roles: ["view:vehicle"],
        excludeRoles: ["Sadmin"],
      },
      {
        id: "prompts",
        label: "プロンプト",
        icon: <Sparkles size={20} />,
        href: "/prompts",
        roles: ["view:vehicle"],
        excludeRoles: ["Sadmin"],
      },
    ],
  },
  // {
  //   title: "FEATURES",
  //   items: [
  //     {
  //       id: "messages",
  //       label: "Saved Messages",
  //       icon: <Bookmark size={20} />,
  //       href: "/messages",
  //     },
  //     {
  //       id: "contacts",
  //       label: "Contacts",
  //       icon: <Contact size={20} />,
  //       href: "/contacts",
  //     },
  //   ],
  // },
  // {
  //   title: "HELP",
  //   items: [
  //     {
  //       id: "features",
  //       label: "ExpoSaaS Features",
  //       icon: <Star size={20} />,
  //       href: "/features",
  //     },
  //     {
  //       id: "bug-report",
  //       label: "Report Bug",
  //       icon: <Bug size={20} />,
  //       href: "/bug-report",
  //     },
  //   ],
  // },
];

function SidebarContent({ isMobileMenuOpen, setIsMobileMenuOpen }) {
  const { isCollapsed, setIsCollapsed } = useSidebar();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const [dropdownStates, setDropdownStates] = useState({});

  // Toggle dropdown state
  const toggleDropdown = itemId => {
    setDropdownStates(prev => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  // Memoize: only recompute when role/permissions change
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
      fixed left-0 top-0 z-50 h-screen bg-[var(--surface)] border-r border-[var(--border)] 
      transition-all duration-300 ease-in-out flex flex-col
      ${
        // Desktop: responsive width based on collapse state
        isCollapsed ? "md:w-16" : "md:w-72"
      }
      ${
        // Mobile: show/hide with overlay, full width when open
        isMobileMenuOpen ? "w-72 translate-x-0 md:translate-x-0" : "w-72 -translate-x-full md:translate-x-0 md:w-16"
      }
    `}
    >
      {/* Header - only show on desktop */}
      <div className="h-16 items-center justify-between px-4 border-b border-[var(--border)] hidden md:flex">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-8 h-8 rounded-lg bg-[var(--secondary)] hover:bg-[var(--border)] 
                   flex items-center justify-center transition-all duration-200 
                   text-[var(--secondary-foreground)] hover:text-[var(--foreground)]"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Mobile Header */}
      <div className="h-16 items-center justify-between px-4 border-b border-[var(--border)] flex md:hidden">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Menu</h2>
        <button
          onClick={() => setIsMobileMenuOpen?.(false)}
          className="w-8 h-8 rounded-lg bg-[var(--secondary)] hover:bg-[var(--border)] 
                   flex items-center justify-center transition-all duration-200 
                   text-[var(--secondary-foreground)] hover:text-[var(--foreground)]"
        >
          ×
        </button>
      </div>

      {/* User Profile */}
      <div className="p-4 border-b border-[var(--border)]">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="w-12 h-12 bg-gradient-to-br from-[var(--primary)] to-[var(--primary)]/80 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-lg">
              {session?.name ? `${session.name.charAt(0).toUpperCase()}${session.name.charAt(session.name.length - 1).toUpperCase()}` : "U"}
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[var(--success)] border-2 border-[var(--surface)] rounded-full"></div>
          </div>
          <div className={`flex-1 min-w-0 transition-all duration-300 ${isCollapsed ? "md:opacity-0 md:w-0" : "opacity-100"}`}>
            <p className="text-sm font-semibold text-[var(--foreground)] truncate">{session?.name || session?.username || "User"}</p>
            <p className="text-xs text-[var(--muted-foreground)] truncate">{session?.company || ""}</p>
          </div>
        </div>
        
      </div>

      {/* Navigation */}
      <SidebarNav
        sidebarSections={sidebarSections}
        isCollapsed={isCollapsed}
        dropdownStates={dropdownStates}
        toggleDropdown={toggleDropdown}
        setDropdownStates={setDropdownStates}
        isActiveRoute={isActiveRoute}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        session={session}
      />

      {/* Settings */}
      <SidebarSettings theme={theme} toggleTheme={toggleTheme} isCollapsed={isCollapsed} />
    </aside>
  );
}
