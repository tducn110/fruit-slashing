import { useEffect, useRef } from "react";
import { type Particle } from "../../../utils/fruit-utils";

export function useParticleSystem() {
  const particlesRef = useRef<Particle[]>([]);

  function addParticle(particle: Particle) {
    particlesRef.current.push(particle);
  }

  function updateParticles(deltaSeconds: number, viewportHeight: number) {
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
      const p = particlesRef.current[i];
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
        p.g.destroy();
        particlesRef.current.splice(i, 1);
      }
    }
  }

  function clearParticles() {
    particlesRef.current.forEach((p) => p.g.destroy());
    particlesRef.current = [];
  }

  useEffect(() => {
    return () => {
      clearParticles();
    };
  }, []);

  return { addParticle, updateParticles, clearParticles };
}
