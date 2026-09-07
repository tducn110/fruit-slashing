// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { getFxPreset } from './fxPreset';
afterEach(() => vi.unstubAllGlobals());
it('keeps coarse pointer devices on mobile FX when rotated landscape', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  expect(getFxPreset(844)).toBe(getFxPreset(390));
  expect(getFxPreset(844).resolutionCap).toBe(1);
});
