// components/ui/Skeleton.tsx
// Reusable shimmering placeholder block for content that's still
// loading. Prefer this over a full-page spinner wherever the eventual
// layout is predictable (stat cards, chart panels, list rows) — it
// reads as "the page is already here, just filling in" rather than
// a blank screen, which feels faster even when load time is identical.

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  radius?: string;
  className?: string;
}

export default function Skeleton({ width = '100%', height = '1rem', radius = 'var(--radius-sm)', className = '' }: SkeletonProps) {
  return (
    <div
      className={`skeleton-block ${className}`}
      style={{ width, height, borderRadius: radius }}
      aria-hidden="true"
    />
  );
}
