import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import ja from "./dictionaries/ja.json";
import en from "./dictionaries/en.json";
import { DEFAULT_LOCALE, isSupportedLocale, persistLocale, resolveLocaleClient } from "./resolveLocale";

const DICTIONARIES = { ja, en };

function lookup(dict, path) {
  if (!dict || typeof path !== "string") return undefined;
  const parts = path.split(".");
  let node = dict;
  for (const part of parts) {
    if (node && typeof node === "object" && part in node) {
      node = node[part];
    } else {
      return undefined;
    }
  }
  return typeof node === "string" ? node : undefined;
}

function interpolate(template, values) {
  if (!values || typeof template !== "string") return template;
  return template.replace(/\{(\w+)\}/g, (match, name) => {
    return Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match;
  });
}

export function translate(locale, key, values) {
  const primary = lookup(DICTIONARIES[locale], key);
  if (primary !== undefined) return interpolate(primary, values);
  const fallback = lookup(DICTIONARIES[DEFAULT_LOCALE], key);
  if (fallback !== undefined) return interpolate(fallback, values);
  return key;
}

const LocaleContext = createContext({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (key) => key,
});

export function LocaleProvider({ initialLocale, children }) {
  const safeInitial = isSupportedLocale(initialLocale) ? initialLocale : DEFAULT_LOCALE;
  const [locale, setLocaleState] = useState(safeInitial);

  useEffect(() => {
    const fromClient = resolveLocaleClient();
    if (fromClient !== locale) setLocaleState(fromClient);
    // run once on mount to reconcile SSR-resolved locale with client storage
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("lang", locale);
    }
  }, [locale]);

  const setLocale = useCallback((next) => {
    if (!isSupportedLocale(next)) return;
    persistLocale(next);
    setLocaleState(next);
  }, []);

  const t = useCallback((key, values) => translate(locale, key, values), [locale]);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}

export function useT() {
  return useContext(LocaleContext).t;
}
