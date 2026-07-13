// alertServices.ts - Service for handling alerts and notifications
import { getIO } from "../utils/socketEvents.js";
import { Alert } from "../models/Alerts.js";
import logger from "../utils/logger.js";
import type { AlertEventPayload } from "../types/SocketEvents.js";

interface AlertPayload {
  userId: string;
  type: "anomaly" | "threshold" | "info";
  message: string;
  device?: string;
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

    const eventPayload: AlertEventPayload = {
      type: payload.type,
      message: payload.message,
      timestamp: new Date(),
      ...(payload.device ? { device: payload.device } : {}),
    };

    // Emit strictly to the authenticated User's room
    io.to(payload.userId).emit("alert", eventPayload);

    logger.info(`🚨 Alert pushed to user ${payload.userId}`);
  } catch (error) {
    logger.error(`Failed to push alert: ${(error as Error).message}`);
  }
};
