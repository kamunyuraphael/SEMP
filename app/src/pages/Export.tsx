// pages/Export.tsx
// Lets users download their telemetry and prediction data in
// CSV, JSON, or Excel format with optional date range and type filters.
// Calls exportService from api.ts which triggers a browser file download.

import { useState } from 'react';
import { exportService } from '../services/api';
import type {
  ExportFormat,
  TelemetryInterval,
  PredictionType,
} from '../types/index';

type ExportDataType = 'telemetry' | 'predictions';

interface ExportState {
  isExporting: boolean;
  success: string | null;
  error: string | null;
}

const FORMAT_OPTIONS: { value: ExportFormat; label: string; icon: string; desc: string }[] = [
  { value: 'csv', label: 'CSV', icon: 'bi-filetype-csv', desc: 'Best for spreadsheets' },
  { value: 'xlsx', label: 'Excel', icon: 'bi-file-earmark-excel-fill', desc: 'Formatted workbook' },
  { value: 'json', label: 'JSON', icon: 'bi-filetype-json', desc: 'Best for developers' },
];

const INTERVAL_OPTIONS: { value: TelemetryInterval; label: string }[] = [
  { value: 'raw', label: 'Raw (every reading)' },
  { value: 'daily', label: 'Daily summaries' },
  { value: 'weekly', label: 'Weekly summaries' },
  { value: 'monthly', label: 'Monthly summaries' },
];

const PREDICTION_TYPE_OPTIONS: { value: PredictionType | ''; label: string }[] = [
  { value: '', label: 'All types' },
  { value: 'consumption', label: 'Consumption forecasts' },
  { value: 'bill', label: 'Bill estimates' },
  { value: 'anomaly', label: 'Anomaly detections' },
];

