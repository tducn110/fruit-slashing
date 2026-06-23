import { useEffect, useRef } from "react";
import { Container, Sprite, Texture } from "pixi.js";
import { getWorldRenderTransform, worldToScreen, type GameState } from "../../../game/core";
import { VISUAL_RADIUS } from "./fruitVisuals";

interface Props {
  playLayerRef: React.RefObject<Container | null>;
  texturesRef: React.MutableRefObject<Record<string, Texture>>;
  texturesReady: boolean;
  sizeRef: React.MutableRefObject<{ w: number; h: number }>;
}

export function useFruitSprites({ playLayerRef, texturesRef, texturesReady, sizeRef }: Props) {
  const spriteMapRef = useRef(new Map<number, Sprite>());

  function destroySprite(sprite: Sprite) {
    if (sprite.parent) {
      sprite.parent.removeChild(sprite);
    }
    sprite.destroy({
      children: true,
      texture: false,
      textureSource: false,
    });
  }

  function syncFruitSprites(state: GameState) {
    if (!playLayerRef.current) return;
    if (!texturesReady || !texturesRef.current) return;

    const layer = playLayerRef.current;

    const transform = getWorldRenderTransform(sizeRef.current.w, sizeRef.current.h);
    const renderScale = transform.scaleX;

    const viewportWidth = sizeRef.current.w;
    const fruitScale =
      viewportWidth <= 430 ? 2.0 :
        viewportWidth <= 640 ? 1.45 :
          1.0;

    const activeIds = new Set(state.fruits.map((f) => f.id));
    for (const [id, sprite] of spriteMapRef.current.entries()) {
      if (!activeIds.has(id)) {
        destroySprite(sprite);
        spriteMapRef.current.delete(id);
      }
    }

    for (const fruit of state.fruits) {
      let sprite = spriteMapRef.current.get(fruit.id);
      if (!sprite) {
        const texture = texturesRef.current[fruit.kind];
        if (!texture) continue;

        sprite = new Sprite(texture);
        sprite.anchor.set(0.5);
        layer.addChild(sprite);
        spriteMapRef.current.set(fruit.id, sprite);
      }
      const { x, y } = worldToScreen(fruit.x, fruit.y, sizeRef.current.w, sizeRef.current.h);
      sprite.x = x;
      sprite.y = y;
      sprite.rotation = fruit.rotation;
      sprite.scale.set((VISUAL_RADIUS[fruit.kind] / 20) * renderScale * 0.9 * fruitScale);
    }
  }

  function clearFruitSprites() {
    spriteMapRef.current.forEach((sprite) => destroySprite(sprite));
    spriteMapRef.current.clear();
  }

  useEffect(() => {
    return () => {
      clearFruitSprites();
    };
  }, []);

  return { syncFruitSprites, clearFruitSprites };
}
