import { signOut } from "next-auth/react";
import { useRouter } from "next/router";
import { Moon, Sun, LogOut } from "lucide-react";

export default function SidebarSettings({ theme, toggleTheme, isCollapsed }) {
  const router = useRouter();

  return (
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
        text-[var(--secondary-foreground)] hover:text-[var(--error)]
        hover:bg-[var(--secondary)] transition-all duration-200
      `}
      >
        <LogOut size={20} />
        <span className={`text-sm transition-all duration-300 ${isCollapsed ? "md:opacity-0 md:w-0" : "opacity-100"}`}>Logout</span>
      </button>
    </div>
  );
}
