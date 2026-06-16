import { Graphics, Container } from "pixi.js";

export type FruitKind = "durian" | "lychee" | "banana" | "dragonfruit" | "mango" | "bomb";

export interface Fruit {
  kind: FruitKind;
  g: Container;
  vx: number; vy: number;
  rot: number; vr: number;
  r: number;
  sliced: boolean;
}

export interface Particle {
  g: Container;
  vx: number; vy: number;
  rot: number; vr: number;
  life: number;
  ttl: number;
  rotates: boolean;
}

export interface TrailPoint { x: number; y: number; t: number; }

export interface FruitConfig {
  points: number;
  radius: number;
  colors: { body: number; edge: number; flesh: number };
  drawFull: (g: Graphics, r: number, colors: { body: number; edge: number; flesh: number }) => void;
  drawHalf: (g: Graphics, r: number, colors: { body: number; edge: number; flesh: number }, side: "left" | "right") => void;
}

function defaultDrawHalf(g: Graphics, r: number, c: { body: number; edge: number; flesh: number }, side: "left" | "right") {
  const sign = side === "left" ? -1 : 1;
  g.moveTo(0, -r);
  g.bezierCurveTo(sign * r * 1.1, -r, sign * r * 1.1, r, 0, r);
  g.lineTo(0, -r);
  g.fill(c.body).stroke({ color: c.edge, width: 2 });
  g.rect(sign === -1 ? -3 : 0, -r, 3, r * 2).fill(c.flesh);
}

const FRUIT_REGISTRY: Record<FruitKind, FruitConfig> = {
  durian: {
    points: 5,
    radius: 38,
    colors: { body: 0xc8b84a, edge: 0x6b7a1f, flesh: 0xfff5a0 },
    drawFull: (g, r, c) => {
      g.ellipse(0, 0, r * 0.82, r).fill(c.body).stroke({ color: c.edge, width: 2 });
      const spikeCount = 16;
      for (let i = 0; i < spikeCount; i++) {
        const a = (i / spikeCount) * Math.PI * 2;
        const bx = Math.cos(a) * r * 0.78;
        const by = Math.sin(a) * r * 0.95;
        const tx = Math.cos(a) * (r * 1.18);
        const ty = Math.sin(a) * (r * 1.38);
        g.moveTo(bx, by).lineTo(tx, ty).stroke({ color: c.edge, width: 1.8, cap: "round" });
      }
      g.rect(-r * 0.07, -r * 1.38, r * 0.14, r * 0.28).fill(0x5a3a10);
      g.ellipse(-r * 0.25, -r * 0.35, r * 0.22, r * 0.13).fill({ color: 0xffffff, alpha: 0.22 });
    },
    drawHalf: defaultDrawHalf
  },
  lychee: {
    points: 3,
    radius: 26,
    colors: { body: 0xe83050, edge: 0x7a1030, flesh: 0xfff0f4 },
    drawFull: (g, r, c) => {
      g.circle(0, 0, r).fill(c.body).stroke({ color: c.edge, width: 2 });
      const bumpCount = 12;
      for (let i = 0; i < bumpCount; i++) {
        const a = (i / bumpCount) * Math.PI * 2;
        g.circle(Math.cos(a) * r * 0.74, Math.sin(a) * r * 0.74, r * 0.11).fill({ color: c.edge, alpha: 0.35 });
      }
      g.circle(-r * 0.32, -r * 0.32, r * 0.2).fill({ color: 0xffffff, alpha: 0.28 });
      g.circle(0, -r * 0.9, r * 0.12).fill(0x5a3a10);
    },
    drawHalf: defaultDrawHalf
  },
  banana: {
    points: 2,
    radius: 34,
    colors: { body: 0xf5c842, edge: 0xb89020, flesh: 0xfff099 },
    drawFull: (g, r, c) => {
      g.moveTo(-r * 0.7, r * 0.4)
        .quadraticCurveTo(-r * 0.5, -r * 0.95, r * 0.75, -r * 0.4)
        .quadraticCurveTo(r * 0.45, r * 0.05, r * 0.55, r * 0.55)
        .quadraticCurveTo(-r * 0.15, r * 0.1, -r * 0.7, r * 0.4)
        .fill(c.body).stroke({ color: c.edge, width: 2 });
      g.circle(-r * 0.65, r * 0.42, r * 0.1).fill(c.edge);
    },
    drawHalf: defaultDrawHalf
  },
  dragonfruit: {
    points: 4,
    radius: 34,
    colors: { body: 0xe8537c, edge: 0x7a1f3a, flesh: 0xfff0f4 },
    drawFull: (g, r, c) => {
      g.circle(0, 0, r * 0.92).fill(c.body).stroke({ color: c.edge, width: 2 });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        g.ellipse(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7, r * 0.22, r * 0.1).fill(0x8fc24a);
      }
    },
    drawHalf: defaultDrawHalf
  },
  mango: {
    points: 2,
    radius: 34,
    colors: { body: 0xf0a830, edge: 0x8e5a0a, flesh: 0xffe0a0 },
    drawFull: (g, r, c) => {
      g.moveTo(0, -r)
        .bezierCurveTo(r * 0.6, -r * 0.8, r * 0.95, -r * 0.1, r * 0.8, r * 0.55)
        .bezierCurveTo(r * 0.55, r, -r * 0.55, r, -r * 0.8, r * 0.55)
        .bezierCurveTo(-r * 0.95, -r * 0.1, -r * 0.6, -r * 0.8, 0, -r)
        .fill(c.body).stroke({ color: c.edge, width: 2 });
      g.ellipse(r * 0.25, -r * 0.2, r * 0.38, r * 0.28).fill({ color: 0xe84030, alpha: 0.28 });
      g.ellipse(-r * 0.28, -r * 0.3, r * 0.2, r * 0.12).fill({ color: 0xffffff, alpha: 0.25 });
      g.rect(-r * 0.06, -r * 1.15, r * 0.12, r * 0.22).fill(0x5a3a10);
    },
    drawHalf: defaultDrawHalf
  },
  bomb: {
    points: 0,
    radius: 30,
    colors: { body: 0x1f1f1f, edge: 0x000000, flesh: 0xff5a2a },
    drawFull: (g, r, c) => {
      g.circle(0, 0, r).fill(c.body).stroke({ color: 0x000, width: 2 });
      g.circle(-r * 0.3, -r * 0.3, r * 0.18).fill({ color: 0xffffff, alpha: 0.22 });
      g.rect(-r * 0.12, -r * 1.25, r * 0.24, r * 0.3).fill(0x6b4a2a);
      g.circle(0, -r * 1.35, r * 0.16).fill(0xffaa22);
      g.circle(0, -r * 1.35, r * 0.09).fill(0xffe66a);
    },
    drawHalf: () => {} // Bombs are not splittable into halves
  }
};

