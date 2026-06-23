export const GAME_DURATION_MS = 180_000;
export const TICK_RATE = 60;
const TICK_MS = 1000 / TICK_RATE;
export const WORLD_WIDTH = 1000;
export const WORLD_HEIGHT = 600;

export interface GameConfig {
  hitboxScale: number;
  spawnInterval: number;
  peakYBase: number;
  peakYRange: number;
  spawnYOffset: number;
  debugTrajectory?: boolean;
}

export function getGameConfig(viewportWidth: number): GameConfig {
  const isMobile = viewportWidth <= 640;
  return {
    hitboxScale: isMobile ? 1.45 : 1.3,
    spawnInterval: isMobile ? 0.98 : 1.0,
    peakYBase: isMobile ? 40 : 80,
    peakYRange: isMobile ? 0.12 : 0.2,
    spawnYOffset: isMobile ? -100 : 40,
  };
}

export type FruitKind =
  | "durian"
  | "lychee"
  | "banana"
  | "dragonfruit"
  | "mango"
  | "peanut"
  | "bomb";

const FRUIT_RULES: Record<FruitKind, { points: number; radius: number }> = {
  durian: { points: 5, radius: 38 },
  lychee: { points: 3, radius: 26 },
  banana: { points: 2, radius: 34 },
  dragonfruit: { points: 4, radius: 34 },
  mango: { points: 2, radius: 34 },
  peanut: { points: 10, radius: 28 },
  bomb: { points: 0, radius: 30 },
};

export interface InputSample {
  tick: number;
  /** Normalized integer coordinate in the inclusive range 0..10000. */
  x: number;
  /** Normalized integer coordinate in the inclusive range 0..10000. */
  y: number;
}

interface CoreFruit {
  id: number;
  kind: FruitKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationVelocity: number;
  radius: number;
  spawnY?: number;
  targetPeakY?: number;
  minYReached?: number;
  spawnVelocityY?: number;
}

export interface SliceResult {
  fruit: CoreFruit;
  points: number;
  combo: number;
  lives: number;
}

export interface GameState {
  seed: number;
  randomState: number;
  tick: number;
  score: number;
  lives: number;
  combo: number;
  comboExpiresAtTick: number;
  nextSpawnTick: number;
  nextFruitId: number;
  ended: boolean;
  endReason: "timeout" | "lives" | null;
  fruits: CoreFruit[];
  lastPointer: { x: number; y: number } | null;
  config: GameConfig;
}

const DURATION_TICKS = Math.round(GAME_DURATION_MS / TICK_MS);
const GRAVITY = 2200;
const FRUIT_POOL: FruitKind[] = ["mango", "mango", "banana", "lychee", "dragonfruit", "durian"];

function normalizeSeed(seed: number): number {
  const value = Number.isFinite(seed) ? seed >>> 0 : 0;
  return value || 0x6d2b79f5;
}

