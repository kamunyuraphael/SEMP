/**
 * Seed script for SEMP (Home Energy Management System).
 *
 * Populates MongoDB with a realistic demo dataset: users, devices, historical
 * telemetry, alerts, and predictions, so the app has data to show immediately.
 *
 * Usage:
 *   pnpm --filter @workspace/api-server run seed
 *
 * By default this only clears data owned by the demo users it creates
 * (matched by email) — it will not touch other users' data.
 */
import bcrypt from "bcryptjs";
import mongoose, { Types } from "mongoose";
import { connectDB } from "../config/db.js";
import logger from "../utils/logger.js";
import { User } from "../models/User.js";
import { Device } from "../models/Devices.js";
import { Telemetry } from "../models/Telemetry.js";
import { Alert } from "../models/Alerts.js";
import { Prediction } from "../models/Prediction.js";

const DAYS_OF_HISTORY = 21;
const HOURS_PER_DAY = 24;

interface DeviceBlueprint {
  name: string;
  category: "kitchen" | "laundry" | "lighting" | "entertainment" | "HVAC" | "computing";
  location: string;
  ratedWattage: number;
  status: "active" | "inactive";
  /** Base watts per hour-of-day (0-23), used as a realistic usage curve. */
  hourlyProfile: (hour: number) => number;
}

interface DemoUserBlueprint {
  username: string;
  email: string;
  password: string;
  role: "user" | "admin";
  devices: DeviceBlueprint[];
}

/** Small deterministic-ish noise so repeated seeds don't look identical every run. */
function jitter(base: number, spreadPct: number): number {
  const factor = 1 + (Math.random() * 2 - 1) * spreadPct;
  return Math.max(0, base * factor);
}

const fridgeProfile: DeviceBlueprint["hourlyProfile"] = () => jitter(90, 0.15);

const hvacProfile: DeviceBlueprint["hourlyProfile"] = (hour) => {
  // Higher load midday/afternoon (cooling), low overnight.
  const midday = hour >= 11 && hour <= 18;
  const evening = hour >= 19 && hour <= 22;
  if (midday) return jitter(1800, 0.2);
  if (evening) return jitter(1200, 0.2);
  return jitter(300, 0.3);
};

const lightingProfile: DeviceBlueprint["hourlyProfile"] = (hour) => {
  const isEvening = hour >= 18 || hour <= 6;
  return isEvening ? jitter(60, 0.25) : jitter(5, 0.5);
};

const entertainmentProfile: DeviceBlueprint["hourlyProfile"] = (hour) => {
  const isPrimeTime = hour >= 19 && hour <= 23;
  return isPrimeTime ? jitter(150, 0.2) : jitter(8, 0.5);
};

const laundryProfile: DeviceBlueprint["hourlyProfile"] = (hour) => {
  const isWashTime = hour === 9 || hour === 18;
  return isWashTime ? jitter(500, 0.15) : jitter(2, 0.5);
};

const computingProfile: DeviceBlueprint["hourlyProfile"] = (hour) => {
  const isWorkHours = hour >= 9 && hour <= 17;
  return isWorkHours ? jitter(220, 0.15) : jitter(15, 0.4);
};

const ovenProfile: DeviceBlueprint["hourlyProfile"] = (hour) => {
  const isCooking = hour === 8 || hour === 12 || hour === 19;
  return isCooking ? jitter(1500, 0.2) : jitter(0, 1);
};

const demoUsers: DemoUserBlueprint[] = [
  {
    username: "demo",
    email: "demo@semp.app",
    password: "Demo1234!",
    role: "user",
    devices: [
      {
        name: "Kitchen Refrigerator",
        category: "kitchen",
        location: "Kitchen",
        ratedWattage: 150,
        status: "active",
        hourlyProfile: fridgeProfile,
      },
      {
        name: "Electric Oven",
        category: "kitchen",
        location: "Kitchen",
        ratedWattage: 2400,
        status: "active",
        hourlyProfile: ovenProfile,
      },
      {
        name: "Living Room AC",
        category: "HVAC",
        location: "Living Room",
        ratedWattage: 2000,
        status: "active",
        hourlyProfile: hvacProfile,
      },
      {
        name: "Washing Machine",
        category: "laundry",
        location: "Utility Room",
        ratedWattage: 600,
        status: "active",
        hourlyProfile: laundryProfile,
      },
      {
        name: "Living Room Lights",
        category: "lighting",
        location: "Living Room",
        ratedWattage: 80,
        status: "active",
        hourlyProfile: lightingProfile,
      },
      {
        name: "OLED TV",
        category: "entertainment",
        location: "Living Room",
        ratedWattage: 180,
        status: "active",
        hourlyProfile: entertainmentProfile,
      },
      {
        name: "Home Office Desktop",
        category: "computing",
        location: "Home Office",
        ratedWattage: 250,
        status: "active",
        hourlyProfile: computingProfile,
      },
      {
        name: "Garage Freezer",
        category: "kitchen",
        location: "Garage",
        ratedWattage: 120,
        status: "inactive",
        hourlyProfile: () => 0,
      },
    ],
  },
  {
    username: "alex",
    email: "alex@semp.app",
    password: "Demo1234!",
    role: "user",
    devices: [
      {
        name: "Bedroom AC",
        category: "HVAC",
        location: "Bedroom",
        ratedWattage: 1200,
        status: "active",
        hourlyProfile: hvacProfile,
      },
      {
        name: "Refrigerator",
        category: "kitchen",
        location: "Kitchen",
        ratedWattage: 140,
        status: "active",
        hourlyProfile: fridgeProfile,
      },
      {
        name: "Gaming PC",
        category: "computing",
        location: "Bedroom",
        ratedWattage: 450,
        status: "active",
        hourlyProfile: computingProfile,
      },
      {
        name: "Hallway Lights",
        category: "lighting",
        location: "Hallway",
        ratedWattage: 40,
        status: "active",
        hourlyProfile: lightingProfile,
      },
    ],
  },
  {
    username: "admin",
    email: "admin@semp.app",
    password: "Admin1234!",
    role: "admin",
    devices: [
      {
        name: "Server Rack UPS",
        category: "computing",
        location: "Server Room",
        ratedWattage: 800,
        status: "active",
        hourlyProfile: () => jitter(650, 0.1),
      },
    ],
  },
];

