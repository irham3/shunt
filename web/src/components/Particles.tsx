import { useEffect, useRef } from "react";

/**
 * Lightweight canvas particle field — a hand-rolled take on the
 * reactbits.dev "Particles" / "Dot Grid" background-studio effect, redrawn
 * from scratch (no package) to match Shunt's restrained motion language:
 * slow drift, no bounce, brand accent colors only, and a network/ledger feel
 * that fits a data-visualization-first fintech brand better than a generic
 * starfield. Respects prefers-reduced-motion (renders one static frame) and
 * pauses the animation loop while the tab isn't visible.
 */
const COLORS = ["190,242,100", "56,189,248", "167,139,250"]; // lime, blue, violet — rgb triplets

interface Dot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
}

export function Particles({ density = 0.00009 }: { density?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let dots: Dot[] = [];
    let raf = 0;
    let width = 0;
    let height = 0;

    function seed() {
      const parent = canvas!.parentElement;
      width = parent?.clientWidth ?? window.innerWidth;
      height = parent?.clientHeight ?? window.innerHeight;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.round(width * height * density);
      dots = Array.from({ length: Math.max(18, Math.min(count, 90)) }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        r: Math.random() * 1.4 + 0.8,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      }));
    }

    function frame() {
      ctx!.clearRect(0, 0, width, height);

      // Faint connective lines between nearby dots — the "one income, many
      // lanes" motif read as a network rather than noise.
      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const a = dots[i];
          const b = dots[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx!.strokeStyle = `rgba(197, 205, 216, ${0.08 * (1 - dist / 120)})`;
            ctx!.lineWidth = 1;
            ctx!.beginPath();
            ctx!.moveTo(a.x, a.y);
            ctx!.lineTo(b.x, b.y);
            ctx!.stroke();
          }
        }
      }

      for (const d of dots) {
        if (!reduceMotion) {
          d.x += d.vx;
          d.y += d.vy;
          if (d.x < -10) d.x = width + 10;
          if (d.x > width + 10) d.x = -10;
          if (d.y < -10) d.y = height + 10;
          if (d.y > height + 10) d.y = -10;
        }
        ctx!.fillStyle = `rgba(${d.color}, 0.7)`;
        ctx!.beginPath();
        ctx!.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx!.fill();
      }

      if (!reduceMotion) raf = requestAnimationFrame(frame);
    }

    function onVisibility() {
      if (document.hidden) {
        cancelAnimationFrame(raf);
      } else if (!reduceMotion) {
        raf = requestAnimationFrame(frame);
      }
    }

    seed();
    frame();
    if (!reduceMotion) document.addEventListener("visibilitychange", onVisibility);

    const onResize = () => seed();
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [density]);

  return <canvas ref={canvasRef} className="ab-particles" aria-hidden />;
}
