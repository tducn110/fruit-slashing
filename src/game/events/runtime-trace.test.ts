import { describe, it } from "vitest";
import { SliceBurstAggregator } from "./SliceBurstAggregator";
import {
  SliceAudioPolicy,
  DEFAULT_SLICE_AUDIO_CONFIG,
  type SliceAudioSink,
} from "../audio/SliceAudioPolicy";
import type { SliceResult } from "../core";

function makeFruitResult(id: number, kind: "mango" | "banana" | "bomb" = "mango"): SliceResult {
  return {
    fruit: {
      id,
      kind,
      x: 100,
      y: 100,
      vx: 0,
      vy: 0,
      rotation: 0,
      rotationVelocity: 0,
      radius: 30,
    },
    points: 10,
    combo: 1,
    lives: 3,
  };
}

class MockAudioSink implements SliceAudioSink {
  public calls: Array<{ name: string; options: any; activeVoices: number }> = [];
  public sliceVoiceCount = 0;
  public bombVoiceCount = 0;

  playSfx(name: "slice" | "bomb", options?: { volume?: number; playbackRate?: number; maxVoices?: number }) {
    if (name === "slice") {
      this.sliceVoiceCount = Math.min((options?.maxVoices ?? 4), this.sliceVoiceCount + 1);
    } else {
      this.bombVoiceCount = Math.min((options?.maxVoices ?? 2), this.bombVoiceCount + 1);
    }
    const currentActive = name === "slice" ? this.sliceVoiceCount : this.bombVoiceCount;
    this.calls.push({ name, options, activeVoices: currentActive });
  }

  getActiveVoiceCount(name: "slice" | "bomb") {
    return name === "slice" ? this.sliceVoiceCount : this.bombVoiceCount;
  }
}

describe("Runtime Trace of 6 Cases", () => {
  it("executes all 6 cases and logs exact runtime behavior", () => {
    function runTrace(name: string, steps: Array<{ time: number; results?: SliceResult[]; isUpdate?: boolean }>) {
      console.log(`\n=================== ${name} ===================`);
      const sink = new MockAudioSink();
      const aggregator = new SliceBurstAggregator({ windowMs: 65, debug: false });
      const policy = new SliceAudioPolicy(sink, DEFAULT_SLICE_AUDIO_CONFIG, false);

      for (const step of steps) {
        sink.calls = [];
        let events;
        if (step.isUpdate) {
          events = aggregator.update(step.time);
        } else {
          events = aggregator.push(step.results ?? [], step.time);
        }
        policy.handleEvents(events);

        console.log(`TIME: ${step.time}ms`);
        console.log(`  INPUT: ${step.results ? step.results.map(r => `${r.fruit.kind}#${r.fruit.id}`).join(", ") : "(update tick)"}`);
        console.log(`  EVENTS: ${JSON.stringify(events.map(e => ({ type: e.type, count: (e as any).count ?? (e as any).totalCount, burstId: e.burstId })))}`);
        console.log(`  BURST STATE: inBurst=${aggregator.isInBurst}, count=${aggregator.currentCount}, activeBurstId=${aggregator.activeBurstId}`);
        console.log(`  AUDIO SINK CALLS: ${JSON.stringify(sink.calls)}`);
      }
    }

    // CASE 1: One fruit
    runTrace("CASE 1: One fruit", [
      { time: 0, results: [makeFruitResult(1, "mango")] },
      { time: 70, isUpdate: true },
    ]);

    // CASE 2: Two fruits in SAME SliceResult[]
    runTrace("CASE 2: Two fruits in SAME SliceResult[]", [
      { time: 0, results: [makeFruitResult(1, "mango"), makeFruitResult(2, "banana")] },
      { time: 70, isUpdate: true },
    ]);

    // CASE 3: A at 0ms, B at 18ms, C at 42ms
    runTrace("CASE 3: A at 0ms, B at 18ms, C at 42ms", [
      { time: 0, results: [makeFruitResult(1, "mango")] },
      { time: 18, results: [makeFruitResult(2, "banana")] },
      { time: 42, results: [makeFruitResult(3, "mango")] },
      { time: 110, isUpdate: true },
    ]);

    // CASE 4: A at 0ms, B after SLICE_BURST_WINDOW_MS
    runTrace("CASE 4: A at 0ms, B after SLICE_BURST_WINDOW_MS", [
      { time: 0, results: [makeFruitResult(1, "mango")] },
      { time: 80, results: [makeFruitResult(2, "banana")] },
      { time: 150, isUpdate: true },
    ]);

    // CASE 5: Fruit then Bomb after 25ms
    runTrace("CASE 5: Fruit then Bomb after 25ms", [
      { time: 0, results: [makeFruitResult(1, "mango")] },
      { time: 25, results: [makeFruitResult(99, "bomb")] },
      { time: 100, isUpdate: true },
    ]);

    // CASE 6: Fruit + Bomb in SAME detection batch
    runTrace("CASE 6: Fruit + Bomb in SAME detection batch", [
      { time: 0, results: [makeFruitResult(1, "mango"), makeFruitResult(99, "bomb")] },
      { time: 70, isUpdate: true },
    ]);
  });
});
