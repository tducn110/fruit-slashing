// @vitest-environment jsdom

import { afterEach, expect, it, vi } from "vitest";
import { audioManager } from "./audio-manager";

class FakeGainNode {
  gain = { value: 1 };
  connect() {
    return this;
  }
  disconnect() {}
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  state: AudioContextState = "running";
  destination = {};
  gains: FakeGainNode[] = [];

  constructor() {
    FakeAudioContext.instances.push(this);
  }

  createGain() {
    const gain = new FakeGainNode();
    this.gains.push(gain);
    return gain;
  }

  async resume() {}
  async close() {}
}

afterEach(() => {
  audioManager.destroy();
  FakeAudioContext.instances = [];
  vi.restoreAllMocks();
});

it("layers parent mute without changing the user music/SFX preferences", async () => {
  Object.defineProperty(window, "AudioContext", {
    configurable: true,
    value: FakeAudioContext,
  });
  audioManager.setMusicMuted(false);
  audioManager.setSfxMuted(true);
  audioManager.setParentMuted(false);
  await audioManager.unlock();

  const context = FakeAudioContext.instances.at(-1)!;
  const [bgmGain, sfxGain] = context.gains;
  expect([bgmGain.gain.value, sfxGain.gain.value]).toEqual([1, 0]);

  audioManager.setParentMuted(true);
  expect(audioManager.parentMuted).toBe(true);
  expect(audioManager.musicMuted).toBe(false);
  expect(audioManager.sfxMuted).toBe(true);
  expect([bgmGain.gain.value, sfxGain.gain.value]).toEqual([0, 0]);

  audioManager.setParentMuted(false);
  expect(audioManager.parentMuted).toBe(false);
  expect(audioManager.musicMuted).toBe(false);
  expect(audioManager.sfxMuted).toBe(true);
  expect([bgmGain.gain.value, sfxGain.gain.value]).toEqual([1, 0]);
});
