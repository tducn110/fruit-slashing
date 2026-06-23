import { useEffect, useRef } from "react";
import { ParticleContainer, Particle as PixiParticle, Rectangle, Texture } from "pixi.js";
import { type Particle } from "./fruitVisuals";

export interface SplatConfig {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: number;
  size: number;
  ttl: number;
}

export function useParticleSystem() {
  const particlesRef = useRef<Particle[]>([]);
  const splatsRef = useRef<{ p: PixiParticle; vx: number; vy: number; life: number; ttl: number }[]>([]);
  const containerRef = useRef<ParticleContainer | null>(null);

  function destroyParticle(particle: Particle) {
    const display = particle.g;
    if (!display) return;
    try {
      if (display.parent) display.parent.removeChild(display);
      if (!display.destroyed) display.destroy({ children: true, texture: false, textureSource: false });
    } catch {}
  }

  function addParticle(particle: Particle) {
    if (particle.g.destroyed || !particle.g.parent) return;
    particlesRef.current.push(particle);
  }

  function addSplat(config: SplatConfig, texture: Texture, layer: any) {
    if (!containerRef.current) {
      containerRef.current = new ParticleContainer({
        texture,
        dynamicProperties: { position: true, color: true, vertex: true, rotation: false, uvs: false },
        boundsArea: new Rectangle(-1000, -1000, 4000, 3000),
      });
      layer.addChild(containerRef.current);
    }
    const pc = containerRef.current;
    if (pc.parent !== layer) {
      layer.addChild(pc);
    }

    const p = new PixiParticle(texture);
    p.x = config.x;
    p.y = config.y;
    const s = config.size / texture.width;
    p.scaleX = s;
    p.scaleY = s;
    p.anchorX = 0.5;
    p.anchorY = 0.5;
    p.tint = config.color;
    p.alpha = 1;
    
    pc.addParticle(p);
    splatsRef.current.push({ p, vx: config.vx, vy: config.vy, life: config.ttl, ttl: config.ttl });
  }

  function updateParticles(deltaSeconds: number, viewportHeight: number) {
    // Standard particles
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
      const p = particlesRef.current[i];
      if (p.g.destroyed || !p.g.parent) {
        particlesRef.current.splice(i, 1);
        continue;
      }
      p.vy += 1000 * (p.rotates ? 1 : 0.5) * deltaSeconds;
      p.g.x += p.vx * deltaSeconds;
      p.g.y += p.vy * deltaSeconds;
      if (p.rotates) {
        p.rot += p.vr * deltaSeconds;
        p.g.rotation = p.rot;
      }
      p.life -= deltaSeconds;
      p.g.alpha = Math.max(0, p.life / p.ttl);
      if (p.life <= 0 || p.g.y > viewportHeight + 100) {
        destroyParticle(p);
        particlesRef.current.splice(i, 1);
      }
    }

    // Splats (ParticleContainer)
    let needsUpdate = false;
    const pc = containerRef.current;
    for (let i = splatsRef.current.length - 1; i >= 0; i--) {
      const s = splatsRef.current[i];
      s.vy += 500 * deltaSeconds; // gravity for splats
      s.p.x += s.vx * deltaSeconds;
      s.p.y += s.vy * deltaSeconds;
      s.life -= deltaSeconds;
      s.p.alpha = Math.max(0, s.life / s.ttl);
      
      if (s.life <= 0 || s.p.y > viewportHeight + 100) {
        if (pc) pc.removeParticle(s.p);
        splatsRef.current.splice(i, 1);
      }
      needsUpdate = true;
    }
    if (pc && needsUpdate) {
      pc.update();
    }
  }

  function clearParticles() {
    particlesRef.current.forEach((particle) => destroyParticle(particle));
    particlesRef.current = [];
    if (containerRef.current) {
      containerRef.current.particleChildren.length = 0;
      containerRef.current.update();
    }
    splatsRef.current = [];
  }

  useEffect(() => {
    return () => clearParticles();
  }, []);

  return { addParticle, addSplat, updateParticles, clearParticles };
}
