// exportController.ts
// Handles data export for telemetry and prediction records.
// Supports CSV, JSON, and Excel (.xlsx) formats.
// All exports are scoped to the authenticated user and filtered
// by optional date range and interval query parameters.

import type { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import ExcelJS from "exceljs";
import { Telemetry } from "../models/Telemetry.js";
import { Prediction } from "../models/Prediction.js";

interface AuthRequest extends Request {
  user?: { id: string };
}

type ExportFormat = "csv" | "json" | "xlsx";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Build a MongoDB date range filter from optional query params.
 * Falls back to the last 30 days if no range is provided.
 */
function buildDateFilter(from?: string, to?: string) {
  const end = to ? new Date(to) : new Date();
  const start = from
    ? new Date(from)
    : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

  return { $gte: start, $lte: end };
}

/**
 * Derive a safe filename for the download using the export type,
 * format, and current timestamp.
 */
function buildFilename(type: "telemetry" | "predictions", format: ExportFormat): string {
  const ts = new Date().toISOString().slice(0, 10);
  return `hems_${type}_${ts}.${format === "xlsx" ? "xlsx" : format}`;
}

// ---------------------------------------------------------------------------
// Telemetry Export
// ---------------------------------------------------------------------------

export const exportTelemetry = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const format = (req.query.format as ExportFormat) || "json";
    const interval = typeof req.query.interval === "string"
      ? req.query.interval
      : undefined;
    const from = typeof req.query.from === "string" ? req.query.from : undefined;
    const to = typeof req.query.to === "string" ? req.query.to : undefined;

    const filter: Record<string, unknown> = {
      user: new Types.ObjectId(userId),
      timestamp: buildDateFilter(from, to),
      ...(interval ? { interval } : {}),
    };

    const records = await Telemetry.find(filter)
      .sort({ timestamp: -1 })
      .limit(10000)
      .populate("device", "name category")
      .lean();

    // Flatten each record into a plain row object
    const rows = records.map((r) => ({
      timestamp: r.timestamp?.toISOString() ?? "",
      device: (r.device as any)?.name ?? r.device?.toString() ?? "",
      category: (r.device as any)?.category ?? "",
      watts: r.watts,
      kWh: r.kWh,
      interval: r.interval,
    }));

    const filename = buildFilename("telemetry", format);
    await sendExport(res, rows, format, filename);
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// Predictions Export
// ---------------------------------------------------------------------------

export const exportPredictions = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const format = (req.query.format as ExportFormat) || "json";
    const type = typeof req.query.type === "string" ? req.query.type : undefined;
    const from = typeof req.query.from === "string" ? req.query.from : undefined;
    const to = typeof req.query.to === "string" ? req.query.to : undefined;

    const filter: Record<string, unknown> = {
      user: new Types.ObjectId(userId),
      targetDate: buildDateFilter(from, to),
      ...(type ? { type } : {}),
    };

    const records = await Prediction.find(filter)
      .sort({ targetDate: -1 })
      .limit(10000)
      .populate("device", "name category")
      .lean();

    const rows = records.map((r) => ({
      targetDate: r.targetDate?.toISOString().slice(0, 10) ?? "",
      type: r.type,
      predictedValue: r.predictedValue,
      confidence: r.confidence,
      device: (r.device as any)?.name ?? r.device?.toString() ?? "",
      anomalyDetails: r.anomalyDetails ?? "",
      createdAt: r.createdAt?.toISOString() ?? "",
    }));

    const filename = buildFilename("predictions", format);
    await sendExport(res, rows, format, filename);
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// Format Dispatch
// ---------------------------------------------------------------------------

/**
 * Stream the export response in the requested format.
 * Mutates res directly — must not be called after headers are sent.
 */
async function sendExport(
  res: Response,
  rows: Record<string, unknown>[],
  format: ExportFormat,
  filename: string
): Promise<void> {
  if (rows.length === 0) {
    res.status(404).json({ success: false, error: "No records found for the given filters" });
    return;
  }

  switch (format) {
    case "json":
      return sendJson(res, rows, filename);
    case "csv":
      return sendCsv(res, rows, filename);
    case "xlsx":
      return await sendXlsx(res, rows, filename);
    default:
      res.status(400).json({ success: false, error: `Unsupported format: ${format}. Use csv, json, or xlsx.` });
  }
}

// ---------------------------------------------------------------------------
// JSON
// ---------------------------------------------------------------------------

function sendJson(
  res: Response,
  rows: Record<string, unknown>[],
  filename: string
): void {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.status(200).json({
    exported_at: new Date().toISOString(),
    count: rows.length,
    data: rows,
  });
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

function sendCsv(
  res: Response,
  rows: Record<string, unknown>[],
  filename: string
): void {
  if (rows.length === 0) return;

  const headers = Object.keys(rows[0]!);

  const escape = (value: unknown): string => {
    const str = value === null || value === undefined ? "" : String(value);
    // Wrap in quotes if the value contains a comma, quote, or newline
    return str.includes(",") || str.includes('"') || str.includes("\n")
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };

  const csvLines = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ];

  const csvContent = csvLines.join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.status(200).send(csvContent);
}

// ---------------------------------------------------------------------------
// Excel (.xlsx)
// ---------------------------------------------------------------------------

async function sendXlsx(
  res: Response,
  rows: Record<string, unknown>[],
  filename: string
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "HEMS Analytics";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Export", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  if (rows.length === 0) return;

  const headers = Object.keys(rows[0]!);

  // Header row — bold with a teal background matching the HEMS brand
  sheet.columns = headers.map((key) => ({
    header: key,
    key,
    width: Math.max(key.length + 4, 16),
  }));

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0D9488" }, // teal-600
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 20;

  // Data rows — alternate row shading for readability
  rows.forEach((row, i) => {
    const excelRow = sheet.addRow(row);
    if (i % 2 === 0) {
      excelRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF0FDFA" }, // teal-50
      };
    }
  });

  // Auto-filter on the header row
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: headers.length },
  };

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  await workbook.xlsx.write(res);
  res.end();
}