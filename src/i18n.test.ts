// @vitest-environment jsdom

import { describe, expect, it, beforeEach } from "vitest";
import i18n, { LANGUAGE_STORAGE_KEY, getInitialLanguage } from "./i18n";

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
});
