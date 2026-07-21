import type { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { getPredictionsByUser, ingestPrediction } from "../services/predictionService.js";
import { Prediction } from "../models/Prediction.js";
import type { IPrediction } from "../types/Prediction.d.js";

interface AuthRequest extends Request {
  user?: { id: string };
}

export const getPredictions = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const type = typeof req.query.type === "string" ? req.query.type : undefined;
    const predictions = await getPredictionsByUser(userId, type as IPrediction["type"] | undefined);
    res.status(200).json({ success: true, data: predictions });
  } catch (error) {
    next(error);
  }
};

export const addPrediction = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const payload = req.body as {
      device?: string;
      type: IPrediction["type"];
      predictedValue: number;
      confidence: number;
      targetDate: Date;
      anomalyDetails?: string;
    };

    const predictionPayload = {
      user: userId,
      type: payload.type,
      predictedValue: payload.predictedValue,
      confidence: payload.confidence,
      targetDate: payload.targetDate,
      ...(payload.device ? { device: payload.device } : {}),
      ...(payload.anomalyDetails ? { anomalyDetails: payload.anomalyDetails } : {}),
    };

    const prediction = await ingestPrediction(predictionPayload);
    res.status(201).json({ success: true, message: "Prediction added successfully", data: prediction });
  } catch (error) {
    next(error);
  }
};

export const resolveAnomaly = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const { id } = req.params;
    const prediction = await Prediction.findById(id);

    if (!prediction) {
      return res.status(404).json({ success: false, error: "Prediction not found" });
    }
    if (prediction.user.toString() !== userId) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    prediction.resolved = true;
    await prediction.save();

    res.status(200).json({ success: true, message: "Anomaly resolved", data: prediction });
  } catch (error) {
    next(error);
  }
};

export const resolveAllAnomalies = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const result = await Prediction.updateMany(
      { user: new Types.ObjectId(userId), type: "anomaly", resolved: false },
      { $set: { resolved: true } }
    );

    res.status(200).json({
      success: true,
      message: "All anomalies resolved",
      data: { modifiedCount: result.modifiedCount },
    });
  } catch (error) {
    next(error);
  }
};
