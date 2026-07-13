import { Types } from "mongoose";

export interface IAlert {
    _id: Types.ObjectId;
    user: Types.ObjectId;   // Reference to User
    device?: Types.ObjectId; // Optional: device linked to alert
    type: "anomaly" | "threshold" | "info";
    message: string;
    timestamp: Date;
    read: boolean;                 // Whether user has seen the alert
    createdAt?: Date;
    updatedAt?: Date;
}