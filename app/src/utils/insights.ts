// utils/insights.ts
// Lightweight, rule-based energy-saving insights — derived entirely
// from data already fetched on the Dashboard (category breakdown,
// usage trend, current draw trend, unresolved anomalies). These are
// simple, explainable heuristics rather than a separate ML call; the
// ML pipeline already covers forecasting/anomaly detection, this layer
// just turns numbers already on screen into a plain-language takeaway.

export type InsightTone = 'info' | 'warning' | 'success';

export interface Insight {
  icon: string; // bootstrap-icons class suffix, e.g. 'bi-lightbulb-fill'
  tone: InsightTone;
  text: string;
}

interface InsightInputs {
  categoryTotals: { name: string; value: number }[];
  kWhTrendPct: number | null;
  currentDrawTrendPct: number | null;
  unresolvedAnomalyCount: number;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function generateInsights({
  categoryTotals,
  kWhTrendPct,
  currentDrawTrendPct,
  unresolvedAnomalyCount,
}: InsightInputs): Insight[] {
  const insights: Insight[] = [];

  // Dominant category — the single biggest lever for savings today
  const totalKWh = categoryTotals.reduce((sum, c) => sum + c.value, 0);
  if (totalKWh > 0) {
    const dominant = [...categoryTotals].sort((a, b) => b.value - a.value)[0];
    const share = dominant.value / totalKWh;
    if (share >= 0.4) {
      insights.push({
        icon: 'bi-lightbulb-fill',
        tone: 'info',
        text: `${capitalize(dominant.name)} accounts for ${(share * 100).toFixed(0)}% of today's usage — it's the biggest place to look for savings.`,
      });
    }
  }

  // Rising day-over-day trend
  if (kWhTrendPct !== null && kWhTrendPct >= 15) {
    insights.push({
      icon: 'bi-graph-up-arrow',
      tone: 'warning',
      text: `Today's usage is running ${kWhTrendPct.toFixed(0)}% above yesterday — worth checking what's been left running longer than usual.`,
    });
  }

  // Sudden jump in the last hour
  if (currentDrawTrendPct !== null && currentDrawTrendPct >= 25) {
    insights.push({
      icon: 'bi-lightning-charge-fill',
      tone: 'warning',
      text: `Current draw has jumped ${currentDrawTrendPct.toFixed(0)}% in the last hour — check which device just switched on.`,
    });
  }

  // Unresolved anomalies quietly adding cost
  if (unresolvedAnomalyCount > 0) {
    insights.push({
      icon: 'bi-exclamation-triangle-fill',
      tone: 'warning',
      text: `${unresolvedAnomalyCount} unresolved anomal${unresolvedAnomalyCount === 1 ? 'y' : 'ies'} may be adding hidden cost — review ${unresolvedAnomalyCount === 1 ? 'it' : 'them'} on the Anomalies page.`,
    });
  }

  // Nothing notable — still worth a positive signal rather than an empty card
  if (insights.length === 0) {
    insights.push({
      icon: 'bi-check-circle-fill',
      tone: 'success',
      text: 'Consumption looks steady with no unusual patterns right now.',
    });
  }

  return insights.slice(0, 4);
}
