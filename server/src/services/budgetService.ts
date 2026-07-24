// budgetService.ts
// Projects the current month's electricity spend from month-to-date
// telemetry and, if the user has set a monthly budget, fires a
// "threshold" alert through the existing alert pipeline once projected
// spend crosses 90% of that budget.

import { Types } from "mongoose";
import { Telemetry } from "../models/Telemetry.js";
import { Alert } from "../models/Alerts.js";
import { estimateEnergyChargeKES, resolveTariffBand } from "../config/tariff.js";
import { pushAlert } from "./alertServices.js";
import logger from "../utils/logger.js";

export interface BillForecast {
  monthToDateKWh: number;
  projectedMonthlyKWh: number;
  projectedBillKES: number;
  tariffBand: string;
  rateKESPerKWh: number;
  daysElapsed: number;
  daysInMonth: number;
  monthlyBudgetKES?: number;
  percentOfBudget?: number;
  budgetThresholdCrossed: boolean;
}

// Only fire one budget alert per user per calendar day, so a page that
// polls every 30s (like the Dashboard) doesn't spam the alert feed.
const BUDGET_ALERT_MARKER = "[budget-threshold]";

async function alreadyAlertedToday(userId: string): Promise<boolean> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const existing = await Alert.findOne({
    user: new Types.ObjectId(userId),
    type: "threshold",
    message: { $regex: BUDGET_ALERT_MARKER },
    timestamp: { $gte: startOfToday },
  }).lean();

  return existing !== null;
}

/**
 * Compute a month-to-date → projected-month-end bill estimate for a user,
 * and fire a threshold alert (at most once/day) if a budget is set and
 * projected spend has crossed 90% of it.
 */
export const getBillForecast = async (
  userId: string,
  monthlyBudgetKES?: number
): Promise<BillForecast> => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysElapsed = now.getDate();

  const [result] = await Telemetry.aggregate([
    {
      $match: {
        user: new Types.ObjectId(userId),
        timestamp: { $gte: monthStart, $lte: now },
      },
    },
    { $group: { _id: null, totalKWh: { $sum: "$kWh" } } },
  ]);

  const monthToDateKWh = result?.totalKWh || 0;

  // Simple linear projection: whatever the daily average has been so
  // far, assume it holds for the rest of the month. Crude, but a fair
  // "if this trend continues" estimate for a household budgeting tool.
  const projectedMonthlyKWh =
    daysElapsed > 0 ? (monthToDateKWh / daysElapsed) * daysInMonth : 0;

  const band = resolveTariffBand(projectedMonthlyKWh);
  const projectedBillKES = estimateEnergyChargeKES(projectedMonthlyKWh);

  const forecast: BillForecast = {
    monthToDateKWh,
    projectedMonthlyKWh,
    projectedBillKES,
    tariffBand: band.label,
    rateKESPerKWh: band.rateKESPerKWh,
    daysElapsed,
    daysInMonth,
    budgetThresholdCrossed: false,
  };

  if (monthlyBudgetKES && monthlyBudgetKES > 0) {
    const percentOfBudget = (projectedBillKES / monthlyBudgetKES) * 100;
    forecast.monthlyBudgetKES = monthlyBudgetKES;
    forecast.percentOfBudget = percentOfBudget;

    if (percentOfBudget >= 90) {
      forecast.budgetThresholdCrossed = true;

      try {
        if (!(await alreadyAlertedToday(userId))) {
          await pushAlert({
            userId,
            type: "threshold",
            message:
              `${BUDGET_ALERT_MARKER} Projected bill this month is KES ` +
              `${projectedBillKES.toFixed(0)} — ${percentOfBudget.toFixed(0)}% of your ` +
              `KES ${monthlyBudgetKES.toFixed(0)} budget, based on usage so far.`,
          });
        }
      } catch (error) {
        // Forecast is still useful even if the alert failed to persist/emit
        logger.error(`Failed to push budget threshold alert: ${(error as Error).message}`);
      }
    }
  }

  return forecast;
};
