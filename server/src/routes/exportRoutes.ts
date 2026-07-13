// exportRoutes.ts
// Registers the export endpoints and their Zod query validation schemas.

import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { validateQuery } from "../middleware/validateRequest.js";
import { exportTelemetry, exportPredictions } from "../controllers/exportController.js";

const router = Router();

// Shared export query schema
const exportQuerySchema = z.object({
  format: z.enum(["csv", "json", "xlsx"]).default("json"),
  from: z.string().optional(),
  to: z.string().optional(),
});

// Telemetry export — adds optional interval filter
const telemetryExportSchema = exportQuerySchema.extend({
  interval: z.enum(["raw", "daily", "weekly", "monthly"]).optional(),
});

// Predictions export — adds optional type filter
const predictionsExportSchema = exportQuerySchema.extend({
  type: z.enum(["bill", "consumption", "anomaly"]).optional(),
});

/**
 * GET /api/export/telemetry
 *
 * Query params:
 *   format   csv | json | xlsx     (default: json)
 *   interval raw | daily | weekly | monthly
 *   from     ISO date string       (default: 30 days ago)
 *   to       ISO date string       (default: today)
 *
 * Examples:
 *   /api/export/telemetry?format=csv&interval=daily&from=2024-01-01&to=2024-01-31
 *   /api/export/telemetry?format=xlsx&interval=monthly
 */
router.get(
  "/telemetry",
  authMiddleware,
  validateQuery(telemetryExportSchema),
  exportTelemetry
);

/**
 * GET /api/export/predictions
 *
 * Query params:
 *   format   csv | json | xlsx     (default: json)
 *   type     bill | consumption | anomaly
 *   from     ISO date string       (default: 30 days ago)
 *   to       ISO date string       (default: today)
 *
 * Examples:
 *   /api/export/predictions?format=csv&type=consumption
 *   /api/export/predictions?format=xlsx&from=2024-01-01
 */
router.get(
  "/predictions",
  authMiddleware,
  validateQuery(predictionsExportSchema),
  exportPredictions
);

export default router;