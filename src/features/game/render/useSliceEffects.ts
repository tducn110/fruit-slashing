import { type Container, Graphics, Sprite, type Texture } from "pixi.js";
import { type SliceResult, WORLD_WIDTH, WORLD_HEIGHT } from "../../../game/core";
import { FRUIT_COLORS, type Particle } from "./fruitVisuals";

interface Callbacks {
  muted: boolean;
  onPlaySlice?: () => void;
  onPlayBomb?: () => void;
}

interface Props {
  playLayerRef: React.RefObject<Container | null>;
  texturesRef: React.MutableRefObject<Record<string, Texture>>;
  sizeRef: React.MutableRefObject<{ w: number; h: number }>;
  addParticle: (particle: Particle) => void;
  addSplat: (config: any, texture: any, layer: any) => void;
  triggerBombFeedback: (screen: { x: number; y: number }) => void;
  triggerPointFeedback: (input: { x: number; y: number; text: string; color: string; variant?: "points" | "combo" | "critical" }) => void;
  callbacksRef: React.MutableRefObject<Callbacks>;
}

export function useSliceEffects({
  playLayerRef,
  texturesRef,
  sizeRef,
  addParticle,
  triggerBombFeedback,
  triggerPointFeedback,
  callbacksRef,
}: Props) {
  function destroyDisplay(display: Container) {
    try {
      if (display.parent) {
        display.parent.removeChild(display);
      }
    } catch {
      // Ignore teardown races with layer/app cleanup.
    }

    try {
      if (!display.destroyed) {
        display.destroy({
          children: true,
          texture: false,
          textureSource: false,
        });
      }
    } catch {
      // Ignore already-destroyed display objects during failure cleanup.
    }
  }

  function getTexture(key: string): Texture | null {
    return texturesRef.current[key] ?? null;
  }

  function renderScale(): number {
    return Math.min(sizeRef.current.w / WORLD_WIDTH, sizeRef.current.h / WORLD_HEIGHT);
  }

  function worldToScreen(x: number, y: number) {
    return {
      x: (x - WORLD_WIDTH / 2) * renderScale() + sizeRef.current.w / 2,
      y: (y - WORLD_HEIGHT / 2) * renderScale() + sizeRef.current.h / 2,
    };
  }

  function handoffDisplay(
    display: Container,
    particle: Omit<Particle, "g">,
    layer: Container,
  ) {
    try {
      if (display.destroyed) {
        destroyDisplay(display);
        return false;
      }

      layer.addChild(display);
      addParticle({
        g: display,
        ...particle,
      });

      if (display.destroyed || display.parent !== layer) {
        destroyDisplay(display);
        return false;
      }

      return true;
    } catch {
      destroyDisplay(display);
      return false;
    }
  }

  function spawnSplat(x: number, y: number, color: number, count: number, size: number) {
    const layer = playLayerRef.current;
    const circleTexture = getTexture("circle");
    if (!layer || !circleTexture) return;

    for (let index = 0; index < count; index += 1) {
      const radius = size * (0.4 + Math.random() * 0.9);
      const angle = Math.random() * Math.PI * 2;
      const speed = 100 + Math.random() * 220;
      const ttl = 0.6 + Math.random() * 0.3;

      addSplat({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 80,
        color,
        size: radius * 2,
        ttl,
      }, circleTexture, layer);
    }
  }

  function showSliceEffect(result: SliceResult, direction: { dx: number; dy: number }) {
    const layer = playLayerRef.current;
    if (!layer || !result?.fruit) return;

    const screen = worldToScreen(result.fruit.x, result.fruit.y);
    if (result.fruit.kind === "bomb") {
      spawnSplat(screen.x, screen.y, 0xff5a2a, 35, 8);
      spawnSplat(screen.x, screen.y, 0xffe66a, 20, 6);
      spawnSplat(screen.x, screen.y, 0x1f1f1f, 15, 10);
      triggerBombFeedback(screen);
      if (!callbacksRef.current.muted) callbacksRef.current.onPlayBomb?.();
      return;
    }

    const angle = Math.atan2(direction.dy, direction.dx);
    const perpendicular = angle + Math.PI / 2;
    const splitSpeed = 220;
    const scale = renderScale();
    const slashLength = Math.max(120, result.fruit.radius * scale * 4.2);
    const slash = new Graphics();
    slash.moveTo(-slashLength / 2, 0).lineTo(slashLength / 2, 0)
      .stroke({ color: 0xffffff, width: 16, alpha: 0.9, cap: "round" });
    slash.moveTo(-slashLength / 2, 0).lineTo(slashLength / 2, 0)
      .stroke({ color: 0xe87432, width: 7, alpha: 1, cap: "round" });
    slash.position.set(screen.x, screen.y);
    slash.rotation = angle;

    handoffDisplay(slash, {
      vx: 0,
      vy: 0,
      rot: angle,
      vr: 0,
      life: 0.2,
      ttl: 0.2,
      rotates: false,
    }, layer);

    (["left", "right"] as const).forEach((side, index) => {
      const halfTexture = getTexture(`${result.fruit.kind}_${side}`);

      if (!halfTexture) {
        return;
      }

      const g = new Sprite(halfTexture);
      g.anchor.set(0.5);
      g.position.set(screen.x, screen.y);
      g.rotation = result.fruit.rotation;
      g.scale.set(scale);
      const vr = (Math.random() - 0.5) * 10;

      handoffDisplay(g, {
        vx: result.fruit.vx * (sizeRef.current.w / WORLD_WIDTH) + Math.cos(perpendicular) * splitSpeed * (index === 0 ? -1 : 1),
        vy: result.fruit.vy * (sizeRef.current.h / WORLD_HEIGHT) + Math.sin(perpendicular) * splitSpeed * (index === 0 ? -1 : 1) - 80,
        rot: result.fruit.rotation,
        vr,
        life: 1,
        ttl: 1,
        rotates: true,
      }, layer);
    });
    spawnSplat(screen.x, screen.y, FRUIT_COLORS[result.fruit.kind].flesh, 20, 5);
    spawnSplat(screen.x, screen.y, FRUIT_COLORS[result.fruit.kind].body, 8, 3);
    triggerPointFeedback({
      x: screen.x,
      y: screen.y,
      text: result.fruit.kind === "peanut" ? "+" + result.points + " SIÊU HIẾM!" : "+" + result.points,
      color: result.fruit.kind === "peanut" ? "var(--mascot-yellow)" : "var(--primary)",
      variant: "points",
    });

    if (result.combo >= 2) {
      const critical = result.combo >= 5;
      triggerPointFeedback({
        x: screen.x + 74,
        y: screen.y - 18,
        text: (critical ? "CRITICAL" : "COMBO") + " x" + result.combo,
        color: critical ? "var(--destructive)" : "var(--orange-cta)",
        variant: critical ? "critical" : "combo",
      });
    }
    if (!callbacksRef.current.muted) callbacksRef.current.onPlaySlice?.();
  }

  return { showSliceEffect };
}