function random(state: GameState): number {
  state.randomState = (state.randomState + 0x6d2b79f5) >>> 0;
  let value = state.randomState;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

function logFruitTrajectory(state: GameState, reason: "spawn" | "slice" | "despawn", fruit: CoreFruit): void {
  if (!state.config.debugTrajectory) return;
  console.debug("[fruit-trajectory]", reason, {
    id: fruit.id,
    kind: fruit.kind,
    spawnY: fruit.spawnY,
    targetPeakY: fruit.targetPeakY,
    initialVelocityY: fruit.spawnVelocityY,
    gravity: GRAVITY,
    minYReached: fruit.minYReached,
    currentY: fruit.y,
  });
}

export function createGame(seed: number, config?: GameConfig): GameState {
  const normalized = normalizeSeed(seed);
  const defaultConfig: GameConfig = {
    hitboxScale: 1.3,
    spawnInterval: 1.0,
    peakYBase: 80,
    peakYRange: 0.2,
    spawnYOffset: 40,
  };
  return {
    seed: normalized,
    randomState: normalized,
    tick: 0,
    score: 0,
    lives: 3,
    combo: 0,
    comboExpiresAtTick: 0,
    nextSpawnTick: 64,
    nextFruitId: 1,
    ended: false,
    endReason: null,
    fruits: [],
    lastPointer: null,
    config: config ?? defaultConfig,
  };
}

function difficultyAt(tick: number): number {
  const seconds = tick / TICK_RATE;
  const value = seconds < 10
    ? 0.05 + (seconds / 10) * 0.10
    : seconds < 20
      ? 0.15 + ((seconds - 10) / 10) * 0.20
      : seconds < 40
        ? 0.35 + ((seconds - 20) / 20) * 0.30
        : seconds < 80
          ? 0.65 + ((seconds - 40) / 40) * 0.13
          : 0.78 + ((seconds - 80) / 100) * 0.22;
  return Math.max(0, Math.min(1, value));
}

function spawnFruit(state: GameState, bombChance: number, flightSeconds: number): void {
  const kind: FruitKind = random(state) < bombChance
    ? "bomb"
    : random(state) < 0.08
      ? "peanut"
      : FRUIT_POOL[Math.floor(random(state) * FRUIT_POOL.length)];
  const radius = FRUIT_RULES[kind].radius;
  const startX = Math.max(radius, Math.min(WORLD_WIDTH - radius, 80 + random(state) * (WORLD_WIDTH - 160)));
  const targetX = Math.max(
    radius,
    Math.min(WORLD_WIDTH - radius, startX + (random(state) - 0.5) * (WORLD_WIDTH * 0.45)),
  );
  const peakY = state.config.peakYBase + random(state) * (WORLD_HEIGHT * state.config.peakYRange);
  const spawnY = WORLD_HEIGHT + state.config.spawnYOffset;
  const initialVelocityY = -Math.sqrt(2 * GRAVITY * Math.max(50, spawnY - peakY));

  const fruit: CoreFruit = {
    id: state.nextFruitId++,
    kind,
    x: startX,
    y: spawnY,
    vx: (targetX - startX) / flightSeconds,
    vy: initialVelocityY,
    rotation: 0,
    rotationVelocity: (random(state) - 0.5) * 6,
    radius,
    spawnY,
    targetPeakY: peakY,
    minYReached: spawnY,
    spawnVelocityY: initialVelocityY,
  };
  state.fruits.push(fruit);
  logFruitTrajectory(state, "spawn", fruit);
}

function step(state: GameState): void {
  if (state.ended) return;
  state.tick += 1;
  if (state.tick >= DURATION_TICKS) {
    state.ended = true;
    state.endReason = "timeout";
    return;
  }

  if (state.combo > 0 && state.tick > state.comboExpiresAtTick) state.combo = 0;

  const difficulty = difficultyAt(state.tick);
  if (state.tick >= state.nextSpawnTick) {
    const spawnEveryMs = (1100 - difficulty * 680) * state.config.spawnInterval;
    const count = 1 + Math.floor(difficulty * 3.5);
    const bombChance = 0.02 + difficulty * 0.26;
    const flightSeconds = 1.35 - difficulty * 0.65;
    for (let index = 0; index < count; index += 1) spawnFruit(state, bombChance, flightSeconds);
    state.nextSpawnTick = state.tick + Math.max(1, Math.round(spawnEveryMs / TICK_MS));
  }

  const deltaSeconds = 1 / TICK_RATE;
  for (const fruit of state.fruits) {
    fruit.x += fruit.vx * deltaSeconds;
    fruit.y += fruit.vy * deltaSeconds + 0.5 * GRAVITY * deltaSeconds * deltaSeconds;
    fruit.vy += GRAVITY * deltaSeconds;
    fruit.minYReached = Math.min(fruit.minYReached ?? fruit.y, fruit.y);
    fruit.rotation += fruit.rotationVelocity * deltaSeconds;
    if (fruit.x < fruit.radius) {
      fruit.x = fruit.radius;
      fruit.vx *= -1;
    } else if (fruit.x > WORLD_WIDTH - fruit.radius) {
      fruit.x = WORLD_WIDTH - fruit.radius;
      fruit.vx *= -1;
    }
  }
  state.fruits = state.fruits.filter((fruit) => {
    const active = fruit.y <= WORLD_HEIGHT + 100;
    if (!active) logFruitTrajectory(state, "despawn", fruit);
    return active;
  });
}

export function advanceToTick(state: GameState, targetTick: number): void {
  const safeTarget = Math.min(DURATION_TICKS, Math.max(state.tick, Math.floor(targetTick)));
  while (!state.ended && state.tick < safeTarget) step(state);
}

export function elapsedTick(elapsedMs: number): number {
  return Math.max(0, Math.min(DURATION_TICKS, Math.floor(elapsedMs / TICK_MS)));
}

export function timeLeftSeconds(state: GameState): number {
  return Math.max(0, Math.ceil((DURATION_TICKS - state.tick) / TICK_RATE));
}

export function normalizePointer(x: number, y: number, width: number, height: number, tick: number): InputSample {
  return {
    tick: Math.max(0, Math.floor(tick)),
    x: Math.round(Math.max(0, Math.min(1, x / Math.max(1, width))) * 10000),
    y: Math.round(Math.max(0, Math.min(1, y / Math.max(1, height))) * 10000),
  };
}

export function screenToWorld(x: number, y: number, width: number, height: number) {
  const renderScale = Math.min(
    Math.max(1, width) / WORLD_WIDTH,
    Math.max(1, height) / WORLD_HEIGHT,
  );
  return {
    x: (x - width / 2) / renderScale + WORLD_WIDTH / 2,
    y: (y - height / 2) / renderScale + WORLD_HEIGHT / 2,
  };
}

function distancePointToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    const dpx = px - x1;
    const dpy = py - y1;
    return Math.sqrt(dpx * dpx + dpy * dpy);
  }

  let t = ((px - x1) * dx + (py - y1) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));

  const closestX = x1 + t * dx;
  const closestY = y1 + t * dy;
  const dpx = px - closestX;
  const dpy = py - closestY;

  return Math.sqrt(dpx * dpx + dpy * dpy);
}

