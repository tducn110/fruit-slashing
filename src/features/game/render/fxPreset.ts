export interface FxPreset {
  resolutionCap: number;
  antialias: boolean;
  sliceFleshParticles: number;
  sliceBodyParticles: number;
  bombFireParticles: number;
  bombSparkParticles: number;
  bombSmokeParticles: number;
  maxParticles: number;
  trailPoints: number;
}

const DESKTOP_FX_PRESET: FxPreset = {
  resolutionCap: 1.5,
  antialias: true,
  sliceFleshParticles: 16,
  sliceBodyParticles: 8,
  bombFireParticles: 18,
  bombSparkParticles: 12,
  bombSmokeParticles: 8,
  maxParticles: 160,
  trailPoints: 18,
};

const MOBILE_FX_PRESET: FxPreset = {
  resolutionCap: 1,
  antialias: false,
  sliceFleshParticles: 10,
  sliceBodyParticles: 5,
  bombFireParticles: 14,
  bombSparkParticles: 9,
  bombSmokeParticles: 6,
  maxParticles: 80,
  trailPoints: 12,
};

export function getFxPreset(width: number): FxPreset {
  return width <= 640 ? MOBILE_FX_PRESET : DESKTOP_FX_PRESET;
}
