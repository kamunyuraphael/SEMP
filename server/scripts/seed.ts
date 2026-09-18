// scripts/seed.ts
//
// Populates YOUR real registered account with realistic devices,
// telemetry, predictions, and alerts — so the client can be exercised
// end-to-end against the server without needing the Python analytics
// layer running yet.
//
// Unlike an earlier version of this script, this does NOT create a new
// demo account or touch your password — it looks up your existing
// account by email (falling back to the _id below if the email lookup
// fails) and only ever seeds/clears THAT account's own devices,
// telemetry, predictions, and alerts. Safe to re-run.
//
// Usage (once server dependencies are set up):
//   npx tsx scripts/seed.ts

import dotenv from "dotenv";
import mongoose, { Types } from "mongoose";
import { connectDB } from "../src/config/db.js";
import { User } from "../src/models/User.js";
import { Device } from "../src/models/Devices.js";
import { Telemetry } from "../src/models/Telemetry.js";
import { Prediction } from "../src/models/Prediction.js";
import { Alert } from "../src/models/Alerts.js";
import logger from "../src/utils/logger.js";

dotenv.config();

// Your real registered account — script looks this up rather than
// creating a fresh one, so your actual password is never touched.
const TARGET_EMAIL = "raphaelkamaukamunyu@gmail.com";
const TARGET_ID_FALLBACK = "6a4f8d9c4d9d86cc9fa82ed0";

const DEVICE_SEEDS: Array<{
  name: string;
  category: "kitchen" | "laundry" | "lighting" | "entertainment" | "HVAC" | "computing";
  location: string;
  ratedWattage: number;
  baseWatts: number; // typical *running* wattage, used to generate telemetry (often lower than ratedWattage's peak rating)
  status: "active" | "inactive";
}> = [
  { name: "Kitchen Fridge",      category: "kitchen",       location: "Kitchen",     ratedWattage: 150,  baseWatts: 120, status: "active" },
  { name: "Washing Machine",     category: "laundry",       location: "Utility",     ratedWattage: 2200, baseWatts: 450, status: "active" },
  { name: "Living Room Lights",  category: "lighting",      location: "Living Room", ratedWattage: 60,   baseWatts: 40,  status: "active" },
  { name: "Living Room TV",      category: "entertainment", location: "Living Room", ratedWattage: 120,  baseWatts: 90,  status: "active" },
  { name: "Bedroom AC Unit",     category: "HVAC",          location: "Bedroom",     ratedWattage: 1200, baseWatts: 900, status: "inactive" },
  { name: "Home Office Desktop", category: "computing",     location: "Office",      ratedWattage: 450,  baseWatts: 220, status: "active" },
];

// 45 days back covers: today vs yesterday, month-to-date vs last month
// (same elapsed period), and the Telemetry page's 24h/7d/30d ranges.
const TELEMETRY_DAYS = 45;

