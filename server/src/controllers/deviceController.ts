import type { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { Device } from "../models/Devices.js";
import { User } from "../models/User.js";
import type { IDevice } from "../types/Device.d.js";

interface AuthRequest extends Request {
  user?: { id: string };
}

export const addDevice = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const { name, category, status, location, ratedWattage } = req.body as Pick<
      IDevice,
      "name" | "category" | "status" | "location" | "ratedWattage"
    >;
    const device = new Device({
      name,
      category,
      status,
      location,
      ratedWattage,
      owner: new Types.ObjectId(userId),
    });
    await device.save();

    await User.findByIdAndUpdate(userId, { $push: { devices: device._id } });

    res.status(201).json({ success: true, message: "Device added successfully", data: device });
  } catch (error) {
    next(error);
  }
};

export const deleteDevice = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const device = await Device.findById(id);
    if (!device) {
      return res.status(404).json({ success: false, error: "Device not found" });
    }

    if (device.owner.toString() !== userId) {
      return res.status(403).json({ success: false, error: "Forbidden: Cannot delete another user's device" });
    }

    await Device.findByIdAndDelete(id);
    await User.findByIdAndUpdate(userId, { $pull: { devices: id } });

    res.status(200).json({ success: true, message: "Device deleted successfully" });
  } catch (error) {
    next(error);
  }
};

export const updateDeviceStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status } = req.body as { status: "active" | "inactive" };
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const device = await Device.findById(id);
    if (!device) {
      return res.status(404).json({ success: false, error: "Device not found" });
    }

    if (device.owner.toString() !== userId) {
      return res.status(403).json({ success: false, error: "Forbidden: Cannot modify another user's device" });
    }

    device.status = status;
    await device.save();

    res.status(200).json({ success: true, message: "Device status updated", data: device });
  } catch (error) {
    next(error);
  }
};

export const getDevices = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const devices = await Device.find({ owner: new Types.ObjectId(userId) }).lean();
    res.status(200).json({ success: true, data: devices });
  } catch (error) {
    next(error);
  }
};