// Maintaining export compatibility for old components that rely on COLORS, POINTS, RADIUS
export const COLORS = Object.fromEntries(Object.entries(FRUIT_REGISTRY).map(([k, v]) => [k, v.colors])) as Record<FruitKind, { body: number; edge: number; flesh: number }>;
export const POINTS = Object.fromEntries(Object.entries(FRUIT_REGISTRY).map(([k, v]) => [k, v.points])) as Record<FruitKind, number>;
export const RADIUS = Object.fromEntries(Object.entries(FRUIT_REGISTRY).map(([k, v]) => [k, v.radius])) as Record<FruitKind, number>;

// Factory function
export function makeFruit(kind: FruitKind, r: number): Graphics {
  const g = new Graphics();
  const config = FRUIT_REGISTRY[kind];
  if (config) config.drawFull(g, r, config.colors);
  return g;
}

export function makeHalf(kind: FruitKind, r: number, side: "left" | "right"): Graphics {
  const g = new Graphics();
  const config = FRUIT_REGISTRY[kind];
  if (config) config.drawHalf(g, r, config.colors, side);
  return g;
}

export function drawBackground(c: Container, W: number, H: number) {
  const sky = new Graphics();
  sky.rect(0, 0, W, H).fill(0xf5ecd7);
  c.addChild(sky);

  const hills = new Graphics();
  hills.moveTo(0, H * 0.62)
    .bezierCurveTo(W * 0.2, H * 0.55, W * 0.5, H * 0.68, W, H * 0.6)
    .lineTo(W, H).lineTo(0, H).closePath()
    .fill({ color: 0xe6d8b2, alpha: 0.75 });
  hills.moveTo(0, H * 0.72)
    .bezierCurveTo(W * 0.3, H * 0.65, W * 0.7, H * 0.78, W, H * 0.7)
    .lineTo(W, H).lineTo(0, H).closePath()
    .fill({ color: 0xd8c896, alpha: 0.8 });
  c.addChild(hills);

  const grass = new Graphics();
  grass.moveTo(0, H * 0.85)
    .bezierCurveTo(W * 0.3, H * 0.8, W * 0.7, H * 0.9, W, H * 0.85)
    .lineTo(W, H).lineTo(0, H).closePath()
    .fill(0xc8d68a);
  grass.rect(0, H * 0.94, W, H * 0.06).fill(0x6b8e3d);
  c.addChild(grass);

  const bamboo = new Graphics();
  for (let i = 0; i < 14; i++) {
    const x = (i / 13) * W + (i % 2 === 0 ? 8 : -8);
    const baseY = H * 0.65 + (i % 3) * 8;
    const h = 60 + (i % 4) * 14;
    bamboo.moveTo(x, baseY).quadraticCurveTo(x + 2, baseY - h / 2, x + (i % 2 ? 3 : -3), baseY - h)
      .stroke({ color: 0x6b8e3d, width: 1.4, alpha: 0.5, cap: "round" });
  }
  c.addChild(bamboo);

  const birds = new Graphics();
  for (let i = 0; i < 4; i++) {
    const x = 100 + i * (W / 5);
    const y = 80 + (i % 2) * 26;
    birds.moveTo(x, y).lineTo(x + 6, y - 4).lineTo(x + 12, y)
      .stroke({ color: 0x8a7d65, width: 1.2, alpha: 0.55, cap: "round" });
    birds.moveTo(x + 12, y).lineTo(x + 18, y - 4).lineTo(x + 24, y)
      .stroke({ color: 0x8a7d65, width: 1.2, alpha: 0.55, cap: "round" });
  }
  c.addChild(birds);
}
