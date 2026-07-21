// telemetryController.ts
import type { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { Telemetry } from "../models/Telemetry.js";
import { Device } from "../models/Devices.js";
import type { ITelemetryData } from "../types/Telemetry.d.js";

interface AuthenticateRequest extends Request {
  user?: { id: string };
}

/**
 * FETCH TELEMETRY HISTORY
 * GET /api/telemetry?interval=raw
 */
export const getTelemetry = async (
  req: AuthenticateRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized access" });
      return;
    }

    const interval =
      typeof req.query.interval === "string" ? req.query.interval : undefined;

    const filter = {
      user: new Types.ObjectId(userId),
      ...(interval ? { interval: interval as ITelemetryData["interval"] } : {}),
    };

    const telemetry = await Telemetry.find(filter)
      .sort({ timestamp: -1 })
      .limit(100)
      .populate('device', 'name category')
      .lean();

    res.status(200).json({
      success: true,
      count: telemetry.length,
      data: telemetry,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * SUBMIT RAW OR ACCUMULATED TELEMETRY TICK
 * POST /api/telemetry
 */
export const addTelemetry = async (
  req: AuthenticateRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized access" });
      return;
    }

    const { device, watts, kWh, interval } = req.body;

    const existingDevice = await Device.findById(device);
    if (!existingDevice || existingDevice.owner.toString() !== userId) {
      res.status(403).json({
        success: false,
        error: "Device does not belong to authenticated user",
      });
      return;
    }

    const telemetry = new Telemetry({
      device: new Types.ObjectId(device),
      user: new Types.ObjectId(userId),
      watts: watts ?? 0,
      kWh,
      interval: (interval as ITelemetryData["interval"]) || "raw",
    });

    await telemetry.save();

    res.status(201).json({
      success: true,
      data: telemetry,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * TELEMETRY SUMMARY (arbitrary date range totals)
 * GET /api/telemetry/summary?from=2026-07-01&to=2026-07-10
 *
 * Returns total kWh/watts/reading-count across ALL devices for a date
 * range — used for things like "month to date" totals and period-over-
 * period comparisons, where a full per-category breakdown isn't needed.
 */
export const getTelemetrySummary = async (
  req: AuthenticateRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized access" });
      return;
    }

    const { from, to } = req.query as { from: string; to: string };
    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      res.status(400).json({ success: false, error: "Invalid from/to date" });
      return;
    }

    // 'to' is inclusive of the whole calendar day
    const toDateExclusive = new Date(toDate);
    toDateExclusive.setDate(toDateExclusive.getDate() + 1);
    toDateExclusive.setHours(0, 0, 0, 0);

    const fromDateStart = new Date(fromDate);
    fromDateStart.setHours(0, 0, 0, 0);

    const [result] = await Telemetry.aggregate([
      {
        $match: {
          user: new Types.ObjectId(userId),
          timestamp: { $gte: fromDateStart, $lt: toDateExclusive },
        },
      },
      {
        $group: {
          _id: null,
          totalKWh: { $sum: "$kWh" },
          totalWatts: { $sum: "$watts" },
          readingCount: { $sum: 1 },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalKWh: result?.totalKWh || 0,
        totalWatts: result?.totalWatts || 0,
        readingCount: result?.readingCount || 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * CATEGORY CONSUMPTION BREAKDOWN
 * GET /api/telemetry/breakdown?date=2026-07-09
 *
 * Sums kWh/watts per device category for a single calendar day (defaults
 * to today, server-local time). Previously this filtered by an exact
 * `interval` string match (e.g. "daily") rather than an actual date
 * range — which meant it wasn't scoped to "today" at all (it summed
 * every record ever tagged with that interval label), and returned
 * empty against raw-only telemetry, since nothing would ever match
 * interval: "daily" unless a separate rollup job wrote those records.
 */
export const getCategoryBreakdown = async (
  req: AuthenticateRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized access" });
      return;
    }

    const dateParam =
      typeof req.query.date === "string" ? req.query.date : undefined;
    const targetDate = dateParam ? new Date(dateParam) : new Date();

    if (isNaN(targetDate.getTime())) {
      res.status(400).json({ success: false, error: "Invalid date parameter" });
      return;
    }

    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const breakdown = await Telemetry.aggregate([
      {
        $match: {
          user: new Types.ObjectId(userId),
          timestamp: { $gte: dayStart, $lt: dayEnd },
        },
      },
      {
        $lookup: {
          from: "devices",
          localField: "device",
          foreignField: "_id",
          as: "deviceInfo",
        },
      },
      { $unwind: "$deviceInfo" },
      {
        $group: {
          _id: "$deviceInfo.category",
          totalKWh: { $sum: "$kWh" },
          totalWatts: { $sum: "$watts" },
          readingCount: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          category: "$_id",
          totalKWh: 1,
          totalWatts: 1,
          readingCount: 1,
        },
      },
      { $sort: { totalKWh: -1 } },
    ]);

    res.status(200).json({
      success: true,
      count: breakdown.length,
      data: breakdown,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * CATEGORY BREAKDOWN OVER A DATE RANGE, GROUPED BY PERIOD
 * GET /api/telemetry/breakdown-range?from=2026-07-01&to=2026-07-10&groupBy=day
 *
 * Powers the Telemetry page's "Daily kWh by Category" stacked bar chart.
 * Returns a flat list of {period, category, totalKWh} tuples — the
 * client pivots this into one stacked bar per period. groupBy defaults
 * to "day"; pass "hour" for short ranges (e.g. the last 24h) where
 * daily buckets would collapse everything into a single bar.
 */
export const getCategoryBreakdownRange = async (
  req: AuthenticateRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized access" });
      return;
    }

    const { from, to } = req.query as { from: string; to: string };
    const groupBy = req.query.groupBy === "hour" ? "hour" : "day";

    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      res.status(400).json({ success: false, error: "Invalid from/to date" });
      return;
    }

    const dateFormat = groupBy === "hour" ? "%Y-%m-%dT%H:00" : "%Y-%m-%d";

    const breakdown = await Telemetry.aggregate([
      {
        $match: {
          user: new Types.ObjectId(userId),
          timestamp: { $gte: fromDate, $lte: toDate },
        },
      },
      {
        $lookup: {
          from: "devices",
          localField: "device",
          foreignField: "_id",
          as: "deviceInfo",
        },
      },
      { $unwind: "$deviceInfo" },
      {
        $group: {
          _id: {
            period: { $dateToString: { format: dateFormat, date: "$timestamp" } },
            category: "$deviceInfo.category",
          },
          totalKWh: { $sum: "$kWh" },
        },
      },
      {
        $project: {
          _id: 0,
          period: "$_id.period",
          category: "$_id.category",
          totalKWh: 1,
        },
      },
      { $sort: { period: 1 } },
    ]);

    res.status(200).json({
      success: true,
      count: breakdown.length,
      data: breakdown,
    });
  } catch (error) {
    next(error);
  }
};