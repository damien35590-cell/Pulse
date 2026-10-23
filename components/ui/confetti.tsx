"use client";

import { useEffect, useRef } from "react";

type Part = { x: number; y: number; vx: number; vy: number; r: number; vr: number; w: number; h: number; c: string; life: number; round: boolean };

/**
 * Explosion de confettis sur <canvas>, sans dépendance. Se déclenche à chaque changement de `burst` (> 0),
 * depuis le centre de l'élément `origin`. Canvas plein écran en position fixe : à placer dans le <dialog> pour passer au-dessus du voile.
 * Désactivé si l'utilisateur a demandé moins d'animations.
 */
export function Confetti({ burst, origin, colors, count = 90 }: {
  burst: number; origin: React.RefObject<HTMLElement>; colors: string[]; count?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const parts = useRef<Part[]>([]);
  const raf = useRef(0);
  const last = useRef(0);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  useEffect(() => {
    if (!burst || burst === last.current) return;
    last.current = burst;
    const cv = ref.current, o = origin.current;
    if (!cv || !o || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1), cr = cv.getBoundingClientRect();
    cv.width = cr.width * dpr; cv.height = cr.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Les tokens sont des triplets RGB (« 252 76 2 ») : on lit l'orange du thème plutôt que de le coder en dur.
    const brand = getComputedStyle(document.documentElement).getPropertyValue("--brand").trim();
    const palette = brand ? [...colors, `rgb(${brand})`] : colors;
    const or = o.getBoundingClientRect(), ox = or.left + or.width / 2 - cr.left, oy = or.top + or.height / 2 - cr.top;
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4, s = 5 + Math.random() * 10;
      parts.current.push({
        x: ox, y: oy, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.5,
        w: 6 + Math.random() * 6, h: 4 + Math.random() * 6, c: palette[i % palette.length], life: 1, round: Math.random() < 0.3,
      });
    }
    cancelAnimationFrame(raf.current);
    const step = () => {
      ctx.clearRect(0, 0, cr.width, cr.height);
      parts.current = parts.current.filter((p) => p.life > 0 && p.y < cr.height + 20);
      for (const p of parts.current) {
        p.vx *= 0.985; p.vy = p.vy * 0.985 + 0.3; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life -= 0.007;
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.6));
        ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c;
        if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.w / 2.5, 0, 6.28); ctx.fill(); }
        else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)) + 1); // effet de papier qui tourne
        ctx.restore();
      }
      if (parts.current.length) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  }, [burst, origin, colors, count]);

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-10 h-dvh w-full" />;
}
