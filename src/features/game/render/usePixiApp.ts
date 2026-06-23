import { useEffect, useRef, useState } from "react";
import { Application, Container, Graphics, Sprite } from "pixi.js";
import { drawBackground } from "./fruitVisuals";

export function usePixiApp() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const backgroundLayerRef = useRef<Container | null>(null);
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

    // DPR/resolution safety: Cap window.devicePixelRatio at 2
    const resolution = Math.min(window.devicePixelRatio || 1, 2);

    const resizeObserver = new ResizeObserver(() => {
      if (cancelled || !appRef.current) return;
      const nextWidth = Math.max(320, wrap.clientWidth);
      const nextHeight = Math.max(200, wrap.clientHeight);
      if (nextWidth === sizeRef.current.w && nextHeight === sizeRef.current.h) return;
      sizeRef.current = { w: nextWidth, h: nextHeight };
      appRef.current.renderer.resize(nextWidth, nextHeight);
      
      const backgroundLayer = backgroundLayerRef.current;
      if (backgroundLayer && appRef.current) {
        // Clean up old background textures to prevent memory leaks on resize
        backgroundLayer.children.forEach((child) => {
          if (child instanceof Sprite && child.texture) {
            child.texture.destroy(true);
          }
          child.destroy({ children: true });
        });
        backgroundLayer.removeChildren();

        const background = new Container();
        drawBackground(background, nextWidth, nextHeight);
        const texture = appRef.current.renderer.generateTexture(background);
        const sprite = new Sprite(texture);
        backgroundLayer.addChild(sprite);
        background.destroy({ children: true });
      }
    });

    app.init({
      width,
      height,
      background: 0xf5ecd7,
      antialias: true,
      resolution,
      autoDensity: true
    })
      .then(() => {
        if (cancelled) {
          app.destroy({ removeView: true });
          return;
        }
        appRef.current = app;
        wrap.appendChild(app.canvas);
        Object.assign(app.canvas.style, {
          display: "block",
          width: "100%",
          height: "100%",
          touchAction: "none",
          cursor: "crosshair"
        });

        const backgroundLayer = new Container();
        const background = new Container();
        drawBackground(background, width, height);
        const texture = app.renderer.generateTexture(background);
        const sprite = new Sprite(texture);
        backgroundLayer.addChild(sprite);
        background.destroy({ children: true });
        app.stage.addChild(backgroundLayer);
        backgroundLayerRef.current = backgroundLayer;

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

      // Clean up background texture resources to prevent memory leaks on unmount
      const bgLayer = backgroundLayerRef.current;
      if (bgLayer) {
        bgLayer.children.forEach((child) => {
          if (child instanceof Sprite && child.texture) {
            child.texture.destroy(true);
          }
        });
      }

      app.stage.destroy({ children: true });
      app.destroy({ removeView: true });
      appRef.current = null;
      backgroundLayerRef.current = null;
      playLayerRef.current = null;
      trailGraphicsRef.current = null;
      setReady(false);
    };
  }, []);

  return { wrapRef, appRef, sizeRef, playLayerRef, trailGraphicsRef, ready };
}
