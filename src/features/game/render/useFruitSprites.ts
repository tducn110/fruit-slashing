import { useEffect, useRef } from "react";
import { Container, Sprite, Texture } from "pixi.js";
import { RADIUS, type FruitKind } from "../../../utils/fruit-utils";
import { WORLD_HEIGHT, WORLD_WIDTH, type GameState } from "../../../game/core";

interface Props {
  playLayerRef: React.RefObject<Container | null>;
  texturesRef: React.MutableRefObject<Record<string, Texture>>;
  sizeRef: React.MutableRefObject<{ w: number; h: number }>;
}

export function useFruitSprites({ playLayerRef, texturesRef, sizeRef }: Props) {
  const spriteMapRef = useRef(new Map<number, Sprite>());

  function syncFruitSprites(state: GameState) {
    if (!playLayerRef.current) return;
    const layer = playLayerRef.current;
    
    const renderScale = Math.min(sizeRef.current.w / WORLD_WIDTH, sizeRef.current.h / WORLD_HEIGHT);
    const worldToScreen = (x: number, y: number) => ({
      x: (x - WORLD_WIDTH / 2) * renderScale + sizeRef.current.w / 2,
      y: (y - WORLD_HEIGHT / 2) * renderScale + sizeRef.current.h / 2,
    });

    const activeIds = new Set(state.fruits.map((f) => f.id));
    for (const [id, sprite] of spriteMapRef.current.entries()) {
      if (!activeIds.has(id)) {
        sprite.destroy();
        spriteMapRef.current.delete(id);
      }
    }
    
    for (const fruit of state.fruits) {
      let sprite = spriteMapRef.current.get(fruit.id);
      if (!sprite) {
        sprite = new Sprite(texturesRef.current[fruit.kind]);
        sprite.anchor.set(0.5);
        layer.addChild(sprite);
        spriteMapRef.current.set(fruit.id, sprite);
      }
      const { x, y } = worldToScreen(fruit.x, fruit.y);
      sprite.x = x;
      sprite.y = y;
      sprite.rotation = fruit.rotation;
      sprite.scale.set((RADIUS[fruit.kind as FruitKind] / 20) * renderScale * 0.9);
    }
  }

  function clearFruitSprites() {
    spriteMapRef.current.forEach((sprite) => sprite.destroy());
    spriteMapRef.current.clear();
  }

  useEffect(() => {
    return () => {
      clearFruitSprites();
    };
  }, []);

  return { syncFruitSprites, clearFruitSprites };
}
