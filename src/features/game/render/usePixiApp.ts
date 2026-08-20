import { useEffect, useRef, useState } from "react";
import { Application, Container, Graphics, Sprite } from "pixi.js";
import { drawBackground } from "./fruitVisuals";
import { getFxPreset } from "./fxPreset";

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
    let resizeFrame = 0;

    const preset = getFxPreset(width);
    const resolution = Math.min(window.devicePixelRatio || 1, preset.resolutionCap);

    function redrawBackground(nextWidth: number, nextHeight: number) {
      const backgroundLayer = backgroundLayerRef.current;
      if (!backgroundLayer) return;

      backgroundLayer.children.forEach((child) => child.destroy({ children: true }));
      backgroundLayer.removeChildren();

      drawBackground(backgroundLayer, nextWidth, nextHeight);
    }

    const applyResize = () => {
      resizeFrame = 0;
      if (cancelled || !appRef.current) return;
      const nextWidth = Math.max(320, wrap.clientWidth);
      const nextHeight = Math.max(200, wrap.clientHeight);
      if (nextWidth === sizeRef.current.w && nextHeight === sizeRef.current.h) return;
      sizeRef.current = { w: nextWidth, h: nextHeight };
      appRef.current.renderer.resize(nextWidth, nextHeight);
      redrawBackground(nextWidth, nextHeight);
    };

    const scheduleResize = () => {
      if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(applyResize);
    };

    const resizeObserver = new ResizeObserver(scheduleResize);

    app.init({
      width,
      height,
      background: 0xf5ecd7,
      antialias: preset.antialias,
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
        drawBackground(backgroundLayer, width, height);
        app.stage.addChild(backgroundLayer);
        backgroundLayerRef.current = backgroundLayer;

        const playLayer = new Container();
        app.stage.addChild(playLayer);
        playLayerRef.current = playLayer;

        const trailGraphics = new Graphics();
        app.stage.addChild(trailGraphics);
        trailGraphicsRef.current = trailGraphics;

        resizeObserver.observe(wrap);
        window.visualViewport?.addEventListener("resize", scheduleResize, { passive: true });
        window.addEventListener("orientationchange", scheduleResize);
        setReady(true);
      })
      .catch((error) => console.error("Pixi init failed", error));

    return () => {
      cancelled = true;
      resizeObserver.disconnect();
      if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
      window.visualViewport?.removeEventListener("resize", scheduleResize);
      window.removeEventListener("orientationchange", scheduleResize);

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
