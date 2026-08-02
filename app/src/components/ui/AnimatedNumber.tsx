// components/ui/AnimatedNumber.tsx
// Animates a number counting up/down to its new value whenever it
// changes, instead of snapping instantly. Used on stat card values so
// live updates (socket events, periodic refresh) read as "alive"
// rather than static — motion instead of more color, in keeping with
// the calmer palette the rest of the app has moved toward.
//
// Does NOT animate on first mount — only on subsequent changes, so the
// initial page load doesn't count up from zero (which reads as slow,
// not delightful).

import { useEffect, useRef, useState } from 'react';

interface AnimatedNumberProps {
  value: number;
  format?: (n: number) => string;
  duration?: number;
}

export default function AnimatedNumber({
  value,
  format = (n) => n.toLocaleString(),
  duration = 600,
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(value);
  const prevValue = useRef(value);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const from = prevValue.current;
    const to = value;
    if (from === to) return;

    const start = performance.now();

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplay(from + (to - from) * eased);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        prevValue.current = to;
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  return <>{format(display)}</>;
}
