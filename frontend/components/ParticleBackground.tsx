"use client";
import { useEffect, useRef } from "react";

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  size: number; alpha: number;
  orbital: boolean;
  ox: number; oy: number; or: number; oa: number; os: number;
}

const COUNT     = 95;
const LINK_DIST = 105;
const MOUSE_R   = 150;

export default function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouse     = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext("2d")!;
    let raf: number;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", (e) => { mouse.current = { x: e.clientX, y: e.clientY }; });

    const particles: Particle[] = Array.from({ length: COUNT }, (_, i) => {
      const orbital = i < COUNT * 0.2;
      if (orbital) {
        const ox = Math.random() * canvas.width;
        const oy = Math.random() * canvas.height;
        const or = 30 + Math.random() * 85;
        const oa = Math.random() * Math.PI * 2;
        return {
          x: ox + Math.cos(oa) * or, y: oy + Math.sin(oa) * or,
          vx: 0, vy: 0,
          size: Math.random() * 0.9 + 0.4,
          alpha: Math.random() * 0.28 + 0.12,
          orbital: true, ox, oy, or, oa, os: (Math.random() - 0.5) * 0.007,
        };
      }
      return {
        x: Math.random() * canvas.width, y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.22, vy: (Math.random() - 0.5) * 0.22,
        size: Math.random() * 1.1 + 0.3,
        alpha: Math.random() * 0.3 + 0.08,
        orbital: false, ox: 0, oy: 0, or: 0, oa: 0, os: 0,
      };
    });

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const { x: mx, y: my } = mouse.current;

      for (const p of particles) {
        if (p.orbital) {
          p.oa += p.os;
          p.x = p.ox + Math.cos(p.oa) * p.or;
          p.y = p.oy + Math.sin(p.oa) * p.or;
        } else {
          const dx = mx - p.x, dy = my - p.y;
          const d  = Math.sqrt(dx * dx + dy * dy);
          if (d < MOUSE_R && d > 1) {
            const f = (1 - d / MOUSE_R) * 0.01;
            p.vx += (dx / d) * f;
            p.vy += (dy / d) * f;
          }
          p.vx *= 0.986; p.vy *= 0.986;
          p.x += p.vx; p.y += p.vy;
          if (p.x < 0 || p.x > canvas.width)  p.vx *= -1;
          if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${p.alpha})`;
        ctx.fill();
      }

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx   = particles[i].x - particles[j].x;
          const dy   = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < LINK_DIST) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(255,255,255,${0.055 * (1 - dist / LINK_DIST)})`;
            ctx.lineWidth   = 0.5;
            ctx.stroke();
          }
        }
      }

      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
