import { Languages } from "lucide-react";
import { useLocale } from "@/i18n/LocaleProvider";

export default function LanguageToggle({ isCollapsed }) {
  const { locale, setLocale, t } = useLocale();
  const next = locale === "ja" ? "en" : "ja";

  return (
    <button
      type="button"
      onClick={() => setLocale(next)}
      aria-label={t("language.toggleToOther")}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
        text-[var(--secondary-foreground)] hover:text-[var(--foreground)]
        hover:bg-[var(--border)]/40 transition-all duration-200"
    >
      <Languages size={18} />
      <span className={`text-sm transition-all duration-300 ${isCollapsed ? "md:opacity-0 md:w-0 overflow-hidden" : "opacity-100"}`}>
        {t("language.toggleToOther")}
      </span>
    </button>
  );
}
