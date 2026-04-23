import { describe, it, expect } from "vitest";
import { translate } from "@/i18n/LocaleProvider";
import {
  parseCookieHeader,
  resolveLocaleFromCookieHeader,
  isSupportedLocale,
  DEFAULT_LOCALE,
} from "@/i18n/resolveLocale";

describe("resolveLocale", () => {
  it("parses NEXT_LOCALE cookie", () => {
    expect(parseCookieHeader("NEXT_LOCALE=en")).toBe("en");
    expect(parseCookieHeader("foo=bar; NEXT_LOCALE=ja; baz=1")).toBe("ja");
  });

  it("returns null when NEXT_LOCALE is absent", () => {
    expect(parseCookieHeader("")).toBeNull();
    expect(parseCookieHeader("foo=bar")).toBeNull();
    expect(parseCookieHeader(undefined)).toBeNull();
  });

  it("resolves supported locale from cookie header", () => {
    expect(resolveLocaleFromCookieHeader("NEXT_LOCALE=en")).toBe("en");
    expect(resolveLocaleFromCookieHeader("NEXT_LOCALE=ja")).toBe("ja");
  });

  it("falls back to default when cookie value is unsupported", () => {
    expect(resolveLocaleFromCookieHeader("NEXT_LOCALE=fr")).toBe(DEFAULT_LOCALE);
    expect(resolveLocaleFromCookieHeader("")).toBe(DEFAULT_LOCALE);
  });

  it("validates supported locales", () => {
    expect(isSupportedLocale("ja")).toBe(true);
    expect(isSupportedLocale("en")).toBe(true);
    expect(isSupportedLocale("fr")).toBe(false);
    expect(isSupportedLocale(null)).toBe(false);
    expect(isSupportedLocale(123)).toBe(false);
  });
});

describe("translate", () => {
  it("looks up nested keys in the active dictionary", () => {
    expect(translate("ja", "sidebar.items.home")).toBe("ホーム");
    expect(translate("en", "sidebar.items.home")).toBe("Home");
  });

  it("interpolates {placeholder} tokens", () => {
    const result = translate("en", "home.greetingWithName", { greeting: "Good morning", name: "Alice" });
    expect(result).toBe("Good morning, Alice");
  });

  it("leaves untouched tokens when values missing", () => {
    const result = translate("en", "home.greetingWithName", { greeting: "Hi" });
    expect(result).toContain("{name}");
  });

  it("falls back to default locale when key missing in active locale", () => {
    const result = translate("en", "nonexistent.key");
    expect(result).toBe("nonexistent.key");
  });

  it("returns the key itself when absent from both dictionaries", () => {
    expect(translate("ja", "does.not.exist.at.all")).toBe("does.not.exist.at.all");
  });

  it("handles unknown locale by falling back to default dictionary", () => {
    expect(translate("fr", "sidebar.items.home")).toBe("ホーム");
  });
});
