// Devices.ts - This file defines the Mongoose schema and model for devices in the HEMS application. It includes fields for the device name, category, status, owner, and consumption logs. The model is used to create, read, update, and delete device documents in the MongoDB database.
import { Schema, model, Document } from "mongoose";

export interface IDevice extends Document {
  name: string;
  category: "kitchen" | "laundry" | "lighting" | "entertainment" | "HVAC" | "computing";
  status: "active" | "inactive";
  location?: string;
  ratedWattage?: number;
  owner: Schema.Types.ObjectId; // References User
  consumptionLogs: {
    date: Date;
    kWh: number;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const deviceSchema = new Schema<IDevice>(
  {
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ["kitchen", "laundry", "lighting", "entertainment", "HVAC", "computing"],
      required: true,
    },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    location: { type: String, trim: true },
    ratedWattage: { type: Number, min: 0 },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    consumptionLogs: [
      {
        date: { type: Date, default: Date.now },
        kWh: { type: Number, required: true },
      },
    ],
  },
  { timestamps: true }
);

export const Device = model<IDevice>("Device", deviceSchema);
