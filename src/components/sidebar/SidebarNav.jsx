import React from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

function SidebarNav({
  sidebarSections,
  isCollapsed,
  isActiveRoute,
  setIsMobileMenuOpen,
  sectionStates,
  toggleSection,
}) {
  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden py-2 scrollbar-thin">
      {sidebarSections.map((section) => {
        const isSectionCollapsed = section.isCollapsible && sectionStates[section.title];

        return (
          <div key={section.title ?? "__top__"} className="mb-1">
            {/* Section header */}
            {section.title && (
              <button
                onClick={section.isCollapsible ? () => toggleSection(section.title) : undefined}
                className={`
                  w-full flex items-center justify-between px-4 py-1.5 mb-0.5
                  transition-all duration-200
                  ${isCollapsed ? "md:opacity-0 md:pointer-events-none" : "opacity-100"}
                  ${section.isCollapsible ? "cursor-pointer hover:text-[var(--foreground)]" : "cursor-default"}
                `}
              >
                <span className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                  {section.title}
                </span>
                {section.isCollapsible && (
                  <ChevronDown
                    size={13}
                    className={`text-[var(--muted-foreground)] transition-transform duration-200 ${isSectionCollapsed ? "-rotate-90" : ""}`}
                  />
                )}
              </button>
            )}

            {/* Section items */}
            <div
              className={`overflow-hidden transition-all duration-200 ${
                isSectionCollapsed ? "max-h-0 opacity-0" : "max-h-[500px] opacity-100"
              }`}
            >
              <nav className="px-2 space-y-0.5">
                {section.items.map(item => {
                  const isActive = isActiveRoute(item.href);
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen?.(false)}
                      className={`
                        group flex items-center gap-3 px-3 py-2 text-sm transition-all duration-150
                        ${isActive
                          ? "sidebar-active-item font-semibold text-[var(--foreground)]"
                          : "rounded-lg text-[var(--secondary-foreground)] hover:text-[var(--foreground)] hover:bg-white/70"
                        }
                      `}
                    >
                      <span className={`shrink-0 ${isActive ? "text-[var(--primary)]" : "text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]"}`}>
                        {item.icon}
                      </span>
                      <span className={`transition-all duration-300 truncate ${isCollapsed ? "md:opacity-0 md:w-0 overflow-hidden" : "opacity-100"}`}>
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default React.memo(SidebarNav);
