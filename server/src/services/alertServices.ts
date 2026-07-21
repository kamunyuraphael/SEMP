// alertServices.ts - Service for handling alerts and notifications
import { getIO } from "../utils/socketEvents.js";
import { Alert } from "../models/Alerts.js";
import { Device } from "../models/Devices.js";
import logger from "../utils/logger.js";
import type { AlertEventPayload } from "../types/SocketEvents.d.js";

interface AlertPayload {
  userId: string;
  type: "anomaly" | "threshold" | "info";
  message: string;
  device?: string; // Device ObjectId — used for persistence + name lookup below
}

export const pushAlert = async (payload: AlertPayload): Promise<void> => {
  try {
    // Persist the alert to MongoDB for historical tracking
    const alert = new Alert({
      user: payload.userId,
      type: payload.type,
      message: payload.message,
      device: payload.device,
    });
    await alert.save();

    // Safely take the Socket.io instance 
    const io = getIO();

    // Resolve the device's actual name for the live toast. The
    // persisted Alert.device field stays an ObjectId reference (needed
    // for the schema/relations), but a live notification showing a raw
    // hex string ("68e1a2..." — anomaly) is meaningless to a user —
    // the toast needs the human-readable name instead.
    let deviceLabel: string | undefined;
    if (payload.device) {
      const device = await Device.findById(payload.device).select("name").lean();
      deviceLabel = device?.name;
    }

    const eventPayload: AlertEventPayload = {
      type: payload.type,
      message: payload.message,
      timestamp: new Date(),
      ...(deviceLabel ? { device: deviceLabel } : {}),
    };

    // Emit strictly to the authenticated User's room
    io.to(payload.userId).emit("alert", eventPayload);

    logger.info(`🚨 Alert pushed to user ${payload.userId}`);
  } catch (error) {
    logger.error(`Failed to push alert: ${(error as Error).message}`);
  }
};
