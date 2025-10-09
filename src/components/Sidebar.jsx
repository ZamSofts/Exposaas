import { signOut } from "next-auth/react";
import { useState, createContext, useContext } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  LayoutDashboard,
  Truck,
  MessageCircle,
  Users,
  Bookmark,
  Contact,
  Star,
  Bug,
  Moon,
  Sun,
  LogOut,
  Menu,
  Building2,
  Shield,
  Car,
  ChevronDown,
  ChevronRight,
  Settings,
  CheckCircle,
} from "lucide-react";

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

  return (
    <SidebarContext.Provider value={{ isCollapsed, setIsCollapsed }}>
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

// Define all sidebar items with their role requirements
const getAllSidebarSections = () => [
  {
    title: "MAIN NAVIGATION",
    items: [
      {
        id: "dashboard",
        label: "Dashboard",
        icon: <LayoutDashboard size={20} />,
        href: "/dashboard",
        excludeRoles: ["Customer"], // Hide from customer
      },
      {
        id: "companies",
        label: "Manage Companies",
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
        id: "chat",
        label: "General Chat",
        icon: <MessageCircle size={20} />,
        href: "/chat",
        excludeRoles: ["Sadmin", "Customer"], // Hide from Sadmin and customer
      },
      {
        id: "user",
        label: "User Management",
        icon: <Users size={20} />,
        href: "/user",
        roles: ["view:user"],
      },
      {
        id: "customer",
        label: "Customer Management",
        icon: <Users size={20} />,
        href: "/customer",
        roles: ["view:customer"],
        excludeRoles: ["Sadmin"],
      },

      {
        id: "role",
        label: "Role Management",
        icon: <Shield size={20} />,
        href: "/role",
        roles: ["view:role", "Sadmin"],
      },
      {
        id: "vehicle",
        label: "Vehicle Management",
        icon: <Car size={20} />,
        href: "/vehicle",
        roles: ["view:vehicle"],
        excludeRoles: ["Sadmin"],
      },
      {
        id: "payment-confirmation",
        label: "Payment Confirmation",
        icon: <CheckCircle size={20} />,
        href: "/payment-confirmation",
        roles: ["view:vehicle"],
        excludeRoles: ["Sadmin"],
      },
      {
        id: "extras",
        label: "Extras",
        icon: <Settings size={20} />,
        isDropdown: true,
        roles: ["Sadmin"],
        subItems: [
          {
            id: "manage-status",
            label: "Manage Status",
            href: "/status",
            icon: <CheckCircle size={16} />,
            roles: ["Admin", "Sadmin"],
          },
        ],
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

  // Get filtered sidebar sections based on user role and permissions
  const sidebarSections = getAllSidebarSections()
    .map(section => ({
      ...section,
      items: filterItemsByRole(section.items, session?.role, session?.permissions),
    }))
    .filter(section => section.items.length > 0); // Remove empty sections

  const isActiveRoute = href => {
    return router.pathname === href;
  };

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
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden py-4"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "var(--border) transparent",
        }}
      >
        <style jsx>{`
          div::-webkit-scrollbar {
            width: 6px;
          }
          div::-webkit-scrollbar-track {
            background: transparent;
          }
          div::-webkit-scrollbar-thumb {
            background-color: var(--border);
            border-radius: 3px;
          }
          div::-webkit-scrollbar-thumb:hover {
            background-color: var(--muted-foreground);
          }
        `}</style>
        {sidebarSections.map((section, sectionIndex) => (
          <div key={section.title} className="mb-6">
            <div className={`px-4 mb-2 transition-all duration-300 ${isCollapsed ? "md:opacity-0 md:h-0" : "opacity-100 h-auto"}`}>
              <h3 className="text-xs font-medium text-[var(--secondary-foreground)] uppercase tracking-wider">{section.title}</h3>
            </div>

            <nav className="space-y-1 px-2">
              {section.items.map(item => {
                const isActive = isActiveRoute(item.href);
                const isDropdownOpen = dropdownStates[item.id];

                // If it's a dropdown item
                if (item.isDropdown && item.subItems) {
                  return (
                    <div key={item.id} className="space-y-1">
                      {/* Dropdown trigger */}
                      <button
                        onClick={() => toggleDropdown(item.id)}
                        className={`
                          group w-full flex items-center px-3 py-2.5 rounded-lg transition-all duration-200
                          text-[var(--secondary-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--secondary)]
                        `}
                      >
                        <div className="flex-shrink-0 w-5 h-5 transition-transform duration-200 group-hover:scale-110">{item.icon}</div>

                        <span
                          className={`
                            ml-3 text-sm font-medium transition-all duration-300
                            ${isCollapsed ? "md:opacity-0 md:w-0" : "opacity-100"}
                          `}
                        >
                          {item.label}
                        </span>

                        {/* Dropdown arrow */}
                        <div
                          className={`
                            ml-auto transition-all duration-300
                            ${isCollapsed ? "md:opacity-0 md:w-0" : "opacity-100"}
                          `}
                        >
                          {isDropdownOpen ? <ChevronDown size={16} className="transition-transform duration-200" /> : <ChevronRight size={16} className="transition-transform duration-200" />}
                        </div>
                      </button>

                      {/* Dropdown content */}
                      <div
                        className={`
                          overflow-hidden transition-all duration-300 ease-in-out
                          ${isDropdownOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"}
                          ${isCollapsed ? "md:hidden" : ""}
                        `}
                      >
                        <div className="ml-8 space-y-1 py-1">
                          {item.subItems
                            .filter(subItem => {
                              // Check if role is excluded
                              if (subItem.excludeRoles && subItem.excludeRoles.length > 0 && session?.role && subItem.excludeRoles.includes(session.role)) {
                                return false;
                              }

                              // Filter sub-items by role
                              if (!subItem.roles || subItem.roles.length === 0) return true;
                              if (!session?.role) return false;
                              return subItem.roles.includes(session.role);
                            })
                            .map(subItem => {
                              const isSubActive = isActiveRoute(subItem.href);
                              return (
                                <Link
                                  key={subItem.id}
                                  href={subItem.href}
                                  onClick={() => {
                                    setIsMobileMenuOpen?.(false);
                                    // Close the dropdown when clicking on a sub-item
                                    setDropdownStates(prev => ({
                                      ...prev,
                                      [item.id]: false,
                                    }));
                                  }}
                                  className={`
                                    flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-200 relative
                                    ${
                                      isSubActive
                                        ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-lg"
                                        : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--secondary)]"
                                    }
                                  `}
                                >
                                  {subItem.icon && <div className="flex-shrink-0">{subItem.icon}</div>}
                                  <span>{subItem.label}</span>
                                  {isSubActive && <div className="absolute -left-2 top-2 w-1 h-6 bg-white rounded-r-full"></div>}
                                </Link>
                              );
                            })}
                        </div>
                      </div>
                    </div>
                  );
                }

                // Regular menu item
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => {
                      // Close mobile menu when link is clicked
                      setIsMobileMenuOpen?.(false);
                    }}
                    className={`
                      group flex items-center px-3 py-2.5 rounded-lg transition-all duration-200
                      ${isActive ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-lg" : "text-[var(--secondary-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--secondary)]"}
                    `}
                  >
                    <div
                      className={`
                      flex-shrink-0 w-5 h-5 transition-transform duration-200
                      ${isActive ? "text-white" : "group-hover:scale-110"}
                    `}
                    >
                      {item.icon}
                    </div>

                    <span
                      className={`
                      ml-3 text-sm font-medium transition-all duration-300
                      ${isCollapsed ? "md:opacity-0 md:w-0" : "opacity-100"}
                    `}
                    >
                      {item.label}
                    </span>

                    {/* Active indicator */}
                    {isActive && <div className="absolute left-0 w-1 h-6 bg-white rounded-r-full"></div>}
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      {/* Settings */}
      <div className="border-t border-[var(--border)] p-4">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className={`
            w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg 
            text-[var(--secondary-foreground)] hover:text-[var(--foreground)] 
            hover:bg-[var(--secondary)] transition-all duration-200
            group
          `}
        >
          <div className="relative w-5 h-5">
            {theme === "dark" ? (
              <Sun size={20} className="group-hover:scale-110 transition-transform duration-200" />
            ) : (
              <Moon size={20} className="group-hover:scale-110 transition-transform duration-200" />
            )}
          </div>
          <span className={`text-sm transition-all duration-300 ${isCollapsed ? "md:opacity-0 md:w-0" : "opacity-100"}`}>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
        </button>

        {/* Logout */}
        <button
          onClick={async () => {
            await signOut({ redirect: false });
            router.push("/");
          }}
          className={`
          w-full mt-2 flex items-center space-x-3 px-3 py-2.5 rounded-lg 
          text-[var(--secondary-foreground] hover:text-[var(--error)] 
          hover:bg-[var(--secondary)] transition-all duration-200
        `}
        >
          <LogOut size={20} />
          <span className={`text-sm transition-all duration-300 ${isCollapsed ? "md:opacity-0 md:w-0" : "opacity-100"}`}>Logout</span>
        </button>
      </div>
    </aside>
  );
}
