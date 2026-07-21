// Prediction.ts This file defines the Mongoose schema and model for predictions in the HEMS application. It includes fields for the user associated with the prediction, the type of prediction (bill, consumption, anomaly), the predicted value, confidence score, timestamps, and optional details for anomalies. The model is used to create, read, update, and delete prediction documents in the MongoDB database.
import { Schema, model, Document } from "mongoose";

export interface IPrediction extends Document {
  user: Schema.Types.ObjectId;   // Reference to User
  device?: Schema.Types.ObjectId; // Optional: per-device prediction
  type: "bill" | "consumption" | "anomaly";
  predictedValue: number;        // Forecasted kWh or bill amount
  confidence: number;            // Confidence score (0–1)
  timestamp: Date;               // When prediction was made
  targetDate: Date;              // Future date the prediction applies to
  anomalyDetails?: string;       // Extra info if anomaly detected
  resolved: boolean;             // For type: 'anomaly' — has the user acknowledged this?
  createdAt: Date;               // When the document was created
  updatedAt: Date;               // When the document was last updated
}

const predictionSchema = new Schema<IPrediction>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    device: { type: Schema.Types.ObjectId, ref: "Device" },
    type: { type: String, enum: ["bill", "consumption", "anomaly"], required: true },
    predictedValue: { type: Number, required: true },
    confidence: { type: Number, min: 0, max: 1, default: 0.8 },
    timestamp: { type: Date, default: Date.now },
    targetDate: { type: Date, required: true },
    anomalyDetails: { type: String },
    resolved: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Prediction = model<IPrediction>("Prediction", predictionSchema);
