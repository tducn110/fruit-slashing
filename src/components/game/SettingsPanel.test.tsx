import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SettingsPanel } from "./SettingsPanel";
import "../../i18n";

describe("SettingsPanel", () => {
  it("renders Off label when music and sfx are muted", () => {
    const markup = renderToStaticMarkup(
      <SettingsPanel
        musicMuted={true}
        sfxMuted={true}
        onToggleMusic={vi.fn()}
        onToggleSfx={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    // Language button has is-on, but music and sfx toggles should have class "is-off"
    expect(markup).toContain('aria-label="Unmute background music" class="game-btn settingsToggle is-off"');
    expect(markup).toContain('aria-label="Unmute sound effects" class="game-btn settingsToggle is-off"');

    // In English or Vietnamese, muted should show Off / Tắt
    expect(markup).toMatch(/(>Off<|>Tắt<)/);
  });

  it("renders On label when music and sfx are active (not muted)", () => {
    const markup = renderToStaticMarkup(
      <SettingsPanel
        musicMuted={false}
        sfxMuted={false}
        onToggleMusic={vi.fn()}
        onToggleSfx={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    // Both audio toggles should have class "is-on"
    expect(markup).toContain('aria-label="Mute background music" class="game-btn settingsToggle is-on"');
    expect(markup).toContain('aria-label="Mute sound effects" class="game-btn settingsToggle is-on"');

    // Active should show On / Bật
    expect(markup).toMatch(/(>On<|>Bật<)/);
  });
});
