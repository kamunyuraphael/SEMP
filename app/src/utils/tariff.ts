// utils/tariff.ts — mirrors server/src/config/tariff.ts so every cost
// figure shown in the UI (Dashboard's "Month to Date", Predictions'
// forecasted bill, BudgetWidget's projection) uses the same KPLC-modeled
// tariff bands instead of each screen guessing its own flat rate. Kept
// as a small client-side copy since the frontend and server are
// independently deployable and don't share a module graph — if you
// revise the bands server-side, mirror the change here too.

export interface TariffBand {
  label: string;
  upToKWh: number;
  rateKESPerKWh: number;
}

export const TARIFF_BANDS: TariffBand[] = [
  { label: 'Lifeline', upToKWh: 30, rateKESPerKWh: 12.23 },
  { label: 'Ordinary', upToKWh: 100, rateKESPerKWh: 16.45 },
  { label: 'High consumption', upToKWh: Infinity, rateKESPerKWh: 19.08 },
];

export function resolveTariffBand(monthlyKWh: number): TariffBand {
  return TARIFF_BANDS.find((band) => monthlyKWh <= band.upToKWh) ?? TARIFF_BANDS[TARIFF_BANDS.length - 1];
}

export function estimateEnergyChargeKES(monthlyKWh: number): number {
  if (monthlyKWh <= 0) return 0;
  return monthlyKWh * resolveTariffBand(monthlyKWh).rateKESPerKWh;
}