async function seed() {
  await connectDB();
  logger.info("Connected — seeding test data");

  // ── Find your existing account (never create/overwrite a password) ──
  let user = await User.findOne({ email: TARGET_EMAIL.toLowerCase() });

  if (!user) {
    user = await User.findById(TARGET_ID_FALLBACK).catch(() => null);
  }

  if (!user) {
    logger.error(
      `No account found for ${TARGET_EMAIL} or _id ${TARGET_ID_FALLBACK}. ` +
      `Register through the app first, then re-run this script.`
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  if (user._id.toString() !== TARGET_ID_FALLBACK) {
    logger.warn(
      `Note: found account by email with _id ${user._id}, which differs ` +
      `from the _id you provided (${TARGET_ID_FALLBACK}). Using the real ` +
      `one from the database.`
    );
  }

  const userId = user._id as Types.ObjectId;
  logger.info(`Seeding data for ${user.email} (${userId})`);

  // ── Clear this user's previous seed data so re-runs don't duplicate ──
  await Promise.all([
    Device.deleteMany({ owner: userId }),
    Telemetry.deleteMany({ user: userId }),
    Prediction.deleteMany({ user: userId }),
    Alert.deleteMany({ user: userId }),
  ]);

  // ── Devices ────────────────────────────────────────────────────────
  const devices = await Device.insertMany(
    DEVICE_SEEDS.map((d) => ({
      name: d.name,
      category: d.category,
      status: d.status,
      location: d.location,
      ratedWattage: d.ratedWattage,
      owner: userId,
      consumptionLogs: [],
    }))
  );
  logger.info(`Created ${devices.length} devices`);

  // Keep the user's devices[] reference list in sync, matching how a
  // real device-creation flow would leave the user document.
  user.devices = devices.map((d) => d._id as any);
  await user.save();

  // ── Telemetry: hourly readings for the last TELEMETRY_DAYS days ─────
  const telemetryDocs: any[] = [];
  const now = new Date();

  for (const device of devices) {
    const seedInfo = DEVICE_SEEDS.find((d) => d.name === device.name)!;
    if (seedInfo.status === "inactive") continue; // inactive devices report nothing

    for (let hoursAgo = TELEMETRY_DAYS * 24; hoursAgo >= 0; hoursAgo--) {
      const timestamp = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);

      // Day/night variation plus a mild long-term upward drift so
      // "this month vs last month" trends aren't flatly identical.
      const hourOfDay = timestamp.getHours();
      const isDaytime = hourOfDay >= 7 && hourOfDay <= 22;
      const activityMultiplier = isDaytime ? 1 : 0.4;
      const daysAgo = hoursAgo / 24;
      const driftMultiplier = 1 + (TELEMETRY_DAYS - daysAgo) / TELEMETRY_DAYS * 0.15; // up to +15% more recently
      const jitter = 0.85 + Math.random() * 0.3; // ±15%
      const watts = Math.round(seedInfo.baseWatts * activityMultiplier * driftMultiplier * jitter);
      const kWh = Number(((watts * 1) / 1000).toFixed(4)); // 1-hour interval

      telemetryDocs.push({
        device: device._id,
        user: userId,
        timestamp,
        watts,
        kWh,
        interval: "raw",
      });
    }
  }

  await Telemetry.insertMany(telemetryDocs);
  logger.info(`Created ${telemetryDocs.length} telemetry records`);

  // ── Predictions ──────────────────────────────────────────────────────
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const activeDevices = devices.filter((d) => d.status === "active");
  const washingMachine = activeDevices.find((d) => d.name === "Washing Machine");
  const desktop = activeDevices.find((d) => d.name === "Home Office Desktop");

  const predictionDocs = [
    {
      user: userId,
      type: "bill" as const,
      predictedValue: 842.5, // KSh, matching the client's KSh-per-kWh convention
      confidence: 0.87,
      targetDate: tomorrow,
    },
    {
      user: userId,
      type: "consumption" as const,
      predictedValue: 2.35,
      confidence: 0.81,
      targetDate: tomorrow,
    },
    ...activeDevices.slice(0, 2).map((device) => ({
      user: userId,
      device: device._id,
      type: "consumption" as const,
      predictedValue: Number((Math.random() * 1.5 + 0.3).toFixed(2)),
      confidence: 0.78,
      targetDate: tomorrow,
    })),
    // Anomalies — a mix of resolved and unresolved, and of severities
    // (severity is embedded in anomalyDetails text, matching what the
    // Python AnomalyDetector actually writes).
    {
      user: userId,
      device: washingMachine?._id,
      type: "anomaly" as const,
      predictedValue: 1.9,
      confidence: 0.92,
      targetDate: now,
      anomalyDetails: "Unusual overnight usage detected (severity: high): 1.9kWh between 01:00-02:00",
      resolved: false,
    },
    {
      user: userId,
      device: desktop?._id,
      type: "anomaly" as const,
      predictedValue: 0.6,
      confidence: 0.74,
      targetDate: new Date(now.getTime() - 22 * 60 * 1000),
      anomalyDetails: "Consumption 35% above baseline (severity: medium)",
      resolved: false,
    },
    {
      user: userId,
      device: activeDevices.find((d) => d.name === "Kitchen Fridge")?._id,
      type: "anomaly" as const,
      predictedValue: 0.05,
      confidence: 0.68,
      targetDate: new Date(now.getTime() - 3 * 60 * 60 * 1000),
      anomalyDetails: "Brief signal dropout detected (severity: low)",
      resolved: true,
    },
  ];

  await Prediction.insertMany(predictionDocs);
  logger.info(`Created ${predictionDocs.length} predictions`);

  // ── Alerts ───────────────────────────────────────────────────────────
  const alertDocs = [
    {
      user: userId,
      device: washingMachine?._id,
      type: "anomaly" as const,
      message: "Unusual overnight usage detected on Washing Machine: 1.9kWh between 01:00-02:00",
      timestamp: now,
      read: false,
    },
    {
      user: userId,
      device: desktop?._id,
      type: "anomaly" as const,
      message: "Home Office Desktop consumption 35% above baseline",
      timestamp: new Date(now.getTime() - 22 * 60 * 1000),
      read: false,
    },
    {
      user: userId,
      type: "threshold" as const,
      message: "Daily consumption is trending 18% above your weekly average",
      timestamp: new Date(now.getTime() - 3 * 60 * 60 * 1000),
      read: false,
    },
    {
      user: userId,
      type: "info" as const,
      message: "Welcome to SEMP — your devices are now being monitored",
      timestamp: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      read: true,
    },
  ];

  await Alert.insertMany(alertDocs);
  logger.info(`Created ${alertDocs.length} alerts`);

  // ── Summary ──────────────────────────────────────────────────────────
  console.log("\n=== Seed complete ===");
  console.log(`Account:  ${user.email}`);
  console.log(`User _id: ${userId.toString()}`);
  console.log(
    "\nThis _id should already match analytics-python's DEFAULT_USER_ID " +
    "in .env — double check they agree so ML predictions land on this " +
    "same account.\n"
  );

  await mongoose.disconnect();
}

seed().catch((error) => {
  logger.error("Seeding failed:", error);
  mongoose.disconnect().finally(() => process.exit(1));
});