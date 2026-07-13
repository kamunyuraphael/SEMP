// utils/categoryColors.ts
// Shared category -> colour mapping, pulled from the SEMP amber/rust
// palette. Used by any chart that breaks consumption down by device
// category (Dashboard's pie chart, Telemetry's stacked bar chart, etc.)
// so the same category always renders the same colour everywhere.

import type { DeviceCategory } from '../types/index';

export const CATEGORY_COLORS: Record<DeviceCategory, string> = {
  kitchen: '#C15A02',
  laundry: '#862D03',
  lighting: '#E8A221',
  entertainment: '#510B03',
  HVAC: '#320B09',
  computing: '#A8632F',
};

export const CATEGORY_LABELS: Record<DeviceCategory, string> = {
  kitchen: 'Kitchen',
  laundry: 'Laundry',
  lighting: 'Lighting',
  entertainment: 'Entertainment',
  HVAC: 'HVAC',
  computing: 'Computing',
};
