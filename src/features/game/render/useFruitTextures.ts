import { useEffect, useRef, useState } from "react";
import { Application, Graphics, Texture } from "pixi.js";
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
    if (!appReady || !appRef.current) return;

    const app = appRef.current;
    const textures: Record<string, Texture> = {};

    const circle = new Graphics().circle(0, 0, 10).fill(0xffffff);
    textures.circle = app.renderer.generateTexture(circle);
    circle.destroy();

    for (const kind of FRUIT_KINDS) {
      const full = makeFruit(kind, RADIUS[kind]);
      textures[kind] = app.renderer.generateTexture(full);
      full.destroy();

      if (kind !== "bomb") {
        for (const side of ["left", "right"] as const) {
          const half = makeHalf(kind, RADIUS[kind], side);
          textures[`${kind}_${side}`] = app.renderer.generateTexture(half);
          half.destroy();
        }
      }
    }

    texturesRef.current = textures;
    setTexturesReady(true);

    return () => {
      for (const tex of Object.values(texturesRef.current)) {
        tex.destroy(true);
      }
      texturesRef.current = {};
      setTexturesReady(false);
    };
  }, [appReady, appRef]);

  return { texturesRef, texturesReady };
}
