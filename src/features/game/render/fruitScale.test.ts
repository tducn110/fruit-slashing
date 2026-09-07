import { expect, it } from 'vitest';
import { getFruitArtworkScale } from './fruitScale';
it('keeps artwork size continuous across mobile breakpoints', () => {
  for (const width of [430, 640]) {
    const before = getFruitArtworkScale('lychee', width, 789);
    const after = getFruitArtworkScale('lychee', width + 1, 789);
    expect(Math.abs(after / before - 1)).toBeLessThan(.02);
  }
  expect(getFruitArtworkScale('lychee',390,789)).toBeCloseTo(.7722);
});
