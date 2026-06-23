import { useEffect, useRef } from "react";
import { type Particle } from "./fruitVisuals";

export function useParticleSystem() {
  const particlesRef = useRef<Particle[]>([]);

  function destroyParticle(particle: Particle) {
    const display = particle.g;

    if (!display) {
      return;
    }

    try {
      if (display.parent) {
        display.parent.removeChild(display);
      }
    } catch {
      // Ignore teardown races with Pixi unmount/replay cleanup.
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
      // Ignore already-destroyed display objects during cleanup.
    }
  }

  function addParticle(particle: Particle) {
    if (particle.g.destroyed) {
      return;
    }

    if (!particle.g.parent) {
      return;
    }

    particlesRef.current.push(particle);
  }

  function updateParticles(deltaSeconds: number, viewportHeight: number) {
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
  }

  function clearParticles() {
    particlesRef.current.forEach((particle) => destroyParticle(particle));
    particlesRef.current = [];
  }

  useEffect(() => {
    return () => {
      clearParticles();
    };
  }, []);

  return { addParticle, updateParticles, clearParticles };
}
