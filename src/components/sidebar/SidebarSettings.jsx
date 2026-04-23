import { signOut } from "next-auth/react";
import { useRouter } from "next/router";
import { LogOut } from "lucide-react";
import { useT } from "@/i18n/LocaleProvider";
import LanguageToggle from "./LanguageToggle";

export default function SidebarSettings({ isCollapsed }) {
  const router = useRouter();
  const t = useT();

  return (
    <div className="border-t border-[var(--border)] p-3 space-y-1">
      <LanguageToggle isCollapsed={isCollapsed} />
      <button
        onClick={async () => {
          await signOut({ redirect: false });
          router.push("/");
        }}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
          text-[var(--secondary-foreground)] hover:text-[var(--error)]
          hover:bg-[var(--error)]/10 transition-all duration-200"
      >
        <LogOut size={18} />
        <span className={`text-sm transition-all duration-300 ${isCollapsed ? "md:opacity-0 md:w-0 overflow-hidden" : "opacity-100"}`}>
          {t("sidebar.logout")}
        </span>
      </button>
    </div>
  );
}
