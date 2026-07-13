// predictionService.ts
import axios from "axios";
import { Types } from "mongoose";
import { Prediction } from "../models/Prediction.js";
import { pushAlert } from "./alertServices.js";
import type { IPrediction } from "../types/Prediction.d.js";

export interface PredictionInput {
  user: string | Types.ObjectId;
  device?: string | Types.ObjectId;
  type: IPrediction["type"];
  predictedValue: number;
  confidence: number;
  targetDate: string | Date;
  anomalyDetails?: string;
}

export const ingestPrediction = async (payload: PredictionInput) => {
  try {
    const prediction = new Prediction({
      user: new Types.ObjectId(payload.user),
      device: payload.device ? new Types.ObjectId(payload.device) : undefined,
      type: payload.type,
      predictedValue: payload.predictedValue,
      confidence: payload.confidence,
      targetDate: new Date(payload.targetDate),
      anomalyDetails: payload.anomalyDetails,
    });
    await prediction.save();

    if (payload.type === "anomaly" && payload.anomalyDetails) {
      const baseAlert = {
        userId: payload.user.toString(),
        type: "anomaly" as const,
        message: `Anomaly detected: ${payload.anomalyDetails}`,
      };

      await pushAlert({
        ...baseAlert,
        ...(payload.device ? { device: payload.device.toString() } : {}),
      });
    }

    return prediction;
  } catch (error) {
    console.error("Prediction ingestion failed:", error);
    throw error;
  }
};

export const getPredictionsByUser = async (userId: string, type?: IPrediction["type"]) => {
  const filter: Record<string, unknown> = {
    user: new Types.ObjectId(userId),
  };

  if (type) {
    filter.type = type;
  }

  return Prediction.find(filter as any).sort({ timestamp: -1 }).limit(100).lean();
};

// Example: Fetch predictions from Python ML API
export const fetchFromPythonML = async () => {
  try {
    const response = await axios.get("http://localhost:8000/ml/predictions");
    const tasks = response.data.map((p: PredictionInput) => ingestPrediction(p));
    await Promise.all(tasks);
  } catch (error) {
    console.error("Batch prediction ingestion failed:", error);
  }
};
