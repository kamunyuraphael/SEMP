// mlController.ts
import type { Request, Response, NextFunction } from "express";
import { ingestPrediction } from "../services/predictionService.js";

export const mlPredictionWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = req.body;

    // ingestPrediction already persists the Alert document AND emits the
    // "alert" socket event via alertServices.pushAlert() when type === "anomaly"
    // with anomalyDetails present. Do not duplicate that here — an earlier
    // version of this handler also emitted its own separate "alert" event,
    // which caused every anomaly to fire two live toasts on the client while
    // only one was ever persisted to MongoDB (so a page refresh showed a
    // different count than what flashed live). Removed.
    const prediction = await ingestPrediction({
      user: payload.userId,
      device: payload.device,
      type: payload.type,
      predictedValue: payload.predictedValue,
      confidence: payload.confidence,
      targetDate: payload.targetDate,
      anomalyDetails: payload.anomalyDetails,
    });

    res.status(201).json({ success: true, message: "ML prediction ingested successfully", data: prediction });
  } catch (error) {
    next(error);
  }
};
