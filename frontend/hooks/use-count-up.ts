"use client";

import { useEffect, useRef, useState } from "react";

const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

/**
 * Animated counter.
 *
 * Tweens from the currently displayed value to the target whenever the target
 * changes, so switching scenes or running a simulation animates old → new
 * rather than snapping back to zero.
 *
 * Deliberately NOT gated on an in-view check: a counter that is off-screen when
 * it mounts would otherwise stay pinned at 0 and display a wrong number the
 * moment the user scrolls to it. Correctness beats the scroll-triggered flourish.
 */
export function useCountUp(target: number, duration = 1400, decimals = 0) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(0);
  const displayed = useRef(0);
  const frame = useRef<number | undefined>(undefined);

  useEffect(() => {
    const from = displayed.current;
    if (from === target) return;

    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const next = from + (target - from) * easeOutExpo(t);
      displayed.current = next;
      setValue(Number(next.toFixed(decimals)));
      if (t < 1) {
        frame.current = requestAnimationFrame(tick);
      } else {
        displayed.current = target;
        setValue(target);
      }
    };

    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [target, duration, decimals]);

  return { ref, value };
}
