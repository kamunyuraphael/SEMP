// utils/anomaly.ts
// Shared helpers for anomaly predictions, used by both Dashboard.tsx
// (compact summary card) and Anomalies.tsx (full list) so severity
// classification and relative-time formatting stay consistent in one
// place rather than being duplicated (and potentially drifting) across
// pages.

export type AnomalySeverity = 'high' | 'medium' | 'low';

/**
 * Severity comes embedded in the anomalyDetails string produced by
 * AnomalyDetector.to_prediction_payloads() in the Python pipeline,
 * e.g. "...severity: high...". Defaults to 'low' if absent.
 */
export function extractSeverity(details?: string): AnomalySeverity {
  if (!details) return 'low';
  if (details.includes('severity: high')) return 'high';
  if (details.includes('severity: medium')) return 'medium';
  return 'low';
}

/** Compact "Xm ago" / "Xh ago" / "Xd ago" formatting, matching the Figma reference. */
export function timeAgo(date: string | Date): string {
  const diffMs = Date.now() - new Date(date).getTime();
  const diffMin = Math.round(diffMs / 60_000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  const diffDay = Math.round(diffHr / 24);
  return `${diffDay}d ago`;
}
