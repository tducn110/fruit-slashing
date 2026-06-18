import { useEffect, useRef, useState } from "react";
import { Application, Container, Graphics, Sprite } from "pixi.js";
import { drawBackground } from "../../../utils/fruit-utils";

export function usePixiApp() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const playLayerRef = useRef<Container | null>(null);
  const trailGraphicsRef = useRef<Graphics | null>(null);
  const sizeRef = useRef({ w: 800, h: 450 });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const wrap = wrapRef.current;
    if (!wrap) return;

    const app = new Application();
    const width = Math.max(320, wrap.clientWidth || 800);
    const height = Math.max(200, wrap.clientHeight || 450);
    sizeRef.current = { w: width, h: height };

    const resizeObserver = new ResizeObserver(() => {
      if (!appRef.current) return;
      const nextWidth = Math.max(320, wrap.clientWidth);
      const nextHeight = Math.max(200, wrap.clientHeight);
      if (nextWidth === sizeRef.current.w && nextHeight === sizeRef.current.h) return;
      sizeRef.current = { w: nextWidth, h: nextHeight };
      appRef.current.renderer.resize(nextWidth, nextHeight);
      
      const backgroundLayer = appRef.current.stage.children[0] as Container;
      if (backgroundLayer) {
        backgroundLayer.removeChildren().forEach((child) => child.destroy());
        const background = new Container();
        drawBackground(background, nextWidth, nextHeight);
        backgroundLayer.addChild(new Sprite(appRef.current.renderer.generateTexture(background)));
        background.destroy({ children: true });
      }
    });

    app.init({ width, height, background: 0xf5ecd7, antialias: true, resolution: window.devicePixelRatio || 1, autoDensity: true })
      .then(() => {
        if (cancelled) {
          app.destroy(true);
          return;
        }
        appRef.current = app;
        wrap.appendChild(app.canvas);
        Object.assign(app.canvas.style, { display: "block", width: "100%", height: "100%", touchAction: "none", cursor: "crosshair" });

        const backgroundLayer = new Container();
        const background = new Container();
        drawBackground(background, width, height);
        backgroundLayer.addChild(new Sprite(app.renderer.generateTexture(background)));
        background.destroy({ children: true });
        app.stage.addChild(backgroundLayer);

        const playLayer = new Container();
        app.stage.addChild(playLayer);
        playLayerRef.current = playLayer;

        const trailGraphics = new Graphics();
        app.stage.addChild(trailGraphics);
        trailGraphicsRef.current = trailGraphics;

        resizeObserver.observe(wrap);
        setReady(true);
      })
      .catch((error) => console.error("Pixi init failed", error));

    return () => {
      cancelled = true;
      resizeObserver.disconnect();
      app.destroy(true, { children: true });
      appRef.current = null;
      playLayerRef.current = null;
      trailGraphicsRef.current = null;
      setReady(false);
    };
  }, []);

  return { wrapRef, appRef, sizeRef, playLayerRef, trailGraphicsRef, ready };
}
