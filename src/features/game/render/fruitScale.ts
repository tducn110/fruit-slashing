import { getWorldRenderTransform, smoothStep, type FruitKind } from '../../../game/core';
import { VISUAL_RADIUS } from './fruitVisuals';

/** Same artwork transform for whole fruit and its two split textures. */
export function getFruitArtworkScale(kind: FruitKind, width: number, height: number): number {
  const boost = 2 - .55 * smoothStep(410, 470, width) - .45 * smoothStep(600, 680, width);
  return (VISUAL_RADIUS[kind] / 20) * .9 * boost * getWorldRenderTransform(width, height).scaleX;
}
