import React from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";

function SidebarNav({
  sidebarSections,
  isCollapsed,
  dropdownStates,
  toggleDropdown,
  setDropdownStates,
  isActiveRoute,
  setIsMobileMenuOpen,
  session,
}) {
  return (
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
      {sidebarSections.map((section) => (
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

              // Regular menu item — only compute activeBg when this item is actually active
              const activeColor = item.color || null;
              const activeBg = isActive
                ? activeColor
                  ? `rgba(${parseInt(activeColor.slice(1,3),16)},${parseInt(activeColor.slice(3,5),16)},${parseInt(activeColor.slice(5,7),16)},0.12)`
                  : "rgba(59,130,246,0.12)"
                : undefined;
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
                    ${isActive ? "shadow-sm" : "text-[var(--secondary-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--secondary)]"}
                  `}
                  style={isActive ? {
                    backgroundColor: activeBg,
                    color: "var(--foreground)",
                    borderLeft: `3px solid ${activeColor || "var(--primary)"}`,
                  } : {}}
                >
                  <div
                    className={`
                    flex-shrink-0 w-5 h-5 transition-transform duration-200
                    ${isActive ? "" : "group-hover:scale-110"}
                  `}
                  >
                    {item.icon}
                  </div>

                  <span
                    className={`
                    ml-3 text-sm transition-all duration-300
                    ${isActive ? "font-semibold" : "font-medium"}
                    ${isCollapsed ? "md:opacity-0 md:w-0" : "opacity-100"}
                  `}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>
      ))}
    </div>
  );
}

export default React.memo(SidebarNav);
