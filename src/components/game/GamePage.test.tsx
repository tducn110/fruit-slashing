// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { GamePage } from "./GamePage";
import "../../i18n";

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("./FruitGame", () => ({
  FruitGame: ({ onRunStateChange, manualPaused, resumeRequired, hostPaused }: any) => {
    return (
      <div data-testid="fruit-game">
        <button
          data-testid="start-run-btn"
          type="button"
          onClick={() => onRunStateChange?.(true)}
        >
          Start Run
        </button>
        <span data-testid="paused-flag">
          {manualPaused || resumeRequired || hostPaused ? "PAUSED" : "RUNNING"}
        </span>
      </div>
    );
  },
}));

describe("GamePage pause and settingsPanel lifecycle", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("shows settingsPanel and enters pause when window loses focus during an active run", async () => {
    await act(async () => {
      root.render(
        <GamePage
          musicMuted={false}
          sfxMuted={false}
          hostPaused={false}
          onToggleMusic={vi.fn()}
          onToggleSfx={vi.fn()}
          onSaveScore={vi.fn()}
          onCompleteRound={vi.fn()}
          onHome={vi.fn()}
          onRefreshLeaderboard={vi.fn()}
          leaderboard={[]}
          bestScore={100}
        />,
      );
    });

    // Start active run
    const startBtn = container.querySelector('[data-testid="start-run-btn"]') as HTMLButtonElement;
    await act(async () => {
      startBtn.click();
    });

    expect(container.querySelector(".settingsPanel")).toBeNull();

    // Trigger blur (lost focus)
    await act(async () => {
      window.dispatchEvent(new Event("blur"));
    });

    // settingsPanel MUST be shown and gameplay must be paused
    expect(container.querySelector(".settingsPanel")).not.toBeNull();
    expect(container.querySelector('[data-testid="paused-flag"]')?.textContent).toBe("PAUSED");

    // Clicking close on settingsPanel should resume
    const closeBtn = container.querySelector('.settingsPanel button[aria-label="Close"]') as HTMLButtonElement;
    await act(async () => {
      closeBtn.click();
    });

    expect(container.querySelector(".settingsPanel")).toBeNull();
    expect(container.querySelector('[data-testid="paused-flag"]')?.textContent).toBe("RUNNING");
  });

  it("shows settingsPanel when hostPaused is true according to Wink contract", async () => {
    const renderComponent = (hostPaused: boolean) => (
      <GamePage
        musicMuted={false}
        sfxMuted={false}
        hostPaused={hostPaused}
        onToggleMusic={vi.fn()}
        onToggleSfx={vi.fn()}
        onSaveScore={vi.fn()}
        onCompleteRound={vi.fn()}
        onHome={vi.fn()}
        onRefreshLeaderboard={vi.fn()}
        leaderboard={[]}
        bestScore={100}
      />
    );

    await act(async () => {
      root.render(renderComponent(false));
    });

    expect(container.querySelector(".settingsPanel")).toBeNull();

    // Host sends pause (hostPaused becomes true)
    await act(async () => {
      root.render(renderComponent(true));
    });

    expect(container.querySelector(".settingsPanel")).not.toBeNull();
    expect(container.querySelector('[data-testid="paused-flag"]')?.textContent).toBe("PAUSED");

    // Host sends resume (hostPaused becomes false)
    await act(async () => {
      root.render(renderComponent(false));
    });

    expect(container.querySelector(".settingsPanel")).toBeNull();
    expect(container.querySelector('[data-testid="paused-flag"]')?.textContent).toBe("RUNNING");
  });

  it("shows settingsPanel when manual pause button is clicked", async () => {
    await act(async () => {
      root.render(
        <GamePage
          musicMuted={false}
          sfxMuted={false}
          hostPaused={false}
          onToggleMusic={vi.fn()}
          onToggleSfx={vi.fn()}
          onSaveScore={vi.fn()}
          onCompleteRound={vi.fn()}
          onHome={vi.fn()}
          onRefreshLeaderboard={vi.fn()}
          leaderboard={[]}
          bestScore={100}
        />,
      );
    });

    const pauseBtn = container.querySelector('button[aria-label="Pause"]') as HTMLButtonElement;
    await act(async () => {
      pauseBtn.click();
    });

    expect(container.querySelector(".settingsPanel")).not.toBeNull();
    expect(container.querySelector('[data-testid="paused-flag"]')?.textContent).toBe("PAUSED");
  });
});
