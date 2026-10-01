"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
  type MotionValue,
} from "framer-motion";

/**
 * Scroll-reactive reveal for landing sections.
 *
 * - Entrance: a section that comes into view settles from (opacity .65, blur 4px, +20px) to sharp, in both
 *   scroll directions (it is reset only once it has fully left the viewport, so the reset is never visible).
 * - Velocity: while the page is scrolled quickly, sections away from the middle of the viewport pick up a small
 *   blur (≤ 5 px desktop, ≤ 2 px phones) that springs back to 0 as soon as scrolling slows or stops.
 * - Reduced motion: no blur, no movement — children render as plain content.
 * Server HTML is always sharp (nothing is hidden without JavaScript).
 */

const SPEED_FLOOR = 250; // px/s — slower scrolling never blurs
const SPEED_CEIL = 2800; // px/s — blur reaches its cap here
const EASE = [0.22, 1, 0.36, 1] as const;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ScrollSpeed = createContext<MotionValue<number> | null>(null);

export function ScrollBlurProvider({ children }: { children: ReactNode }) {
  const { scrollY } = useScroll();
  const velocity = useVelocity(scrollY);
  const normalised = useTransform(velocity, (v) => clamp01((Math.abs(v) - SPEED_FLOOR) / (SPEED_CEIL - SPEED_FLOOR)));
  const speed = useSpring(normalised, { stiffness: 140, damping: 30, mass: 0.6 });
  return <ScrollSpeed.Provider value={speed}>{children}</ScrollSpeed.Provider>;
}

function useCompact() {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setCompact(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return compact;
}

export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  const compact = useCompact();
  const ref = useRef<HTMLDivElement>(null);
  const speed = useContext(ScrollSpeed);
  const enter = useMotionValue(0); // 0 = settled (sharp), 1 = not yet revealed
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });

  // blur caps live in a motion value so the computed filter below always sees the current breakpoint
  const caps = useMotionValue({ maxBlur: 5, enterBlur: 4, rise: 20 });
  useEffect(() => {
    caps.set(compact ? { maxBlur: 2, enterBlur: 2, rise: 12 } : { maxBlur: 5, enterBlur: 4, rise: 20 });
  }, [caps, compact]);

  useEffect(() => {
    const el = ref.current;
    if (!el || reduce) return;
    let anim: ReturnType<typeof animate> | null = null;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.intersectionRatio >= 0.12) {
          if (enter.get() > 0 && !anim) anim = animate(enter, 0, { duration: 0.7, ease: EASE, onComplete: () => (anim = null) });
        } else if (!entry.isIntersecting) {
          anim?.stop();
          anim = null;
          enter.set(1); // fully off-screen: arm the next entrance
        }
      },
      { threshold: [0, 0.12] },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      anim?.stop();
    };
  }, [enter, reduce]);

  const filter = useTransform(() => {
    const p = scrollYProgress.get();
    const edge = clamp01(Math.abs(p - 0.5) * 2.4 - 0.2); // 0 near the middle of the viewport, 1 at its edges
    const { maxBlur, enterBlur } = caps.get();
    const b = Math.min(maxBlur, enter.get() * enterBlur + (speed?.get() ?? 0) * edge * maxBlur); // never above the cap
    return b < 0.15 ? "none" : `blur(${b.toFixed(2)}px)`;
  });
  const opacity = useTransform(enter, (e) => 1 - e * 0.35);
  const y = useTransform(() => enter.get() * caps.get().rise);

  if (reduce) return <div ref={ref} className={className}>{children}</div>;
  return (
    <motion.div ref={ref} className={className} style={{ filter, opacity, y }}>
      {children}
    </motion.div>
  );
}
