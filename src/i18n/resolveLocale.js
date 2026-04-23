export const LOCALES = ["ja", "en"];
export const DEFAULT_LOCALE = "ja";
export const COOKIE_NAME = "NEXT_LOCALE";
export const STORAGE_KEY = "NEXT_LOCALE";

export function isSupportedLocale(value) {
  return typeof value === "string" && LOCALES.includes(value);
}

export function parseCookieHeader(cookieHeader) {
  if (!cookieHeader || typeof cookieHeader !== "string") return null;
  const match = cookieHeader.match(/(?:^|;\s*)NEXT_LOCALE=([^;]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export function resolveLocaleFromCookieHeader(cookieHeader) {
  const raw = parseCookieHeader(cookieHeader);
  return isSupportedLocale(raw) ? raw : DEFAULT_LOCALE;
}

export function resolveLocaleClient() {
  if (typeof document !== "undefined") {
    const fromCookie = parseCookieHeader(document.cookie);
    if (isSupportedLocale(fromCookie)) return fromCookie;
  }
  if (typeof window !== "undefined") {
    try {
      const fromStorage = window.localStorage.getItem(STORAGE_KEY);
      if (isSupportedLocale(fromStorage)) return fromStorage;
    } catch {
      // localStorage unavailable (private mode, SSR, etc.)
    }
  }
  return DEFAULT_LOCALE;
}

export function persistLocale(locale) {
  if (!isSupportedLocale(locale)) return;
  if (typeof document !== "undefined") {
    const maxAge = 60 * 60 * 24 * 365;
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(locale)}; path=/; max-age=${maxAge}; samesite=lax`;
  }
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // ignore
    }
  }
}
