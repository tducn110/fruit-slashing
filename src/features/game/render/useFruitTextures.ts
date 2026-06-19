import { useEffect, useRef, useState } from "react";
import type { Application } from "pixi.js";
import { Graphics, Sprite, Texture } from "pixi.js";
import { makeFruit, makeHalf, RADIUS, type FruitKind } from "../../../utils/fruit-utils";

const FRUIT_KINDS: FruitKind[] = ["durian", "lychee", "banana", "dragonfruit", "mango", "peanut", "bomb"];

interface Props {
  appRef: React.RefObject<Application | null>;
  appReady: boolean;
}

export function useFruitTextures({ appRef, appReady }: Props) {
  const texturesRef = useRef<Record<string, Texture>>({});
  const [texturesReady, setTexturesReady] = useState(false);

  useEffect(() => {
    if (!appReady || !appRef.current) {
      setTexturesReady(false);
      return;
    }

    const app = appRef.current;
    if (!app.renderer) {
      setTexturesReady(false);
      return;
    }

    let cancelled = false;
    const textures: Record<string, Texture> = {};

    try {
      const circle = new Graphics().circle(0, 0, 10).fill(0xffffff);
      try {
        textures.circle = app.renderer.generateTexture(circle);
      } finally {
        circle.destroy();
      }

      for (const kind of FRUIT_KINDS) {
        const full = makeFruit(kind, RADIUS[kind]);
        try {
          textures[kind] = app.renderer.generateTexture(full);
        } finally {
          full.destroy();
        }

        if (kind !== "bomb") {
          for (const side of ["left", "right"] as const) {
            const half = makeHalf(kind, RADIUS[kind], side);
            try {
              textures[`${kind}_${side}`] = app.renderer.generateTexture(half);
            } finally {
              half.destroy();
            }
          }
        }
      }

      if (!cancelled) {
        texturesRef.current = textures;
        setTexturesReady(true);
      } else {
        // Destroy textures if cancelled before mount completes
        Object.values(textures).forEach((tex) => {
          try {
            tex.destroy(true);
          } catch (e) {
            // ignore
          }
        });
      }
    } catch (error) {
      console.error("Failed to generate fruit textures", error);
      // Clean up partially generated textures
      Object.values(textures).forEach((tex) => {
        try {
          tex.destroy(true);
        } catch (e) {
          // ignore
        }
      });
      setTexturesReady(false);
      return;
    }

    return () => {
      cancelled = true;
      Object.values(texturesRef.current).forEach((tex) => {
        try {
          tex.destroy(true);
        } catch (e) {
          // ignore
        }
      });
      texturesRef.current = {};
      setTexturesReady(false);
    };
  }, [appReady, appRef]);

  return { texturesRef, texturesReady };
}
