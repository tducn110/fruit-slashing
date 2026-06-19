import { useEffect, useRef } from "react";
import { AnimatedSprite, Application, Assets, type Spritesheet } from "pixi.js";

export function HeroPeanutAnimation() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    const app = new Application();

    void app.init({
      width: 384,
      height: 512,
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    }).then(async () => {
      if (cancelled) {
        app.destroy(true);
        return;
      }

      host.appendChild(app.canvas);
      Object.assign(app.canvas.style, {
        width: "100%",
        height: "100%",
        display: "block",
      });

      const sheet = await Assets.load<Spritesheet>("/assets/peanut_idle_wave_spritesheet.json");
      if (cancelled) return;

      const frames = [
        sheet.textures["peanut_idle_wave_00.png"],
        sheet.textures["peanut_idle_wave_01.png"],
        sheet.textures["peanut_idle_wave_00.png"],
        sheet.textures["peanut_idle_wave_04.png"],
        sheet.textures["peanut_idle_wave_05.png"],
        sheet.textures["peanut_idle_wave_04.png"],
      ].filter(Boolean);
      if (!frames?.length) {
        throw new Error("idle_wave animation is missing from peanut sprite sheet");
      }

      const frameOffsets = [
        { x: 0, y: 0 },
        { x: 6, y: -3 },
        { x: 0, y: 0 },
        { x: 0, y: 2 },
        { x: 6, y: -2 },
        { x: 0, y: 2 },
      ];

      const peanut = new AnimatedSprite(frames);
      peanut.animationSpeed = 0.16;
      peanut.loop = true;
      peanut.roundPixels = true;
      peanut.onFrameChange = (frame) => {
        const offset = frameOffsets[frame] ?? frameOffsets[0];
        peanut.position.set(offset.x, offset.y);
      };
      peanut.play();
      app.stage.addChild(peanut);
    }).catch((error) => console.error("Hero peanut animation failed to load", error));

    return () => {
      cancelled = true;
      app.destroy(true, { children: true });
    };
  }, []);

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      style={{
        position: "absolute",
        left: "clamp(8px, 4vw, 72px)",
        bottom: "clamp(16px, 4vh, 48px)",
        width: "clamp(150px, 22vw, 270px)",
        aspectRatio: "3 / 4",
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 1,
      }}
    />
  );
}
