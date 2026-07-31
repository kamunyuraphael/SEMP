// components/dashboard/DashboardSkeleton.tsx
// Shown while Dashboard's initial data is loading, in place of a
// blank-screen spinner. Mirrors the real layout (4 stat cards, an
// insights panel, two charts, an anomalies list, and the comparison
// + budget widget row) so there's no layout shift when real content
// swaps in, and the page reads as "already here" rather than empty.

import Skeleton from '../ui/Skeleton';

function StatCardSkeleton() {
  return (
    <div className="col-12 col-sm-6 col-lg-3">
      <div className="stat-card">
        <div className="stat-card-top">
          <Skeleton width="70%" height="0.8rem" />
          <Skeleton width={32} height={32} radius="var(--radius-sm)" />
        </div>
        <Skeleton width="50%" height="1.75rem" className="mt-2" />
        <Skeleton width="60%" height="0.75rem" className="mt-2" />
      </div>
    </div>
  );
}

export default function DashboardSkeleton() {
  return (
    <div>
      <div className="row g-3 mb-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>

      <div className="chart-card mb-4">
        <Skeleton width="30%" height="1rem" className="mb-3" />
        <Skeleton width="100%" height="4rem" />
      </div>

      <div className="row g-3 mb-4">
        <div className="col-12 col-lg-8">
          <div className="chart-card h-100">
            <Skeleton width="40%" height="1rem" className="mb-3" />
            <Skeleton width="100%" height="260px" />
          </div>
        </div>
        <div className="col-12 col-lg-4">
          <div className="chart-card h-100">
            <Skeleton width="60%" height="1rem" className="mb-3" />
            <Skeleton width="100%" height="260px" radius="50%" />
          </div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-12 col-lg-6">
          <div className="chart-card h-100">
            <Skeleton width="50%" height="1rem" className="mb-3" />
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} width="100%" height="2.5rem" className="mb-2" />
            ))}
          </div>
        </div>
        <div className="col-12 col-lg-6">
          <div className="chart-card h-100">
            <Skeleton width="50%" height="1rem" className="mb-3" />
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} width="100%" height="2.5rem" className="mb-2" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
