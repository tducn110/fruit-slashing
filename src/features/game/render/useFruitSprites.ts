import { useEffect, useRef } from "react";
import { Container, Sprite, Texture } from "pixi.js";
import { getWorldRenderTransform, WORLD_HEIGHT, WORLD_WIDTH, type GameState } from "../../../game/core";
import { VISUAL_RADIUS } from "./fruitVisuals";

const FRUIT_SLOT_CAPACITY = 32;

interface FruitSpriteSlot {
  sprite: Sprite;
  fruitId: number | null;
  active: boolean;
}

interface Props {
  playLayerRef: React.RefObject<Container | null>;
  texturesRef: React.MutableRefObject<Record<string, Texture>>;
  texturesReady: boolean;
  sizeRef: React.MutableRefObject<{ w: number; h: number }>;
}

export function useFruitSprites({ playLayerRef, texturesRef, texturesReady, sizeRef }: Props) {
  const poolRef = useRef<FruitSpriteSlot[]>([]);
  const spriteMapRef = useRef(new Map<number, FruitSpriteSlot>());
  const activeIdsRef = useRef(new Set<number>());

  function ensurePool(layer: Container) {
    const pool = poolRef.current;
    if (pool.length === FRUIT_SLOT_CAPACITY && pool.every((slot) => !slot.sprite.destroyed)) return;

    pool.forEach((slot) => {
      if (slot.sprite.parent) slot.sprite.parent.removeChild(slot.sprite);
      if (!slot.sprite.destroyed) slot.sprite.destroy({ texture: false, textureSource: false });
    });

    poolRef.current = [];
    spriteMapRef.current.clear();

    for (let index = 0; index < FRUIT_SLOT_CAPACITY; index += 1) {
      const sprite = new Sprite();
      sprite.anchor.set(0.5);
      sprite.visible = false;
      layer.addChild(sprite);
      poolRef.current.push({ sprite, fruitId: null, active: false });
    }
  }

  function releaseSlot(slot: FruitSpriteSlot) {
    slot.active = false;
    slot.fruitId = null;
    slot.sprite.visible = false;
  }

  function acquireSlot(fruitId: number): FruitSpriteSlot | undefined {
    const slot = poolRef.current.find((candidate) => !candidate.active);
    if (!slot) return undefined;
    slot.active = true;
    slot.fruitId = fruitId;
    slot.sprite.visible = true;
    spriteMapRef.current.set(fruitId, slot);
    return slot;
  }

  function destroyPool() {
    spriteMapRef.current.clear();
    poolRef.current.forEach((slot) => {
      if (slot.sprite.parent) slot.sprite.parent.removeChild(slot.sprite);
      if (!slot.sprite.destroyed) {
        slot.sprite.destroy({ texture: false, textureSource: false });
      }
    });
    poolRef.current = [];
  }

  function syncFruitSprites(state: GameState) {
    if (!playLayerRef.current) return;
    if (!texturesReady || !texturesRef.current) return;

    const layer = playLayerRef.current;
    ensurePool(layer);

    const transform = getWorldRenderTransform(sizeRef.current.w, sizeRef.current.h);
    const renderScale = transform.scaleX;

    const viewportWidth = sizeRef.current.w;
    const fruitScale =
      viewportWidth <= 430 ? 2.0 :
        viewportWidth <= 640 ? 1.45 :
          1.0;

    // Reuse this Set because syncFruitSprites runs from the render loop.
    const activeIds = activeIdsRef.current;
    activeIds.clear();
    for (const fruit of state.fruits) activeIds.add(fruit.id);
    for (const [id, slot] of spriteMapRef.current.entries()) {
      if (!activeIds.has(id)) {
        releaseSlot(slot);
        spriteMapRef.current.delete(id);
      }
    }

    for (const fruit of state.fruits) {
      let slot = spriteMapRef.current.get(fruit.id);
      if (!slot) {
        const texture = texturesRef.current[fruit.kind];
        if (!texture) continue;

        slot = acquireSlot(fruit.id);
        if (!slot) continue;
        slot.sprite.texture = texture;
      }
      const sprite = slot.sprite;
      // Reuse the transform already calculated above instead of recomputing it
      // through worldToScreen() for every fruit.
      sprite.x = (fruit.x - WORLD_WIDTH / 2) * transform.scaleX + transform.offsetX;
      sprite.y = (fruit.y - WORLD_HEIGHT / 2) * transform.scaleY + transform.offsetY;
      sprite.rotation = fruit.rotation;
      sprite.scale.set((VISUAL_RADIUS[fruit.kind] / 20) * renderScale * 0.9 * fruitScale);
    }
  }

  function clearFruitSprites() {
    poolRef.current.forEach(releaseSlot);
    spriteMapRef.current.clear();
    activeIdsRef.current.clear();
  }

  useEffect(() => {
    return () => {
      destroyPool();
    };
  }, []);

  return { syncFruitSprites, clearFruitSprites };
}
