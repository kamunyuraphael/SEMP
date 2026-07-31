// telemetrySimulator.ts
// Your ML service (ml/bridge/poster.py) only ever posts PREDICTIONS to
// /api/ml/predictions — it never sends raw telemetry. Telemetry only
// ever entered the database via scripts/seed.ts, a one-time manual
// script. That means "today" (and this week, this month, as time moves
// forward) eventually runs dry no matter how well the day-boundary math
// works — there's simply nothing generating new readings.
//
// This job closes that gap: every 15 minutes, for every device in the
// system, it writes one realistic synthetic telemetry reading. It's the
// same "simulated for now, real hardware/ingestion later" pattern as
// deviceScheduler.ts — the moment you have real smart meters or the ML
// pipeline posts real telemetry, turn this off (see startTelemetrySimulator
// below) without touching anything downstream (pie chart, stat cards,
// Telemetry page) — they just read whatever's in the Telemetry
// collection, they don't know or care where it came from.

import cron from "node-cron";
import { Device } from "./models/Devices.js";
import { Telemetry } from "./models/Telemetry.js";
import logger from "./utils/logger.js";

const INTERVAL_MINUTES = 15;

// Typical *running* wattage as a fraction of a device's rated wattage —
// mirrors the ratios implied by scripts/seed.ts's hand-picked example
// devices (e.g. a fridge idles around 80% of its rated draw, a washing
// machine's motor is only near its rated peak in short bursts so its
// typical running average is much lower).
const CATEGORY_RUNNING_RATIO: Record<string, number> = {
  kitchen: 0.8,
  laundry: 0.2,
  lighting: 0.67,
  entertainment: 0.75,
  HVAC: 0.75,
  computing: 0.49,
};

// Fallback typical watts for devices with no ratedWattage set.
const CATEGORY_DEFAULT_WATTS: Record<string, number> = {
  kitchen: 120,
  laundry: 400,
  lighting: 40,
  entertainment: 90,
  HVAC: 900,
  computing: 220,
};

// Real appliances usually draw a small trickle even when "off"
// (standby power) rather than a hard zero — keeps inactive devices
// looking realistic instead of suspiciously flat.
const STANDBY_WATTS_RANGE: [number, number] = [1, 4];

function randomInRange([min, max]: [number, number]): number {
  return min + Math.random() * (max - min);
}

function simulateWatts(device: { category: string; ratedWattage?: number; status: string }): number {
  if (device.status !== "active") {
    return randomInRange(STANDBY_WATTS_RANGE);
  }

  const ratio = CATEGORY_RUNNING_RATIO[device.category] ?? 0.6;
  const baseline = device.ratedWattage
    ? device.ratedWattage * ratio
    : CATEGORY_DEFAULT_WATTS[device.category] ?? 100;

  // ±20% natural variance so consecutive readings aren't identical
  const variance = baseline * 0.2;
  const watts = baseline + (Math.random() * 2 - 1) * variance;
  return Math.max(1, Math.round(watts));
}

async function generateReadings(): Promise<void> {
  const devices = await Device.find({}).select("owner category ratedWattage status");
  if (devices.length === 0) return;

  const now = new Date();
  const hours = INTERVAL_MINUTES / 60;

  const docs = devices.map((device) => {
    const watts = simulateWatts(device);
    const kWh = (watts * hours) / 1000;
    return {
      device: device._id,
      user: device.owner,
      timestamp: now,
      watts,
      kWh,
      interval: "raw" as const,
    };
  });

  await Telemetry.insertMany(docs);
  logger.info(`Telemetry simulator: wrote ${docs.length} reading(s) at ${now.toISOString()}`);
}

export const startTelemetrySimulator = (): void => {
  cron.schedule(`*/${INTERVAL_MINUTES} * * * *`, () => {
    generateReadings().catch((error) => {
      logger.error(`Telemetry simulator failed: ${(error as Error).message}`);
    });
  });

  // Also generate one reading immediately on boot, so a fresh deploy
  // (or a demo that starts right after a cold start) doesn't have to
  // wait up to 15 minutes for the first cron tick.
  generateReadings().catch((error) => {
    logger.error(`Initial telemetry simulation failed: ${(error as Error).message}`);
  });

  logger.info(`Telemetry simulator registered (every ${INTERVAL_MINUTES} minutes).`);
};
