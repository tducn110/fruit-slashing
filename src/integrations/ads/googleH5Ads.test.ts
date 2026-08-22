// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type AdCallbacks = {
  beforeAd?: () => void;
  afterAd?: () => void;
  beforeReward?: (showAd: () => void) => void;
  adViewed?: () => void;
  adDismissed?: () => void;
  adBreakDone?: () => void;
};

async function loadAdapter() {
  vi.resetModules();
  return import("./googleH5Ads");
}

function installLoadedSdk(adBreak: (options: AdCallbacks) => void): void {
  const script = document.createElement("script");
  script.dataset.winkAds = "google-h5-game-ads";
  script.dataset.loaded = "true";
  document.head.appendChild(script);
  window.adBreak = adBreak;
  window.adConfig = vi.fn();
}

describe("Google H5 Ads shared adapter", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    document.head.innerHTML = "";
    delete window.adBreak;
    delete window.adConfig;
    delete window.adsbygoogle;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("grants a rewarded result only after adViewed", async () => {
    installLoadedSdk((options) => {
      options.beforeAd?.();
      options.beforeReward?.(() => undefined);
      options.adViewed?.();
      options.afterAd?.();
      options.adBreakDone?.();
    });
    const beforeAd = vi.fn();
    const afterAd = vi.fn();
    const { showRewardedVideo } = await loadAdapter();

    await expect(
      showRewardedVideo({ name: "reward_contract", beforeAd, afterAd }),
    ).resolves.toBe(true);
    expect(beforeAd).toHaveBeenCalledTimes(1);
    expect(afterAd).toHaveBeenCalledTimes(1);
  });

  it("fails closed when a viewed ad is subsequently dismissed", async () => {
    installLoadedSdk((options) => {
      options.beforeAd?.();
      options.adViewed?.();
      options.adDismissed?.();
      options.afterAd?.();
      options.adBreakDone?.();
    });
    const reward = vi.fn();
    const { showRewardedVideo } = await loadAdapter();

    if (await showRewardedVideo({ name: "dismiss_contract" })) reward();
    expect(reward).not.toHaveBeenCalled();
  });

  it("restores lifecycle exactly once when callbacks are duplicated", async () => {
    installLoadedSdk((options) => {
      options.beforeAd?.();
      options.beforeAd?.();
      options.afterAd?.();
      options.afterAd?.();
      options.adBreakDone?.();
      options.adBreakDone?.();
    });
    const beforeAd = vi.fn();
    const afterAd = vi.fn();
    const { showRewardedVideo } = await loadAdapter();

    await expect(
      showRewardedVideo({ name: "lifecycle_contract", beforeAd, afterAd }),
    ).resolves.toBe(false);
    expect(beforeAd).toHaveBeenCalledTimes(1);
    expect(afterAd).toHaveBeenCalledTimes(1);
  });

  it("continues an interstitial transition without granting a reward", async () => {
    installLoadedSdk((options) => {
      options.beforeAd?.();
      options.afterAd?.();
      options.adBreakDone?.();
    });
    const beforeAd = vi.fn();
    const afterAd = vi.fn();
    const { showInterstitial } = await loadAdapter();

    await expect(
      showInterstitial({ name: "transition_contract", beforeAd, afterAd }),
    ).resolves.toBeUndefined();
    expect(beforeAd).toHaveBeenCalledTimes(1);
    expect(afterAd).toHaveBeenCalledTimes(1);
  });
});
