// alertController.ts
import type { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { Alert } from "../models/Alerts.js";
import type { IAlert } from "../types/Alert.d.js";

interface AuthRequest extends Request {
  user?: { id: string };
}

export const getAlerts = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const alerts = await Alert.find({ user: new Types.ObjectId(userId) } as any).sort({ timestamp: -1 }).lean();
    res.status(200).json({ success: true, data: alerts });
  } catch (error) {
    next(error);
  }
};

export const markAlertRead = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const { id } = req.params;
    const alert = await Alert.findById(id);

    if (!alert) {
      return res.status(404).json({ success: false, error: "Alert not found" });
    }
    if (alert.user.toString() !== userId) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    alert.read = true;
    await alert.save();

    res.status(200).json({ success: true, message: "Alert marked as read", data: alert });
  } catch (error) {
    next(error);
  }
};

export const markAllAlertsRead = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const result = await Alert.updateMany(
      { user: new Types.ObjectId(userId), read: false } as any,
      { $set: { read: true } }
    );

    res.status(200).json({
      success: true,
      message: "All alerts marked as read",
      data: { modifiedCount: result.modifiedCount },
    });
  } catch (error) {
    next(error);
  }
};
