// @vitest-environment jsdom

import { describe, expect, it, beforeEach } from "vitest";
import i18n, {
  LANGUAGE_STORAGE_KEY,
  getInitialLanguage,
  hasStoredLanguagePreference,
  applyHostLocale,
} from "./i18n";

describe("i18n configuration and persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("has translations for both 'en' and 'vi'", () => {
    expect(i18n.getResourceBundle("en", "translation")).toBeDefined();
    expect(i18n.getResourceBundle("vi", "translation")).toBeDefined();
    expect(i18n.t("game.play_now", { lng: "en" })).toBe("Play Now");
    expect(i18n.t("game.play_now", { lng: "vi" })).toBe("Chơi ngay");
  });

  it("persists language change to localStorage when changed", async () => {
    await i18n.changeLanguage("vi");
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("vi");
    expect(i18n.t("game.score")).toBe("Điểm số");

    await i18n.changeLanguage("en");
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("en");
    expect(i18n.t("game.score")).toBe("Score");
  });

  it("migrates from legacy storage key if present", () => {
    window.localStorage.setItem("fruit-slashing-language", "vi");
    expect(getInitialLanguage()).toBe("vi");
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("vi");
  });

  it("defaults to English ('en') on fresh storage (first fallback is English)", () => {
    expect(getInitialLanguage()).toBe("en");
    expect(hasStoredLanguagePreference()).toBe(false);
  });

  it("falls back to 'en' when storage contains invalid language", () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, "invalid-locale");
    expect(getInitialLanguage()).toBe("en");
    expect(hasStoredLanguagePreference()).toBe(false);
  });

  it("hasStoredLanguagePreference returns true only after valid preference is saved", async () => {
    expect(hasStoredLanguagePreference()).toBe(false);
    await i18n.changeLanguage("vi");
    expect(hasStoredLanguagePreference()).toBe(true);
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("vi");
  });

  it("applyHostLocale does NOT overwrite localStorage or player preference", async () => {
    // 1. When player already has preference 'en'
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, "en");
    await i18n.changeLanguage("en");
    expect(hasStoredLanguagePreference()).toBe(true);

    // Host sends 'vi' -> must NOT override user choice
    const result = applyHostLocale("vi");
    expect(result).toBe("en");
    expect(i18n.resolvedLanguage).toBe("en");
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("en");

    // 2. When player has NO preference
    window.localStorage.clear();
    expect(hasStoredLanguagePreference()).toBe(false);

    // Host sends 'vi' -> sets language in memory without polluting localStorage
    const freshResult = applyHostLocale("vi");
    expect(freshResult).toBe("vi");
    expect(i18n.resolvedLanguage).toBe("vi");
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBeNull();
    expect(hasStoredLanguagePreference()).toBe(false);
  });

  it("has close key in both locales", () => {
    expect(i18n.t("game.close", { lng: "en" })).toBe("Close");
    expect(i18n.t("game.close", { lng: "vi" })).toBe("Đóng");
  });
});
