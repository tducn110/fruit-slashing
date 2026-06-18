import { type Container, Sprite, type Texture } from "pixi.js";
import { type SliceResult, WORLD_WIDTH, WORLD_HEIGHT } from "../../../game/core";
import { type Particle, COLORS } from "../../../utils/fruit-utils";

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
  triggerBombFeedback: (screen: { x: number; y: number }) => void;
  triggerPointFeedback: (input: { x: number; y: number; text: string; color: string }) => void;
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
  function renderScale(): number {
    return Math.min(sizeRef.current.w / WORLD_WIDTH, sizeRef.current.h / WORLD_HEIGHT);
  }

  function worldToScreen(x: number, y: number) {
    return {
      x: (x - WORLD_WIDTH / 2) * renderScale() + sizeRef.current.w / 2,
      y: (y - WORLD_HEIGHT / 2) * renderScale() + sizeRef.current.h / 2,
    };
  }

  function spawnSplat(x: number, y: number, color: number, count: number, size: number) {
    const layer = playLayerRef.current;
    if (!layer) return;
    for (let index = 0; index < count; index += 1) {
      const particle = new Sprite(texturesRef.current.circle);
      particle.anchor.set(0.5);
      particle.tint = color;
      const radius = size * (0.4 + Math.random() * 0.9);
      particle.width = radius * 2;
      particle.height = radius * 2;
      particle.position.set(x, y);
      layer.addChild(particle);
      const angle = Math.random() * Math.PI * 2;
      const speed = 100 + Math.random() * 220;
      const ttl = 0.6 + Math.random() * 0.3;
      addParticle({
        g: particle,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 80,
        rot: 0,
        vr: 0,
        life: ttl,
        ttl,
        rotates: false,
      });
    }
  }

  function showSliceEffect(result: SliceResult, direction: { dx: number; dy: number }) {
    const layer = playLayerRef.current;
    if (!layer) return;
    const screen = worldToScreen(result.fruit.x, result.fruit.y);
    if (result.fruit.kind === "bomb") {
      spawnSplat(screen.x, screen.y, 0xff5a2a, 80, 8);
      spawnSplat(screen.x, screen.y, 0xffe66a, 40, 6);
      spawnSplat(screen.x, screen.y, 0x1f1f1f, 30, 10);
      triggerBombFeedback(screen);
      if (!callbacksRef.current.muted) callbacksRef.current.onPlayBomb?.();
      return;
    }

    const angle = Math.atan2(direction.dy, direction.dx);
    const perpendicular = angle + Math.PI / 2;
    const splitSpeed = 220;
    const scale = renderScale();
    (["left", "right"] as const).forEach((side, index) => {
      const g = new Sprite(texturesRef.current[`${result.fruit.kind}_${side}`]);
      g.anchor.set(0.5);
      g.position.set(screen.x, screen.y);
      g.rotation = result.fruit.rotation;
      g.scale.set(scale);
      const vr = (Math.random() - 0.5) * 10;
      layer.addChild(g);
      addParticle({
        g,
        vx: result.fruit.vx * (sizeRef.current.w / WORLD_WIDTH) + Math.cos(perpendicular) * splitSpeed * (index === 0 ? -1 : 1),
        vy: result.fruit.vy * (sizeRef.current.h / WORLD_HEIGHT) + Math.sin(perpendicular) * splitSpeed * (index === 0 ? -1 : 1) - 80,
        rot: result.fruit.rotation,
        vr,
        life: 1,
        ttl: 1,
        rotates: true,
      });
    });
    spawnSplat(screen.x, screen.y, COLORS[result.fruit.kind].flesh, 45, 5);
    spawnSplat(screen.x, screen.y, COLORS[result.fruit.kind].body, 15, 3);
    triggerPointFeedback({
      x: screen.x,
      y: screen.y,
      text: result.fruit.kind === "peanut" ? `+${result.points} SIÊU HIẾM!` : `+${result.points}`,
      color: result.fruit.kind === "peanut" ? "var(--mascot-yellow)" : "var(--primary)",
    });
    if (!callbacksRef.current.muted) callbacksRef.current.onPlaySlice?.();
  }

  return { showSliceEffect };
}