async function clearExistingDemoData(emails: string[]): Promise<void> {
  const existingUsers = await User.find({ email: { $in: emails } }).select("_id");
  const userIds = existingUsers.map((u) => u._id);

  if (userIds.length === 0) return;

  await Promise.all([
    Telemetry.deleteMany({ user: { $in: userIds } }),
    Alert.deleteMany({ user: { $in: userIds } }),
    Prediction.deleteMany({ user: { $in: userIds } }),
    Device.deleteMany({ owner: { $in: userIds } }),
    User.deleteMany({ _id: { $in: userIds } }),
  ]);

  logger.info(`Cleared existing demo users and their data (count: ${userIds.length})`);
}

async function seedUserWithDevices(blueprint: DemoUserBlueprint): Promise<{
  userId: Types.ObjectId;
  devices: { id: Types.ObjectId; blueprint: DeviceBlueprint }[];
}> {
  const hashedPassword = await bcrypt.hash(blueprint.password, 10);

  const user = await User.create({
    username: blueprint.username,
    email: blueprint.email,
    password: hashedPassword,
    role: blueprint.role,
    devices: [],
  });

  const createdDevices: { id: Types.ObjectId; blueprint: DeviceBlueprint }[] = [];

  for (const deviceBp of blueprint.devices) {
    const device = await Device.create({
      name: deviceBp.name,
      category: deviceBp.category,
      status: deviceBp.status,
      location: deviceBp.location,
      ratedWattage: deviceBp.ratedWattage,
      owner: user._id,
      consumptionLogs: [],
    });
    createdDevices.push({ id: device._id as Types.ObjectId, blueprint: deviceBp });
  }

  user.devices = createdDevices.map((d) => d.id);
  await user.save();

  return { userId: user._id as Types.ObjectId, devices: createdDevices };
}

async function seedTelemetryForDevice(
  userId: Types.ObjectId,
  deviceId: Types.ObjectId,
  blueprint: DeviceBlueprint
): Promise<{ totalKWh: number; anomalyInjected: boolean; lastReading?: Date }> {
  if (blueprint.status === "inactive") {
    return { totalKWh: 0, anomalyInjected: false };
  }

  const now = new Date();
  const readings: {
    device: Types.ObjectId;
    user: Types.ObjectId;
    timestamp: Date;
    watts: number;
    kWh: number;
    interval: "raw";
  }[] = [];

  // Inject one anomalous spike partway through history for anomaly-detection demo data.
  const anomalyDayOffset = Math.floor(Math.random() * (DAYS_OF_HISTORY - 2)) + 1;
  const anomalyHour = Math.floor(Math.random() * HOURS_PER_DAY);
  let anomalyInjected = false;

  const dailyKWhByDate = new Map<string, number>();
  let totalKWh = 0;
  let lastReading: Date | undefined;

  for (let dayOffset = DAYS_OF_HISTORY; dayOffset >= 0; dayOffset--) {
    for (let hour = 0; hour < HOURS_PER_DAY; hour++) {
      const timestamp = new Date(now);
      timestamp.setDate(timestamp.getDate() - dayOffset);
      timestamp.setHours(hour, 0, 0, 0);

      // Skip future timestamps (final partial day).
      if (timestamp > now) continue;

      let watts = blueprint.hourlyProfile(hour);

      const isAnomalyMoment = dayOffset === anomalyDayOffset && hour === anomalyHour;
      if (isAnomalyMoment && watts > 0) {
        watts = watts * (3 + Math.random() * 2); // 3x-5x spike
        anomalyInjected = true;
      }

      const kWh = watts / 1000; // ~1 hour interval reading

      readings.push({
        device: deviceId,
        user: userId,
        timestamp,
        watts: Math.round(watts * 100) / 100,
        kWh: Math.round(kWh * 1000) / 1000,
        interval: "raw",
      });

      const dateKey = timestamp.toISOString().slice(0, 10);
      dailyKWhByDate.set(dateKey, (dailyKWhByDate.get(dateKey) ?? 0) + kWh);
      totalKWh += kWh;
      lastReading = timestamp;
    }
  }

  if (readings.length > 0) {
    await Telemetry.insertMany(readings, { ordered: false });
  }

  const consumptionLogs = Array.from(dailyKWhByDate.entries()).map(([dateKey, kWh]) => ({
    date: new Date(`${dateKey}T00:00:00.000Z`),
    kWh: Math.round(kWh * 1000) / 1000,
  }));

  await Device.updateOne({ _id: deviceId }, { $set: { consumptionLogs } });

  return {
    totalKWh,
    anomalyInjected,
    ...(lastReading !== undefined ? { lastReading } : {}),
  };
}

