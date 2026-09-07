import type { FruitKind, SliceResult } from "../core";

export const DEFAULT_SLICE_BURST_WINDOW_MS = 65; // Initial tuning hypothesis, not a fixed standard

export type SliceBurstEventType =
  | "BURST_STARTED"
  | "BURST_EXTENDED"
  | "BURST_ENDED"
  | "BOMB_HIT";

export interface SliceBurstFruitInfo {
  id: number;
  kind: FruitKind;
}

export interface BaseBurstEvent {
  type: SliceBurstEventType;
  burstId: number;
  timeMs: number;
}

export interface BurstStartedEvent extends BaseBurstEvent {
  type: "BURST_STARTED";
  count: number;
  fruits: SliceBurstFruitInfo[];
}

export interface BurstExtendedEvent extends BaseBurstEvent {
  type: "BURST_EXTENDED";
  count: number;
  newCount: number;
  fruits: SliceBurstFruitInfo[];
}

export interface BurstEndedEvent extends BaseBurstEvent {
  type: "BURST_ENDED";
  totalCount: number;
  durationMs: number;
}

export interface BombHitEvent extends BaseBurstEvent {
  type: "BOMB_HIT";
  bombFruitId: number;
  burstFruitCountBeforeBomb: number;
}

export type SliceBurstEvent =
  | BurstStartedEvent
  | BurstExtendedEvent
  | BurstEndedEvent
  | BombHitEvent;

export interface SliceBurstAggregatorConfig {
  windowMs?: number;
  debug?: boolean;
}

export class SliceBurstAggregator {
  private windowMs: number;
  private debug: boolean;

  private currentBurstId = 0;
  private inBurst = false;
  private burstStartedAt = 0;
  private lastHitAt = 0;
  private burstCount = 0;

  constructor(config?: SliceBurstAggregatorConfig) {
    this.windowMs = config?.windowMs ?? DEFAULT_SLICE_BURST_WINDOW_MS;
    this.debug = config?.debug ?? false;
  }

  get isInBurst(): boolean {
    return this.inBurst;
  }

  get currentCount(): number {
    return this.burstCount;
  }

  get activeBurstId(): number {
    return this.currentBurstId;
  }

  /**
   * Push new SliceResult items into the aggregator at the current gameplay time.
   */
  push(results: SliceResult[], nowMs: number): SliceBurstEvent[] {
    const events: SliceBurstEvent[] = [];

    if (!results || results.length === 0) {
      return this.update(nowMs);
    }

    // Check if an existing open burst has expired before this new push
    if (this.inBurst && nowMs - this.lastHitAt > this.windowMs) {
      events.push(this.closeBurst(nowMs));
    }

    // Separate normal fruits from bomb hits
    const normalFruits: SliceBurstFruitInfo[] = [];
    const bombResults: SliceResult[] = [];

    for (const res of results) {
      if (res.fruit.kind === "bomb") {
        bombResults.push(res);
      } else {
        normalFruits.push({ id: res.fruit.id, kind: res.fruit.kind });
      }
    }

    // 1. Process normal fruits
    if (normalFruits.length > 0) {
      if (!this.inBurst) {
        this.inBurst = true;
        this.currentBurstId += 1;
        this.burstStartedAt = nowMs;
        this.lastHitAt = nowMs;
        this.burstCount = normalFruits.length;

        const event: BurstStartedEvent = {
          type: "BURST_STARTED",
          burstId: this.currentBurstId,
          timeMs: nowMs,
          count: this.burstCount,
          fruits: normalFruits,
        };
        this.logDebug("BURST_STARTED", event);
        events.push(event);
      } else {
        this.lastHitAt = nowMs;
        const newCount = normalFruits.length;
        this.burstCount += newCount;

        const event: BurstExtendedEvent = {
          type: "BURST_EXTENDED",
          burstId: this.currentBurstId,
          timeMs: nowMs,
          count: this.burstCount,
          newCount,
          fruits: normalFruits,
        };
        this.logDebug("BURST_EXTENDED", event);
        events.push(event);
      }
    }

    // 2. Process bombs (highest priority: cancels / terminates any active burst immediately)
    if (bombResults.length > 0) {
      for (const bomb of bombResults) {
        const event: BombHitEvent = {
          type: "BOMB_HIT",
          burstId: this.inBurst ? this.currentBurstId : this.currentBurstId + 1,
          timeMs: nowMs,
          bombFruitId: bomb.fruit.id,
          burstFruitCountBeforeBomb: this.burstCount,
        };
        this.logDebug("BOMB_HIT", event);
        events.push(event);
      }
      // Bomb forcibly closes any active burst without emitting BURST_ENDED
      this.inBurst = false;
      this.burstCount = 0;
    }

    return events;
  }

  /**
   * Update the aggregator state with current gameplay time.
   * Emits BURST_ENDED if the sliding inactivity window has elapsed.
   */
  update(nowMs: number): SliceBurstEvent[] {
    if (this.inBurst && nowMs - this.lastHitAt > this.windowMs) {
      return [this.closeBurst(nowMs)];
    }
    return [];
  }

  /**
   * Forcibly close and finalize the active burst, emitting BURST_ENDED if active.
   */
  flush(nowMs?: number): SliceBurstEvent[] {
    if (this.inBurst) {
      return [this.closeBurst(nowMs ?? this.lastHitAt)];
    }
    return [];
  }

  /**
   * Reset all internal state without emitting events (for game restart or clean teardown).
   */
  reset(): void {
    this.inBurst = false;
    this.burstCount = 0;
    this.burstStartedAt = 0;
    this.lastHitAt = 0;
  }

  private closeBurst(closeTimeMs: number): BurstEndedEvent {
    const event: BurstEndedEvent = {
      type: "BURST_ENDED",
      burstId: this.currentBurstId,
      timeMs: closeTimeMs,
      totalCount: this.burstCount,
      durationMs: Math.max(0, this.lastHitAt - this.burstStartedAt),
    };
    this.logDebug("BURST_ENDED", event);
    this.inBurst = false;
    this.burstCount = 0;
    return event;
  }

  private logDebug(event: SliceBurstEventType, data: SliceBurstEvent): void {
    if (!this.debug) return;
    if (typeof process !== "undefined" && process.env?.NODE_ENV === "production") return;
    const count = "count" in data ? data.count : "totalCount" in data ? data.totalCount : 0;
    console.debug(`[SliceBurst] time=${data.timeMs.toFixed(1)} event=${event} burstId=${data.burstId} burstCount=${count}`);
  }
}
