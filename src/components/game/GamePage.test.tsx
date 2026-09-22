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
  FruitGame: ({ onRunStateChange, manualPaused, resumeRequired, hostPaused, onResumePause }: any) => {
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
        <button
          data-testid="resume-btn"
          type="button"
          onClick={onResumePause}
        >
          Resume
        </button>
      </div>
    );
  },
}));

describe("GamePage pause lifecycle without settingsPanel", () => {
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

  it("enters pause when window loses focus during an active run and resumes via resume button", async () => {
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
    expect(container.querySelector('[data-testid="paused-flag"]')?.textContent).toBe("RUNNING");

    // Trigger blur (lost focus)
    await act(async () => {
      window.dispatchEvent(new Event("blur"));
    });

    // Gameplay must be paused and settingsPanel must NOT be rendered
    expect(container.querySelector(".settingsPanel")).toBeNull();
    expect(container.querySelector('[data-testid="paused-flag"]')?.textContent).toBe("PAUSED");

    // Clicking resume should resume
    const resumeBtn = container.querySelector('[data-testid="resume-btn"]') as HTMLButtonElement;
    await act(async () => {
      resumeBtn.click();
    });

    expect(container.querySelector(".settingsPanel")).toBeNull();
    expect(container.querySelector('[data-testid="paused-flag"]')?.textContent).toBe("RUNNING");
  });

  it("enters pause when hostPaused is true according to Wink contract and resumes when host unpauses", async () => {
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
    expect(container.querySelector('[data-testid="paused-flag"]')?.textContent).toBe("RUNNING");

    // Host sends pause (hostPaused becomes true)
    await act(async () => {
      root.render(renderComponent(true));
    });

    expect(container.querySelector(".settingsPanel")).toBeNull();
    expect(container.querySelector('[data-testid="paused-flag"]')?.textContent).toBe("PAUSED");

    // Host sends resume (hostPaused becomes false)
    await act(async () => {
      root.render(renderComponent(false));
    });

    expect(container.querySelector(".settingsPanel")).toBeNull();
    expect(container.querySelector('[data-testid="paused-flag"]')?.textContent).toBe("RUNNING");
  });

  it("enters pause when manual pause button is clicked and does not show settings button or settingsPanel", async () => {
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

    // Settings button should not exist in the top bar
    expect(container.querySelector('button[aria-label="Settings"]')).toBeNull();

    const pauseBtn = container.querySelector('button[aria-label="Pause"]') as HTMLButtonElement;
    await act(async () => {
      pauseBtn.click();
    });

    expect(container.querySelector(".settingsPanel")).toBeNull();
    expect(container.querySelector('[data-testid="paused-flag"]')?.textContent).toBe("PAUSED");

    // Resume
    const resumeBtn = container.querySelector('[data-testid="resume-btn"]') as HTMLButtonElement;
    await act(async () => {
      resumeBtn.click();
    });
    expect(container.querySelector('[data-testid="paused-flag"]')?.textContent).toBe("RUNNING");
  });
});