export default function Export() {
  // Telemetry export state
  const [telemetryFormat, setTelemetryFormat] = useState<ExportFormat>('csv');
  const [telemetryInterval, setTelemetryInterval] = useState<TelemetryInterval>('daily');
  const [telemetryFrom, setTelemetryFrom] = useState('');
  const [telemetryTo, setTelemetryTo] = useState('');
  const [telemetryState, setTelemetryState] = useState<ExportState>({
    isExporting: false,
    success: null,
    error: null,
  });

  // Predictions export state
  const [predictionsFormat, setPredictionsFormat] = useState<ExportFormat>('csv');
  const [predictionsType, setPredictionsType] = useState<PredictionType | ''>('');
  const [predictionsFrom, setPredictionsFrom] = useState('');
  const [predictionsTo, setPredictionsTo] = useState('');
  const [predictionsState, setPredictionsState] = useState<ExportState>({
    isExporting: false,
    success: null,
    error: null,
  });

  const handleExport = async (type: ExportDataType) => {
    if (type === 'telemetry') {
      setTelemetryState({ isExporting: true, success: null, error: null });
      try {
        await exportService.exportTelemetry(telemetryFormat, {
          interval: telemetryInterval,
          from: telemetryFrom || undefined,
          to: telemetryTo || undefined,
        });
        setTelemetryState({
          isExporting: false,
          success: `Telemetry exported as ${telemetryFormat.toUpperCase()} successfully.`,
          error: null,
        });
      } catch (err: any) {
        const msg =
          err?.response?.data?.error ||
          'No records found for the selected filters.';
        setTelemetryState({ isExporting: false, success: null, error: msg });
      }
    } else {
      setPredictionsState({ isExporting: true, success: null, error: null });
      try {
        await exportService.exportPredictions(predictionsFormat, {
          type: predictionsType || undefined,
          from: predictionsFrom || undefined,
          to: predictionsTo || undefined,
        });
        setPredictionsState({
          isExporting: false,
          success: `Predictions exported as ${predictionsFormat.toUpperCase()} successfully.`,
          error: null,
        });
      } catch (err: any) {
        const msg =
          err?.response?.data?.error ||
          'No records found for the selected filters.';
        setPredictionsState({ isExporting: false, success: null, error: msg });
      }
    }
  };

  const FormatPicker = ({
    value,
    onChange,
  }: {
    value: ExportFormat;
    onChange: (f: ExportFormat) => void;
  }) => (
    <div className="row g-2">
      {FORMAT_OPTIONS.map((opt) => (
        <div key={opt.value} className="col-4">
          <button
            type="button"
            className="btn w-100 d-flex flex-column align-items-center py-3 gap-1"
            style={{
              backgroundColor:
                value === opt.value ? 'var(--accent-primary)' : 'var(--bg-surface)',
              color: value === opt.value ? '#ffffff' : 'var(--text-primary)',
              border: '1px solid var(--bg-border)',
              borderRadius: 'var(--radius-md)',
              transition: 'var(--transition)',
            }}
            onClick={() => onChange(opt.value)}
          >
            <i className={`bi ${opt.icon} fs-4`} />
            <span className="fw-semibold" style={{ fontSize: '0.85rem' }}>{opt.label}</span>
            <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>{opt.desc}</span>
          </button>
        </div>
      ))}
    </div>
  );

  return (
    <div>
      <div className="mb-4">
        <h5 className="mb-0" style={{ color: 'var(--text-primary)' }}>
          Export Data
        </h5>
        <p className="mb-0" style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Download your energy data in your preferred format
        </p>
      </div>

      <div className="row g-4">
        {/* ── Telemetry Export Card ─────────────────────────── */}
        <div className="col-12 col-lg-6">
          <div className="chart-card h-100">
            <div className="chart-header mb-4">
              <div>
                <div className="chart-title d-flex align-items-center gap-2">
                  <i className="bi bi-activity" style={{ color: 'var(--accent-primary)' }} />
                  Telemetry Data
                </div>
                <div className="chart-subtitle">Historical power readings</div>
              </div>
            </div>

            {telemetryState.success && (
              <div className="alert alert-success py-2 mb-3">
                <i className="bi bi-check-circle-fill me-2" />
                {telemetryState.success}
              </div>
            )}
            {telemetryState.error && (
              <div className="alert alert-danger py-2 mb-3">
                <i className="bi bi-exclamation-circle-fill me-2" />
                {telemetryState.error}
              </div>
            )}

            <div className="mb-4">
              <label className="form-label">Format</label>
              <FormatPicker value={telemetryFormat} onChange={setTelemetryFormat} />
            </div>

            <div className="mb-3">
              <label className="form-label">Interval</label>
              <select
                className="form-select"
                value={telemetryInterval}
                onChange={(e) => setTelemetryInterval(e.target.value as TelemetryInterval)}
              >
                {INTERVAL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="row g-2 mb-4">
              <div className="col-6">
                <label className="form-label">From</label>
                <input
                  type="date"
                  className="form-control"
                  value={telemetryFrom}
                  onChange={(e) => setTelemetryFrom(e.target.value)}
                  max={telemetryTo || undefined}
                />
              </div>
              <div className="col-6">
                <label className="form-label">To</label>
                <input
                  type="date"
                  className="form-control"
                  value={telemetryTo}
                  onChange={(e) => setTelemetryTo(e.target.value)}
                  min={telemetryFrom || undefined}
                />
              </div>
            </div>

            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <i className="bi bi-info-circle me-1" />
              Defaults to the last 30 days if no date range is selected.
              Maximum 10,000 records per export.
            </p>

            <button
              type="button"
              className="btn btn-primary w-100"
              onClick={() => handleExport('telemetry')}
              disabled={telemetryState.isExporting}
            >
              {telemetryState.isExporting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" />
                  Exporting...
                </>
              ) : (
                <>
                  <i className="bi bi-download me-2" />
                  Export Telemetry
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── Predictions Export Card ───────────────────────── */}
        <div className="col-12 col-lg-6">
          <div className="chart-card h-100">
            <div className="chart-header mb-4">
              <div>
                <div className="chart-title d-flex align-items-center gap-2">
                  <i className="bi bi-graph-up-arrow" style={{ color: 'var(--accent-primary)' }} />
                  Predictions Data
                </div>
                <div className="chart-subtitle">ML forecasts and anomalies</div>
              </div>
            </div>

            {predictionsState.success && (
              <div className="alert alert-success py-2 mb-3">
                <i className="bi bi-check-circle-fill me-2" />
                {predictionsState.success}
              </div>
            )}
            {predictionsState.error && (
              <div className="alert alert-danger py-2 mb-3">
                <i className="bi bi-exclamation-circle-fill me-2" />
                {predictionsState.error}
              </div>
            )}

            <div className="mb-4">
              <label className="form-label">Format</label>
              <FormatPicker value={predictionsFormat} onChange={setPredictionsFormat} />
            </div>

            <div className="mb-3">
              <label className="form-label">Prediction Type</label>
              <select
                className="form-select"
                value={predictionsType}
                onChange={(e) =>
                  setPredictionsType(e.target.value as PredictionType | '')
                }
              >
                {PREDICTION_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="row g-2 mb-4">
              <div className="col-6">
                <label className="form-label">From</label>
                <input
                  type="date"
                  className="form-control"
                  value={predictionsFrom}
                  onChange={(e) => setPredictionsFrom(e.target.value)}
                  max={predictionsTo || undefined}
                />
              </div>
              <div className="col-6">
                <label className="form-label">To</label>
                <input
                  type="date"
                  className="form-control"
                  value={predictionsTo}
                  onChange={(e) => setPredictionsTo(e.target.value)}
                  min={predictionsFrom || undefined}
                />
              </div>
            </div>

            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <i className="bi bi-info-circle me-1" />
              Defaults to the last 30 days if no date range is selected.
              Maximum 10,000 records per export.
            </p>

            <button
              type="button"
              className="btn btn-primary w-100"
              onClick={() => handleExport('predictions')}
              disabled={predictionsState.isExporting}
            >
              {predictionsState.isExporting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" />
                  Exporting...
                </>
              ) : (
                <>
                  <i className="bi bi-download me-2" />
                  Export Predictions
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}