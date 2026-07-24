// tariff.ts — Domestic electricity tariff used to convert kWh into KES.
//
// Modeled on Kenya Power's (KPLC) domestic tariff bands as approved by
// EPRA for the current tariff control period (mid-2026): a household's
// entire month bills at ONE rate, determined by which band its total
// monthly consumption falls into — not stepped like income tax brackets.
//
//   Domestic 1 / Lifeline   : up to 30 kWh/month  → KES 12.23/kWh
//   Domestic 2 / Ordinary   : 31–100 kWh/month    → KES 16.45/kWh
//   Domestic 3 / High usage : over 100 kWh/month  → KES 19.08/kWh
//
// This intentionally omits KPLC's monthly pass-through charges (Fuel
// Cost Charge, forex adjustment, WRMA/REP/EPRA levies, 16% VAT, and the
// KES 150 postpaid fixed charge) — those move month to month independent
// of usage and roughly add another ~40-50% on top of the energy charge
// alone. The energy-charge estimate here is meant for relative budgeting
// ("am I trending over my usual month?") rather than an exact bill
// prediction. Revisit these numbers periodically — EPRA revises them.

export interface TariffBand {
  label: string;
  upToKWh: number; // Inclusive upper bound; Infinity for the top band
  rateKESPerKWh: number;
}

export const TARIFF_BANDS: TariffBand[] = [
  { label: "Lifeline", upToKWh: 30, rateKESPerKWh: 12.23 },
  { label: "Ordinary", upToKWh: 100, rateKESPerKWh: 16.45 },
  { label: "High consumption", upToKWh: Infinity, rateKESPerKWh: 19.08 },
];

/** Resolve which tariff band a given month's total kWh falls into. */
export function resolveTariffBand(monthlyKWh: number): TariffBand {
  const match = TARIFF_BANDS.find((band) => monthlyKWh <= band.upToKWh);
  if (match) return match;
  // Fallback: should be unreachable since the last band's upToKWh is
  // Infinity, but keeps this total under strict/noUncheckedIndexedAccess.
  return TARIFF_BANDS[TARIFF_BANDS.length - 1] as TariffBand;
}

/** Estimate the energy charge (KES) for a given month's total kWh. */
export function estimateEnergyChargeKES(monthlyKWh: number): number {
  if (monthlyKWh <= 0) return 0;
  const band = resolveTariffBand(monthlyKWh);
  return monthlyKWh * band.rateKESPerKWh;
}
