// @vitest-environment jsdom

import { describe, expect, it, beforeEach } from "vitest";
import i18n from "./i18n";

describe("i18n configuration and persistence", () => {
  const STORAGE_KEY = "fruit-slashing-language";

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
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("vi");
    expect(i18n.t("game.score")).toBe("Điểm số");

    await i18n.changeLanguage("en");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("en");
    expect(i18n.t("game.score")).toBe("Score");
  });
});
