"use client";

import { useMemo } from "react";

/**
 * Deterministic starfield — seeded so server and client render identical
 * positions (Math.random here would cause hydration mismatch).
 */
export function Starfield({ count = 90, className }: { count?: number; className?: string }) {
  const stars = useMemo(() => {
    let seed = 20260808;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    return Array.from({ length: count }, () => ({
      left: rnd() * 100,
      top: rnd() * 100,
      size: 0.6 + rnd() * 1.8,
      opacity: 0.15 + rnd() * 0.6,
      delay: rnd() * 6,
      duration: 2.5 + rnd() * 4,
    }));
  }, [count]);

  return (
    <div className={className} aria-hidden>
      {stars.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            opacity: s.opacity,
            animation: `twinkle ${s.duration}s ease-in-out ${s.delay}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.12; transform: scale(0.8); }
          50%      { opacity: 0.85; transform: scale(1.15); }
        }
      `}</style>
    </div>
  );
}
