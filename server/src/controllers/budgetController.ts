// budgetController.ts
import type { Request, Response, NextFunction } from "express";
import { User } from "../models/User.js";
import { getBillForecast } from "../services/budgetService.js";

interface AuthRequest extends Request {
  user?: { id: string };
}

/**
 * MONTH-TO-DATE BILL FORECAST
 * GET /api/budget/forecast
 *
 * Projects this month's electricity spend from usage so far, using the
 * KPLC-modeled tariff bands, and — if the user has a budget set — flags
 * whether projected spend has crossed 90% of it (firing a threshold
 * alert at most once/day via the existing alert pipeline).
 */
export const getForecast = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const user = await User.findById(userId).select("monthlyBudgetKES");
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const forecast = await getBillForecast(userId, user.monthlyBudgetKES);

    res.status(200).json({ success: true, data: forecast });
  } catch (error) {
    next(error);
  }
};
