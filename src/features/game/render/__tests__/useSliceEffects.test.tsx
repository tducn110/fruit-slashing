// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { expect, it, vi } from 'vitest';
import { useSliceEffects } from '../useSliceEffects';
import { useParticleSystem } from '../useParticleSystem';
import { type SliceResult } from '../../../../game/core';
import { getFruitArtworkScale } from '../fruitVisuals';
vi.hoisted(() => { HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext; });
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it('reusing the seventh slash has one lifetime and no stale expiry can hide it', async () => {
  const layer = new Container();
  let effects!: ReturnType<typeof useSliceEffects>;
  let particles!: ReturnType<typeof useParticleSystem>;
  function Probe() {
    particles = useParticleSystem();
    effects = useSliceEffects({ playLayerRef: {current: layer}, texturesRef: {current: {durian_left: Texture.WHITE, durian_right: Texture.WHITE}}, sizeRef: {current: {w: 390, h: 844}}, ...particles, triggerBombFeedback: vi.fn(), triggerPointFeedback: vi.fn(), callbacksRef: {current: {muted: true}} });
    return null;
  }
  const root = createRoot(document.createElement('div'));
  await act(async () => root.render(<Probe />));
  effects.initHalfPool(layer);
  const result = {fruit: {kind: 'durian', x: 300, y: 300, vx: 0, vy: 0, rotation: 0, radius: 20}, points: 1, combo: 1} as SliceResult;
  const advance = (dt: number) => {
    particles.updateParticles(dt, 844);
    effects.updateSliceEffects(dt, 844);
  };
  for (let i = 0; i < 6; i++) effects.showSliceEffect(result, {dx: 1, dy: 0});
  advance(.15);
  effects.showSliceEffect(result, {dx: 1, dy: 0});
  const slash = layer.children.find(c => c.label === 'SlashEffect:0')!;
  advance(.06);
  expect(slash.visible).toBe(true);
  expect(slash.alpha).toBeCloseTo(.7);
  advance(.15);
  expect(slash.visible).toBe(false);
  const allocated = [...layer.children];
  effects.clearSliceEffects();
  expect(layer.children.every(display => !display.visible)).toBe(true);
  // Replay dozens of bursts: bounded objects, one expiry per owned slot.
  for (let burst = 0; burst < 30; burst++) {
    for (let hit = 0; hit < 20; hit++) effects.showSliceEffect(result, {dx: 1, dy: 0});
    expect(layer.children.filter(c => c.label.startsWith('SlashEffect:') && c.visible)).toHaveLength(6);
    expect(layer.children.filter(c => c.label.startsWith('FruitHalf:') && c.visible)).toHaveLength(24);
    advance(1.1);
    expect(layer.children.every(display => !display.visible)).toBe(true);
  }
  expect(layer.children).toEqual(allocated);
  await act(async () => root.unmount());
  effects.destroyHalfPool(); effects.destroySlashPool(); layer.destroy();
});

it('prebuilds hit geometry and keeps halves at the whole-fruit scale', async () => {
  const layer = new Container();
  let effects!: ReturnType<typeof useSliceEffects>;
  function Probe() {
    effects = useSliceEffects({playLayerRef: {current: layer}, texturesRef: {current: {durian_left: Texture.WHITE, durian_right: Texture.WHITE}}, sizeRef: {current: {w: 390, h: 844}}, spawnPooledParticle: () => false, triggerBombFeedback: vi.fn(), triggerPointFeedback: vi.fn(), callbacksRef: {current: {muted: true}}});
    return null;
  }
  const root = createRoot(document.createElement('div'));
  await act(async () => root.render(<Probe />));
  effects.initHalfPool(layer);
  const clear = vi.spyOn(Graphics.prototype, 'clear');
  const stroke = vi.spyOn(Graphics.prototype, 'stroke');
  effects.showSliceEffect({fruit: {kind: 'durian', x: 300, y: 300, vx: 0, vy: 0, rotation: 0, radius: 20}, points: 1, combo: 1} as SliceResult, {dx: 1, dy: 0});
  expect(clear).not.toHaveBeenCalled();
  expect(stroke).not.toHaveBeenCalled();
  const half = layer.children.find(c => c.label === 'FruitHalf:durian:left') as Sprite;
  expect(half.scale.x).toBeCloseTo(getFruitArtworkScale('durian', 390, 844));
  clear.mockRestore(); stroke.mockRestore();
  await act(async () => root.unmount());
  effects.destroyHalfPool(); effects.destroySlashPool(); layer.destroy();
});
