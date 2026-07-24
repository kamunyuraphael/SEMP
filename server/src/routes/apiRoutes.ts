// API Routes for HEMS Backend
// Handles all RESTful endpoints for authentication, device management, telemetry data, predictions, and alerts.
import { Router } from "express";

import { authMiddleware } from "../middleware/authMiddleware.js";
import { validateBody, validateQuery, validateParams } from "../middleware/validateRequest.js";
import { requireMlApiKey } from "../middleware/apiKeyAuth.js";

// Controllers
import { registerUser, loginUser, getProfile, changePassword, setBudget } from "../controllers/authController.js";
import { addDevice, deleteDevice, updateDeviceStatus, getDevices } from "../controllers/deviceController.js";
import { getTelemetry, addTelemetry, getCategoryBreakdown, getTelemetrySummary, getCategoryBreakdownRange, getComparison } from "../controllers/telemetryController.js";
import { getPredictions, addPrediction, resolveAnomaly, resolveAllAnomalies } from "../controllers/predictionController.js";
import { getAlerts, markAlertRead, markAllAlertsRead } from "../controllers/alertController.js";
import { mlPredictionWebhook } from "../controllers/mlController.js";
import { getForecast } from "../controllers/budgetController.js";
import { sendDigestNow, setDigestPreference } from "../controllers/reportController.js";

// Validation
import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  deviceSchema,
  deviceStatusSchema,
  telemetrySchema,
  telemetryQuerySchema,
  telemetrySummaryQuerySchema,
  telemetryRangeQuerySchema,
  comparisonQuerySchema,
  budgetSchema,
  digestPreferenceSchema,
  predictionSchema,
  mlPredictionSchema,
  idParamSchema,
} from "../validation/schemas.js";

import exportRoutes from './exportRoutes.js';

const router = Router();

/* ---------------- AUTH ROUTES ---------------- */
router.post("/auth/register", validateBody(registerSchema), registerUser);
router.post("/auth/login", validateBody(loginSchema), loginUser);
router.get("/auth/profile", authMiddleware, getProfile);
router.patch("/auth/change-password", authMiddleware, validateBody(changePasswordSchema), changePassword);
router.patch("/auth/budget", authMiddleware, validateBody(budgetSchema), setBudget);

/* ---------------- DEVICE ROUTES ---------------- */
router.post("/devices", authMiddleware, validateBody(deviceSchema), addDevice);
router.patch("/devices/:id/status", authMiddleware, validateParams(idParamSchema), validateBody(deviceStatusSchema), updateDeviceStatus);
router.delete("/devices/:id", authMiddleware, validateParams(idParamSchema), deleteDevice);
router.get("/devices", authMiddleware, getDevices);

/* ---------------- TELEMETRY ROUTES ---------------- */
router.get("/telemetry", authMiddleware, validateQuery(telemetryQuerySchema), getTelemetry);
router.post("/telemetry", authMiddleware, validateBody(telemetrySchema), addTelemetry);
router.get("/telemetry/breakdown", authMiddleware, validateQuery(telemetryQuerySchema), getCategoryBreakdown);
router.get("/telemetry/summary", authMiddleware, validateQuery(telemetrySummaryQuerySchema), getTelemetrySummary);
router.get("/telemetry/breakdown-range", authMiddleware, validateQuery(telemetryRangeQuerySchema), getCategoryBreakdownRange);
router.get("/telemetry/comparison", authMiddleware, validateQuery(comparisonQuerySchema), getComparison);

/* ---------------- BUDGET ROUTES ---------------- */
router.get("/budget/forecast", authMiddleware, getForecast);

/* ---------------- REPORT ROUTES ---------------- */
router.post("/reports/weekly/send-now", authMiddleware, sendDigestNow);
router.patch("/reports/weekly/preference", authMiddleware, validateBody(digestPreferenceSchema), setDigestPreference);

/* ---------------- PREDICTION ROUTES ---------------- */
router.get("/predictions", authMiddleware, getPredictions);
router.post("/predictions", authMiddleware, validateBody(predictionSchema), addPrediction);
router.patch("/predictions/resolve-all", authMiddleware, resolveAllAnomalies);
router.patch("/predictions/:id/resolve", authMiddleware, validateParams(idParamSchema), resolveAnomaly);

/* ---------------- ML WEBHOOK ---------------- */
router.post(
  "/ml/predictions",
  requireMlApiKey,
  validateBody(mlPredictionSchema),
  mlPredictionWebhook
);

/* ---------------- ALERT ROUTES ---------------- */
router.get("/alerts", authMiddleware, getAlerts);
router.patch("/alerts/read-all", authMiddleware, markAllAlertsRead);
router.patch("/alerts/:id/read", authMiddleware, validateParams(idParamSchema), markAlertRead);

/* ---------------- EXPORT ROUTES ---------------- */
router.use("/export", exportRoutes);

export default router;