export interface TrailSegment {
  x: number;
  y: number;
}

export function applyInput(state: GameState, sample: InputSample, trail: TrailSegment[] = [], config?: GameConfig): SliceResult[] {
  if (state.ended) return [];
  advanceToTick(state, sample.tick);
  const point = {
    x: (sample.x / 10000) * WORLD_WIDTH,
    y: (sample.y / 10000) * WORLD_HEIGHT,
  };
  state.lastPointer = point;

  const hitboxScale = config?.hitboxScale ?? 1.1;
  const checkSegments = trail.length >= 2 ? trail.slice(-10) : [];

  const results: SliceResult[] = [];
  for (let index = state.fruits.length - 1; index >= 0; index -= 1) {
    const fruit = state.fruits[index];
    const hitRadius = fruit.radius * hitboxScale;

    let hit = false;

    const dx = fruit.x - point.x;
    const dy = fruit.y - point.y;
    if (dx * dx + dy * dy < hitRadius * hitRadius) {
      hit = true;
    }

    if (!hit && checkSegments.length >= 2) {
      for (let i = 1; i < checkSegments.length; i++) {
        const seg1 = checkSegments[i - 1];
        const seg2 = checkSegments[i];
        const dist = distancePointToSegment(fruit.x, fruit.y, seg1.x, seg1.y, seg2.x, seg2.y);
        if (dist < hitRadius) {
          hit = true;
          break;
        }
      }
    }

    if (!hit) continue;

    logFruitTrajectory(state, "slice", fruit);
    state.fruits.splice(index, 1);
    if (fruit.kind === "bomb") {
      state.lives -= 1;
      state.combo = 0;
      if (state.lives <= 0) state.ended = true;
      if (state.lives <= 0) state.endReason = "lives";
      results.push({ fruit: { ...fruit }, points: 0, combo: state.combo, lives: state.lives });
      continue;
    }

    state.combo += 1;
    state.comboExpiresAtTick = state.tick + Math.round(0.7 * TICK_RATE);
    const multiplier = state.combo >= 5 ? 3 : state.combo >= 3 ? 2 : 1;
    const peanutBonus = fruit.kind === "peanut" ? 10 : 1;
    const points = FRUIT_RULES[fruit.kind].points * multiplier * peanutBonus;
    state.score += points;
    results.push({ fruit: { ...fruit }, points, combo: state.combo, lives: state.lives });
  }
  return results.reverse();
}