async function seedAlertsAndPredictions(
  userId: Types.ObjectId,
  devicesWithAnomalies: { id: Types.ObjectId; name: string; lastReading: Date }[],
  allDeviceIds: Types.ObjectId[]
): Promise<void> {
  const alerts: {
    user: Types.ObjectId;
    device: Types.ObjectId;
    type: "anomaly" | "threshold" | "info";
    message: string;
    timestamp: Date;
    read: boolean;
  }[] = devicesWithAnomalies.map((d) => ({
    user: userId,
    device: d.id,
    type: "anomaly" as const,
    message: `Unusual power spike detected on ${d.name}.`,
    timestamp: d.lastReading,
    read: false,
  }));

  alerts.push({
    user: userId,
    device: allDeviceIds[0] as Types.ObjectId,
    type: "info" as const,
    message: "Welcome to SEMP! Your energy monitoring dashboard is ready.",
    timestamp: new Date(Date.now() - DAYS_OF_HISTORY * 24 * 60 * 60 * 1000),
    read: true,
  });

  if (alerts.length > 0) {
    await Alert.insertMany(alerts, { ordered: false });
  }

  const anomalyPredictions = devicesWithAnomalies.map((d) => ({
    user: userId,
    device: d.id,
    type: "anomaly" as const,
    predictedValue: Math.round((Math.random() * 3 + 2) * 100) / 100,
    confidence: Math.round((0.75 + Math.random() * 0.2) * 100) / 100,
    timestamp: d.lastReading,
    targetDate: d.lastReading,
    anomalyDetails: `Consumption on ${d.name} exceeded expected range by 3-5x.`,
    resolved: false,
  }));

  const billPrediction = {
    user: userId,
    type: "bill" as const,
    predictedValue: Math.round((80 + Math.random() * 60) * 100) / 100,
    confidence: 0.82,
    timestamp: new Date(),
    targetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
    resolved: false,
  };

  const consumptionPrediction = {
    user: userId,
    type: "consumption" as const,
    predictedValue: Math.round((250 + Math.random() * 150) * 100) / 100,
    confidence: 0.78,
    timestamp: new Date(),
    targetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
    resolved: false,
  };

  await Prediction.insertMany([...anomalyPredictions, billPrediction, consumptionPrediction], {
    ordered: false,
  });
}

async function run(): Promise<void> {
  await connectDB();

  const emails = demoUsers.map((u) => u.email);
  await clearExistingDemoData(emails);

  for (const blueprint of demoUsers) {
    const { userId, devices } = await seedUserWithDevices(blueprint);
    logger.info(
      `Created demo user and devices (email: ${blueprint.email}, deviceCount: ${devices.length})`
    );

    const devicesWithAnomalies: { id: Types.ObjectId; name: string; lastReading: Date }[] = [];

    for (const { id, blueprint: deviceBp } of devices) {
      const { totalKWh, anomalyInjected, lastReading } = await seedTelemetryForDevice(
        userId,
        id,
        deviceBp
      );
      if (anomalyInjected && lastReading) {
        devicesWithAnomalies.push({ id, name: deviceBp.name, lastReading });
      }
      logger.info(
        `Seeded telemetry for device (device: ${deviceBp.name}, totalKWh: ${Math.round(totalKWh * 100) / 100})`
      );
    }

    await seedAlertsAndPredictions(
      userId,
      devicesWithAnomalies,
      devices.map((d) => d.id)
    );
    logger.info(`Seeded alerts and predictions (email: ${blueprint.email})`);
  }

  const credentials = demoUsers.map((u) => `${u.email} / ${u.password}`).join(", ");
  logger.info(`Seed complete. Demo login credentials: ${credentials}`);
}

run()
  .then(() => {
    logger.info("Database seeding finished successfully.");
    return mongoose.connection.close();
  })
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    logger.error(`Seeding failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
    return mongoose.connection.close().finally(() => process.exit(1));
  });
