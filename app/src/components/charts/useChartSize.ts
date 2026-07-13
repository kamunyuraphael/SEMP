// components/charts/useChartSize.ts
// Shared hook that measures a chart's actual container width via
// ResizeObserver, so the hand-rolled SVG charts genuinely resize with
// their container — the dependency-free equivalent of recharts'
// <ResponsiveContainer>. Previously each chart used a hardcoded 520px
// viewBox width regardless of the container it was placed in.

import { useEffect, useRef, useState } from 'react';

export function useChartSize<T extends HTMLElement>(defaultWidth = 520) {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(defaultWidth);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const measured = entries[0]?.contentRect.width;
      if (measured && measured > 0) {
        setWidth(measured);
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}
