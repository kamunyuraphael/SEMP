// utils/categoryColors.ts
// Shared category -> colour mapping, drawn from SEMP's forest-green/teal
// brand palette (see index.css --accent-primary/--accent-amber) rather
// than a standalone palette, so every chart — Dashboard's pie chart,
// ComparisonWidget, Telemetry's stacked bar chart, etc. — reads as part
// of the same visual system instead of clashing with it. Kept as static
// hex (not CSS variables) since these need to stay visually distinct
// from each other across a pie/bar chart regardless of light/dark theme;
// each shade below was picked to hold reasonable contrast in both.

import type { DeviceCategory } from '../types/index';

export const CATEGORY_COLORS: Record<DeviceCategory, string> = {
  kitchen: '#16825D',
  laundry: '#00BFB3',
  lighting: '#E8B93D',
  entertainment: '#3E9B75',
  HVAC: '#0A5C36',
  computing: '#6FA98C',
};

export const CATEGORY_LABELS: Record<DeviceCategory, string> = {
  kitchen: 'Kitchen',
  laundry: 'Laundry',
  lighting: 'Lighting',
  entertainment: 'Entertainment',
  HVAC: 'HVAC',
  computing: 'Computing',
};

export const CATEGORY_ICONS: Record<DeviceCategory, string> = {
  kitchen: 'bi-cup-hot-fill',
  laundry: 'bi-basket3-fill',
  lighting: 'bi-lightbulb-fill',
  entertainment: 'bi-tv-fill',
  HVAC: 'bi-thermometer-half',
  computing: 'bi-laptop-fill',
};
