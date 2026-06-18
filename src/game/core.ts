export const GAME_DURATION_MS = 180_000;
export const TICK_RATE = 60;
export const TICK_MS = 1000 / TICK_RATE;
export const WORLD_WIDTH = 1000;
export const WORLD_HEIGHT = 600;
export const MAX_INPUT_SAMPLES = 6000;

export type FruitKind =
  | "durian"
  | "lychee"
  | "banana"
  | "dragonfruit"
  | "mango"
  | "peanut"
  | "bomb";

export const FRUIT_RULES: Record<FruitKind, { points: number; radius: number }> = {
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

export interface CoreFruit {
  id: number;
  kind: FruitKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationVelocity: number;
  radius: number;
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
}

const DURATION_TICKS = Math.round(GAME_DURATION_MS / TICK_MS);
const GRAVITY = 1000;
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

export function createGame(seed: number): GameState {
  const normalized = normalizeSeed(seed);
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
  const peakY = 80 + random(state) * (WORLD_HEIGHT * 0.2);

  state.fruits.push({
    id: state.nextFruitId++,
    kind,
    x: startX,
    y: WORLD_HEIGHT + 40,
    vx: (targetX - startX) / flightSeconds,
    vy: -Math.sqrt(2 * GRAVITY * Math.max(50, WORLD_HEIGHT - peakY)),
    rotation: 0,
    rotationVelocity: (random(state) - 0.5) * 6,
    radius,
  });
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
    const spawnEveryMs = 1100 - difficulty * 680;
    const count = 1 + Math.floor(difficulty * 3.5);
    const bombChance = 0.02 + difficulty * 0.26;
    const flightSeconds = 1.35 - difficulty * 0.65;
    for (let index = 0; index < count; index += 1) spawnFruit(state, bombChance, flightSeconds);
    state.nextSpawnTick = state.tick + Math.max(1, Math.round(spawnEveryMs / TICK_MS));
  }

  const deltaSeconds = 1 / TICK_RATE;
  for (const fruit of state.fruits) {
    fruit.vy += GRAVITY * deltaSeconds;
    fruit.x += fruit.vx * deltaSeconds;
    fruit.y += fruit.vy * deltaSeconds;
    fruit.rotation += fruit.rotationVelocity * deltaSeconds;
    if (fruit.x < fruit.radius) {
      fruit.x = fruit.radius;
      fruit.vx *= -1;
    } else if (fruit.x > WORLD_WIDTH - fruit.radius) {
      fruit.x = WORLD_WIDTH - fruit.radius;
      fruit.vx *= -1;
    }
  }
  state.fruits = state.fruits.filter((fruit) => fruit.y <= WORLD_HEIGHT + 100);
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

export function applyInput(state: GameState, sample: InputSample): SliceResult[] {
  if (state.ended) return [];
  advanceToTick(state, sample.tick);
  const point = {
    x: (sample.x / 10000) * WORLD_WIDTH,
    y: (sample.y / 10000) * WORLD_HEIGHT,
  };
  state.lastPointer = point;

  const results: SliceResult[] = [];
  for (let index = state.fruits.length - 1; index >= 0; index -= 1) {
    const fruit = state.fruits[index];
    const dx = fruit.x - point.x;
    const dy = fruit.y - point.y;
    if (dx * dx + dy * dy >= (fruit.radius + 14) ** 2) continue;

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

export function replayGame(seed: number, samples: InputSample[]): GameState {
  const state = createGame(seed);
  for (const sample of samples) {
    if (state.ended) break;
    applyInput(state, sample);
  }
  advanceToTick(state, DURATION_TICKS);
  return state;
}

export function isValidInputLog(value: unknown): value is InputSample[] {
  if (!Array.isArray(value) || value.length > MAX_INPUT_SAMPLES) return false;
  let previousTick = -1;
  for (const sample of value) {
    if (
      typeof sample !== "object" || sample === null
      || !Number.isInteger((sample as InputSample).tick)
      || !Number.isInteger((sample as InputSample).x)
      || !Number.isInteger((sample as InputSample).y)
    ) return false;
    const { tick, x, y } = sample as InputSample;
    if (
      tick < previousTick
      || (previousTick >= 0 && tick - previousTick < 2)
      || tick > DURATION_TICKS
      || x < 0 || x > 10000 || y < 0 || y > 10000
    ) return false;
    previousTick = tick;
  }
  return true;
}

export function rankFor(score: number): string {
  if (score >= 400) return "Vua Chém";
  if (score >= 250) return "Cao Thủ";
  if (score >= 100) return "Lính Mới";
  return "Tập Sự";
}
