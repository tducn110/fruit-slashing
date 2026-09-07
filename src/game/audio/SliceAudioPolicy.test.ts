import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  SliceAudioPolicy,
  DEFAULT_SLICE_AUDIO_CONFIG,
  type SliceAudioSink,
} from "./SliceAudioPolicy";
import type {
  BurstStartedEvent,
  BurstExtendedEvent,
  BombHitEvent,
  BurstEndedEvent,
} from "../events/SliceBurstAggregator";

describe("SliceAudioPolicy", () => {
  let sink: SliceAudioSink;
  let policy: SliceAudioPolicy;

  beforeEach(() => {
    sink = {
      playSfx: vi.fn(),
      getActiveVoiceCount: vi.fn().mockReturnValue(1),
    };
    policy = new SliceAudioPolicy(sink, DEFAULT_SLICE_AUDIO_CONFIG);
  });

  it("CASE A: BURST_STARTED count=1 -> slice once with base pitch", () => {
    const event: BurstStartedEvent = {
      type: "BURST_STARTED",
      burstId: 1,
      timeMs: 0,
      count: 1,
      fruits: [{ id: 1, kind: "mango" }],
    };

    policy.handleEvents([event]);

    expect(sink.playSfx).toHaveBeenCalledTimes(1);
    expect(sink.playSfx).toHaveBeenCalledWith("slice", {
      volume: DEFAULT_SLICE_AUDIO_CONFIG.baseVolume,
      playbackRate: DEFAULT_SLICE_AUDIO_CONFIG.basePitch,
      maxVoices: DEFAULT_SLICE_AUDIO_CONFIG.baseMaxVoices,
    });
  });

  it("CASE B: BURST_STARTED count=2 -> combo slice once with combo pitch", () => {
    const event: BurstStartedEvent = {
      type: "BURST_STARTED",
      burstId: 1,
      timeMs: 0,
      count: 2,
      fruits: [
        { id: 1, kind: "mango" },
        { id: 2, kind: "banana" },
      ],
    };

    policy.handleEvents([event]);

    expect(sink.playSfx).toHaveBeenCalledTimes(1);
    expect(sink.playSfx).toHaveBeenCalledWith("slice", {
      volume: DEFAULT_SLICE_AUDIO_CONFIG.combo2Volume,
      playbackRate: DEFAULT_SLICE_AUDIO_CONFIG.combo2Pitch,
      maxVoices: DEFAULT_SLICE_AUDIO_CONFIG.baseMaxVoices,
    });
  });

  it("CASE C: [BURST_STARTED count=1, BOMB_HIT] -> bomb once, slice zero times", () => {
    const startEvent: BurstStartedEvent = {
      type: "BURST_STARTED",
      burstId: 1,
      timeMs: 0,
      count: 1,
      fruits: [{ id: 1, kind: "mango" }],
    };
    const bombEvent: BombHitEvent = {
      type: "BOMB_HIT",
      burstId: 1,
      timeMs: 0,
      bombFruitId: 99,
      burstFruitCountBeforeBomb: 1,
    };

    policy.handleEvents([startEvent, bombEvent]);

    expect(sink.playSfx).toHaveBeenCalledTimes(1);
    expect(sink.playSfx).toHaveBeenCalledWith("bomb", {
      volume: DEFAULT_SLICE_AUDIO_CONFIG.bombVolume,
      playbackRate: DEFAULT_SLICE_AUDIO_CONFIG.bombPitch,
      maxVoices: DEFAULT_SLICE_AUDIO_CONFIG.bombMaxVoices,
    });
  });

  it("CASE D: [BURST_EXTENDED count=3, BOMB_HIT] -> bomb once, combo accent zero times", () => {
    const extendEvent: BurstExtendedEvent = {
      type: "BURST_EXTENDED",
      burstId: 1,
      timeMs: 30,
      count: 3,
      newCount: 1,
      fruits: [{ id: 3, kind: "durian" }],
    };
    const bombEvent: BombHitEvent = {
      type: "BOMB_HIT",
      burstId: 1,
      timeMs: 30,
      bombFruitId: 99,
      burstFruitCountBeforeBomb: 3,
    };

    policy.handleEvents([extendEvent, bombEvent]);

    expect(sink.playSfx).toHaveBeenCalledTimes(1);
    expect(sink.playSfx).toHaveBeenCalledWith("bomb", {
      volume: DEFAULT_SLICE_AUDIO_CONFIG.bombVolume,
      playbackRate: DEFAULT_SLICE_AUDIO_CONFIG.bombPitch,
      maxVoices: DEFAULT_SLICE_AUDIO_CONFIG.bombMaxVoices,
    });
  });

  it("CASE E: Previous frame already played slice, next frame receives BOMB_HIT -> bomb plays normally without retroactively stopping previous source", () => {
    // Frame 1: slice at 0ms
    const startEvent: BurstStartedEvent = {
      type: "BURST_STARTED",
      burstId: 1,
      timeMs: 0,
      count: 1,
      fruits: [{ id: 1, kind: "mango" }],
    };
    policy.handleEvents([startEvent]);
    expect(sink.playSfx).toHaveBeenCalledTimes(1);
    expect(sink.playSfx).toHaveBeenLastCalledWith("slice", expect.anything());

    // Frame 2: bomb at 25ms
    const bombEvent: BombHitEvent = {
      type: "BOMB_HIT",
      burstId: 1,
      timeMs: 25,
      bombFruitId: 99,
      burstFruitCountBeforeBomb: 1,
    };
    policy.handleEvents([bombEvent]);

    expect(sink.playSfx).toHaveBeenCalledTimes(2);
    expect(sink.playSfx).toHaveBeenLastCalledWith("bomb", {
      volume: DEFAULT_SLICE_AUDIO_CONFIG.bombVolume,
      playbackRate: DEFAULT_SLICE_AUDIO_CONFIG.bombPitch,
      maxVoices: DEFAULT_SLICE_AUDIO_CONFIG.bombMaxVoices,
    });
  });

  it("CASE F: Multiple accidental BOMB_HIT events in one event array -> bomb is played exactly once", () => {
    const bomb1: BombHitEvent = {
      type: "BOMB_HIT",
      burstId: 1,
      timeMs: 10,
      bombFruitId: 98,
      burstFruitCountBeforeBomb: 0,
    };
    const bomb2: BombHitEvent = {
      type: "BOMB_HIT",
      burstId: 1,
      timeMs: 10,
      bombFruitId: 99,
      burstFruitCountBeforeBomb: 0,
    };

    policy.handleEvents([bomb1, bomb2]);

    expect(sink.playSfx).toHaveBeenCalledTimes(1);
    expect(sink.playSfx).toHaveBeenCalledWith("bomb", expect.anything());
  });

  it("plays escalating combo accent on sequential BURST_EXTENDED events", () => {
    policy.handleEvents([
      {
        type: "BURST_EXTENDED",
        burstId: 1,
        timeMs: 20,
        count: 2,
        newCount: 1,
        fruits: [{ id: 2, kind: "banana" }],
      },
    ]);
    expect(sink.playSfx).toHaveBeenLastCalledWith("slice", {
      volume: DEFAULT_SLICE_AUDIO_CONFIG.combo2Volume,
      playbackRate: DEFAULT_SLICE_AUDIO_CONFIG.combo2Pitch,
      maxVoices: DEFAULT_SLICE_AUDIO_CONFIG.baseMaxVoices,
    });

    policy.handleEvents([
      {
        type: "BURST_EXTENDED",
        burstId: 1,
        timeMs: 40,
        count: 3,
        newCount: 1,
        fruits: [{ id: 3, kind: "mango" }],
      },
    ]);
    expect(sink.playSfx).toHaveBeenLastCalledWith("slice", {
      volume: DEFAULT_SLICE_AUDIO_CONFIG.combo3Volume,
      playbackRate: DEFAULT_SLICE_AUDIO_CONFIG.combo3Pitch,
      maxVoices: DEFAULT_SLICE_AUDIO_CONFIG.baseMaxVoices,
    });

    policy.handleEvents([
      {
        type: "BURST_EXTENDED",
        burstId: 1,
        timeMs: 60,
        count: 4,
        newCount: 1,
        fruits: [{ id: 4, kind: "durian" }],
      },
    ]);
    expect(sink.playSfx).toHaveBeenLastCalledWith("slice", {
      volume: DEFAULT_SLICE_AUDIO_CONFIG.combo4Volume,
      playbackRate: DEFAULT_SLICE_AUDIO_CONFIG.combo4Pitch,
      maxVoices: DEFAULT_SLICE_AUDIO_CONFIG.baseMaxVoices,
    });
  });

  it("does not trigger audio on BURST_ENDED", () => {
    const event: BurstEndedEvent = {
      type: "BURST_ENDED",
      burstId: 1,
      timeMs: 120,
      totalCount: 3,
      durationMs: 50,
    };

    policy.handleEvents([event]);
    expect(sink.playSfx).not.toHaveBeenCalled();
  });
});
