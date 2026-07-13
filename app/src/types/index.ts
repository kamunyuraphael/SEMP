// types/index.ts
// Shared TypeScript interfaces for the SEMP frontend.
// Mirrors the MongoDB document shapes returned by the Node.js API.

// ─────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────

export interface User {
  _id: string;
  username: string;
  email: string;
  role: 'user' | 'admin';
  devices: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    userId: string;
  };
}

// ─────────────────────────────────────────────────────────────
// Devices
// ─────────────────────────────────────────────────────────────

export type DeviceCategory =
  | 'kitchen'
  | 'laundry'
  | 'lighting'
  | 'entertainment'
  | 'HVAC'
  | 'computing';

export type DeviceStatus = 'active' | 'inactive';

export interface ConsumptionLog {
  date: string;
  kWh: number;
}

export interface Device {
  _id: string;
  name: string;
  category: DeviceCategory;
  status: DeviceStatus;
  location?: string;
  ratedWattage?: number;
  owner: string;
  consumptionLogs: ConsumptionLog[];
  createdAt: string;
  updatedAt: string;
}

export interface AddDevicePayload {
  name: string;
  category: DeviceCategory;
  status?: DeviceStatus;
  location?: string;
  ratedWattage?: number;
}

export interface TelemetrySummary {
  totalKWh: number;
  totalWatts: number;
  readingCount: number;
}

export interface DailyCategoryBreakdown {
  period: string; // 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:00' depending on groupBy
  category: DeviceCategory;
  totalKWh: number;
}

// ─────────────────────────────────────────────────────────────
// Telemetry
// ─────────────────────────────────────────────────────────────

export type TelemetryInterval = 'raw' | 'daily' | 'weekly' | 'monthly';

export interface TelemetryRecord {
  _id: string;
  device: string | Device;
  user: string;
  timestamp: string;
  watts: number;
  kWh: number;
  interval: TelemetryInterval;
  createdAt: string;
  updatedAt: string;
}

export interface AddTelemetryPayload {
  device: string;
  watts: number;
  kWh: number;
  interval?: TelemetryInterval;
}

export interface CategoryBreakdown {
  category: DeviceCategory;
  totalKWh: number;
  totalWatts: number;
  readingCount: number;
}

// ─────────────────────────────────────────────────────────────
// Predictions
// ─────────────────────────────────────────────────────────────

export type PredictionType = 'bill' | 'consumption' | 'anomaly';

export interface Prediction {
  _id: string;
  user: string;
  device?: string | Device;
  type: PredictionType;
  predictedValue: number;
  confidence: number;
  timestamp: string;
  targetDate: string;
  anomalyDetails?: string;
  resolved?: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────
// Alerts
// ─────────────────────────────────────────────────────────────

export type AlertType = 'anomaly' | 'threshold' | 'info';

export interface Alert {
  _id: string;
  user: string;
  device?: string | Device;
  type: AlertType;
  message: string;
  timestamp: string;
  read: boolean;
  createdAt: string;
  updatedAt: string;
}

// Socket.io real-time alert payload
export interface AlertEventPayload {
  type: AlertType;
  message: string;
  device?: string;
  anomalyDetails?: string;
  timestamp: string;
}

// ─────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────

export type ExportFormat = 'csv' | 'json' | 'xlsx';
export type ExportDataType = 'telemetry' | 'predictions';

export interface ExportParams {
  format: ExportFormat;
  from?: string;
  to?: string;
  interval?: TelemetryInterval;
  type?: PredictionType;
}

// ─────────────────────────────────────────────────────────────
// API Response Wrappers
// ─────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  count?: number;
  error?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  count: number;
}

// ─────────────────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────────────────

export interface DashboardStats {
  totalDevices: number;
  activeDevices: number;
  totalKWhToday: number;
  estimatedBillToday: number;
  activeAlerts: number;
}

// ─────────────────────────────────────────────────────────────
// Theme
// ─────────────────────────────────────────────────────────────

export type Theme = 'light' | 'dark';

export interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  isDark: boolean;
}

// ─────────────────────────────────────────────────────────────
// Charts
// ─────────────────────────────────────────────────────────────

export interface ChartDataPoint {
  timestamp: string;
  watts: number;
  kWh?: number;
}

export interface CategoryChartData {
  category: string;
  value: number;
  fill: string;
}

// ─────────────────────────────────────────────────────────────
// Navigation
// ─────────────────────────────────────────────────────────────

export interface NavItem {
  label: string;
  path: string;
  icon: string;
  badge?: number;
}