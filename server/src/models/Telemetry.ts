// Telemetry.ts - Mongoose model for storing energy consumption data
import { Schema, model, Document } from "mongoose";
import type { ITelemetryData } from "../types/Telemetry.d.js";

export interface ITelemetry extends ITelemetryData, Document {}

const telemetrySchema = new Schema<ITelemetry>(
  {
    device: { type: Schema.Types.ObjectId, ref: "Device", required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    timestamp: { type: Date, default: Date.now, index: true },
    watts: { type: Number, required: true },
    kWh: { type: Number, required: true },
    interval: { 
      type: String, 
      enum: ["raw", "daily", "weekly", "monthly"], 
      default: "raw",
      required: true },
  },
  { timestamps: true }
);

// high performance indexing for real-time reads and timeline charts
telemetrySchema.index({ user: 1, interval: 1, timestamp: -1 });
telemetrySchema.index({ user: 1, device: 1, timestamp: -1 });

export const Telemetry = model<ITelemetry>("Telemetry", telemetrySchema);
