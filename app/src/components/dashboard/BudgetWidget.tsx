// components/dashboard/BudgetWidget.tsx
// Dashboard widget: projects this month's electricity bill from
// month-to-date usage (KPLC-modeled tariff bands) and, if the user has
// set a monthly budget, shows progress against it. Setting/clearing the
// budget lives here too, so it's a one-stop widget.

import { useState, useEffect, useCallback } from 'react';
import { budgetService, authService } from '../../services/api';
import type { BillForecast } from '../../types/index';

export default function BudgetWidget() {
  const [forecast, setForecast] = useState<BillForecast | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const fetchForecast = useCallback(async () => {
    try {
      const res = await budgetService.getForecast();
      setForecast(res.data);
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load bill forecast.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchForecast();
  }, [fetchForecast]);

  const startEditing = () => {
    setBudgetInput(forecast?.monthlyBudgetKES ? String(forecast.monthlyBudgetKES) : '');
    setIsEditing(true);
  };

  const saveBudget = async () => {
    const value = budgetInput.trim() === '' ? null : Number(budgetInput);
    if (value !== null && (!Number.isFinite(value) || value <= 0)) {
      setError('Enter a positive number, or leave blank to clear your budget.');
      return;
    }
    setIsSaving(true);
    try {
      await authService.updateBudget(value);
      setIsEditing(false);
      await fetchForecast();
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to update budget.');
    } finally {
      setIsSaving(false);
    }
  };

  const percent = forecast?.percentOfBudget ?? null;
  const progressColor = percent === null ? 'var(--accent-primary)' : percent >= 90 ? 'var(--warning)' : 'var(--accent-amber)';

  return (
    <div className="chart-card h-100">
      <div className="chart-header">
        <div>
          <div className="chart-title">Projected Bill This Month</div>
          <div className="chart-subtitle">
            {forecast ? `${forecast.tariffBand} tariff · KES ${forecast.rateKESPerKWh.toFixed(2)}/kWh` : 'Based on usage so far'}
          </div>
        </div>
        {!isEditing && (
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={startEditing}>
            <i className="bi bi-gear me-1" />
            {forecast?.monthlyBudgetKES ? 'Edit budget' : 'Set budget'}
          </button>
        )}
      </div>

      {error && (
        <div className="alert alert-danger mb-3">
          <i className="bi bi-exclamation-circle-fill me-2" />
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="text-muted small py-4 text-center">Loading forecast…</div>
      ) : !forecast ? null : (
        <>
          <div className="stat-card-value" style={{ fontSize: '1.8rem' }}>
            KSh {forecast.projectedBillKES.toFixed(0)}
          </div>
          <div className="stat-card-sub mb-3">
            {forecast.monthToDateKWh.toFixed(1)} kWh used so far · projected {forecast.projectedMonthlyKWh.toFixed(0)} kWh by day{' '}
            {forecast.daysInMonth} (day {forecast.daysElapsed} today)
          </div>

          {isEditing ? (
            <div className="d-flex align-items-center gap-2">
              <span className="text-muted small">KSh</span>
              <input
                type="number"
                className="form-control form-control-sm"
                style={{ maxWidth: 140 }}
                placeholder="e.g. 3000"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                min={0}
              />
              <button type="button" className="btn btn-sm btn-primary" onClick={saveBudget} disabled={isSaving}>
                Save
              </button>
              <button type="button" className="btn btn-sm btn-link text-muted" onClick={() => setIsEditing(false)} disabled={isSaving}>
                Cancel
              </button>
            </div>
          ) : forecast.monthlyBudgetKES ? (
            <>
              <div
                style={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: 'var(--bg-surface)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(percent ?? 0, 100)}%`,
                    backgroundColor: progressColor,
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
              <div className="d-flex justify-content-between mt-2">
                <span className="text-muted small">
                  {percent !== null ? `${percent.toFixed(0)}% of KSh ${forecast.monthlyBudgetKES.toFixed(0)} budget` : ''}
                </span>
                {forecast.budgetThresholdCrossed && (
                  <span className="stat-card-trend down">
                    <i className="bi bi-exclamation-triangle-fill me-1" />
                    Nearing budget
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className="text-muted small">
              No budget set — set one to get an alert when you're projected to go over.
            </div>
          )}
        </>
      )}
    </div>
  );
}
