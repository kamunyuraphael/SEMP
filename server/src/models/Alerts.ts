// Alert.ts - This file defines the Mongoose schema and model for alerts in the HEMS application. It includes fields for the user associated with the alert, the type of alert, the message, timestamp, and whether the alert has been read. The model is used to create, read, update, and delete alert documents in the MongoDB database.
import { Schema, model, Document, Types } from "mongoose";

export interface IAlert extends Document {
  user: Types.ObjectId;   // Reference to User
  device?: Types.ObjectId; // Optional: device linked to alert
  type: "anomaly" | "threshold" | "info";
  message: string;
  timestamp: Date;
  read: boolean;                 // Whether user has seen the alert
}

const alertSchema = new Schema<IAlert>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    device: { type: Schema.Types.ObjectId, ref: "Device" },
    type: { type: String, enum: ["anomaly", "threshold", "info"], required: true },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Alert = model<IAlert>("Alert", alertSchema);
